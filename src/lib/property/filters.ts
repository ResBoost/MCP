import { z } from "zod";

import { MAX_PRICE, PROPERTY_TYPE_IDS, propertyTypeLabel, type PropertyTypeId } from "./constants";
import { formatCompactPrice, plural } from "./format";

/*
 * One filter schema shared by the search page URL, the tRPC input and the MCP tool input,
 * so every surface accepts exactly the parameters the LonRes API supports.
 *
 * Inputs arrive as URL strings (site) or JSON (tRPC/MCP). `null` and "" mean "not set";
 * LLM clients send null for unused parameters and it must never become 0.
 */

const blank = (v: unknown) => (v === null || v === "" ? undefined : v);
const numeric = (v: unknown) => {
  const b = blank(v);
  if (typeof b !== "string") return b;
  const digits = b.replace(/[,\s£]/g, "");
  // " ", "£" or "," alone mean "not set", never 0.
  return digits === "" ? undefined : Number(digits);
};

// Factories (not shared instances) so the published JSON schema has no $ref indirection.
const money = (description: string) =>
  z.preprocess(numeric, z.number().int().min(0).max(MAX_PRICE).optional()).describe(description);
const count = (description: string) =>
  z.preprocess(numeric, z.number().int().min(0).max(20).optional()).describe(description);
const requireFlag = (description: string) =>
  z.preprocess((v) => (v === true || v === "true" ? true : undefined), z.literal(true).optional()).describe(description);

/*
 * Module-level schemas are built in `@__PURE__` IIFEs so bundlers can drop them, and zod with them,
 * from client bundles that only use the helpers below (header, search bar, result cards).
 */
const propertyTypeId = /* @__PURE__ */ (() =>
  z.preprocess(
    numeric,
    z.union(PROPERTY_TYPE_IDS.map((id) => z.literal(id)) as unknown as [z.ZodLiteral<PropertyTypeId>, z.ZodLiteral<PropertyTypeId>]),
  ))();

const postcode = /* @__PURE__ */ (() =>
  z.preprocess(
    // Normalise spacing so "NW81AA" is sent as the full postcode "NW8 1AA", not read as a district.
    (v) => (typeof v === "string" ? v.toUpperCase().replace(/\s+/g, "").replace(/^(.{2,4})(\d[A-Z]{2})$/, "$1 $2") : v),
    z.string().regex(/^[A-Z]{1,2}\d[A-Z\d]?( ?\d[A-Z]{2})?$/, "Use a UK postcode district such as W9 or NW8"),
  ))();

// prettier-ignore
export const searchFiltersSchema = /* @__PURE__ */ (() => z
  .object({
    query: z
      .preprocess(blank, z.string().trim().min(1).max(100).optional())
      .describe("Free text: street, area or postcode, e.g. 'Elgin Avenue' or 'W9 1AA'."),
    postcodes: z
      .preprocess(blank, z.array(postcode).min(1).max(10).optional())
      .describe("Postcode districts (outward codes) such as ['W9', 'NW8']."),
    priceMin: money("Minimum asking price in GBP."),
    priceMax: money("Maximum asking price in GBP."),
    bedsMin: count("Minimum bedrooms. Use bedsMin 0 with bedsMax 0 for studios only."),
    bedsMax: count("Maximum bedrooms."),
    bathsMin: count("Minimum bathrooms."),
    propertyTypes: z
      .preprocess(blank, z.array(propertyTypeId).min(1).max(PROPERTY_TYPE_IDS.length).optional())
      .describe(
        `Property type IDs: ${PROPERTY_TYPE_IDS.map((id) => `${id} = ${propertyTypeLabel(id)}`).join(", ")}.`,
      ),
    outsideSpace: requireFlag("true = only homes with outside space. Omit for any."),
    parking: requireFlag("true = only homes with parking. Omit for any."),
  })
  .strict())();

export type SearchFilters = z.infer<typeof searchFiltersSchema>;
export type FilterKey = keyof SearchFilters;

/**
 * Canonical form sent upstream and described to users: reversed ranges are swapped,
 * no-op minimums dropped, lists de-duplicated. "Studio" is bedsMin 0 + bedsMax 0.
 */
export function normaliseFilters(filters: SearchFilters): SearchFilters {
  const f: SearchFilters = { ...filters };
  if (f.priceMin !== undefined && f.priceMax !== undefined && f.priceMin > f.priceMax)
    [f.priceMin, f.priceMax] = [f.priceMax, f.priceMin];
  if (f.bedsMin !== undefined && f.bedsMax !== undefined && f.bedsMin > f.bedsMax)
    [f.bedsMin, f.bedsMax] = [f.bedsMax, f.bedsMin];
  if (f.priceMin === 0) delete f.priceMin;
  // "At most 0 bedrooms" is the studio pair.
  if (f.bedsMax === 0) f.bedsMin = 0;
  if (f.bedsMin === 0 && f.bedsMax !== 0) delete f.bedsMin;
  if (f.bathsMin === 0) delete f.bathsMin;
  if (f.postcodes) f.postcodes = [...new Set(f.postcodes)];
  if (f.propertyTypes) f.propertyTypes = [...new Set(f.propertyTypes)];
  return f;
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

const URL_KEYS: Record<FilterKey, { param: string; list?: boolean }> = {
  query: { param: "q" },
  postcodes: { param: "postcodes", list: true },
  priceMin: { param: "priceMin" },
  priceMax: { param: "priceMax" },
  bedsMin: { param: "bedsMin" },
  bedsMax: { param: "bedsMax" },
  bathsMin: { param: "bathsMin" },
  propertyTypes: { param: "types", list: true },
  outsideSpace: { param: "outsideSpace" },
  parking: { param: "parking" },
};

function readAll(source: ParamSource, key: string): string[] {
  if (source instanceof URLSearchParams) return source.getAll(key);
  const value = source[key];
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

/** Parse URL search params into normalised filters. Invalid values are dropped per field. */
export function parseSearchParams(source: ParamSource): SearchFilters {
  const result: Record<string, unknown> = {};
  for (const [key, { param, list }] of Object.entries(URL_KEYS) as [FilterKey, (typeof URL_KEYS)[FilterKey]][]) {
    const values = readAll(source, param);
    if (!values.length) continue;
    const raw = list ? values.flatMap((v) => v.split(",")).filter(Boolean) : values[0];
    const parsed = searchFiltersSchema.shape[key].safeParse(raw);
    if (parsed.success && parsed.data !== undefined) result[key] = parsed.data;
  }
  return normaliseFilters(searchFiltersSchema.parse(result));
}

type ParamValue = string | number | boolean | readonly (string | number)[] | undefined;

/** Build query params, skipping empty values and joining lists with commas. */
function buildParams(entries: [string, ParamValue][]): URLSearchParams {
  const p = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) p.set(key, value.join(","));
    } else p.set(key, String(value));
  }
  return p;
}

/** Inverse of `parseSearchParams`, used to build links and push filter changes to the URL. */
export const toSearchParams = (f: SearchFilters) =>
  buildParams((Object.keys(URL_KEYS) as FilterKey[]).map((key) => [URL_KEYS[key].param, f[key]]));

/** Map filters onto the LonRes `/public/list/` query parameter names. */
export function toLonresQuery(filters: SearchFilters): URLSearchParams {
  const f = normaliseFilters(filters);
  return buildParams([
    ["section", "sales"],
    ["quick_search", f.query],
    ["postcodes", f.postcodes],
    ["price_min", f.priceMin],
    ["price_max", f.priceMax],
    ["bed_min", f.bedsMin],
    ["bed_max", f.bedsMax],
    ["bath_min", f.bathsMin],
    ["property_types", f.propertyTypes],
    ["outside_space", f.outsideSpace],
    ["parking", f.parking],
  ]);
}

export interface FilterChip {
  /** Removing this key clears the chip; `bedsMin` also clears `bedsMax`. */
  key: FilterKey;
  label: string;
}

/** The bedroom constraint as one chip, or null when there is none. */
export function bedroomsChip(filters: SearchFilters): FilterChip | null {
  const { bedsMin: min, bedsMax: max } = normaliseFilters(filters);
  if (min === 0 && max === 0) return { key: "bedsMin", label: "Studio" };
  if (min !== undefined && max !== undefined)
    return { key: "bedsMin", label: min === max ? `${min} ${plural(min, "bed")}` : `${min}–${max} beds` };
  if (min !== undefined) return { key: "bedsMin", label: `${min}+ beds` };
  if (max !== undefined) return { key: "bedsMax", label: `Up to ${max} ${plural(max, "bed")}` };
  return null;
}

export const propertyTypesLabel = (ids: readonly number[]) =>
  ids.map((id) => propertyTypeLabel(id) ?? `Type ${id}`).join(", ");

/** Every filter that is actually sent upstream, as human-readable chips (UI and MCP). */
export function describeFilters(filters: SearchFilters): FilterChip[] {
  const f = normaliseFilters(filters);
  const chips: (FilterChip | null)[] = [
    f.query ? { key: "query", label: f.query } : null,
    f.postcodes?.length ? { key: "postcodes", label: f.postcodes.join(", ") } : null,
    f.priceMin !== undefined ? { key: "priceMin", label: `From ${formatCompactPrice(f.priceMin)}` } : null,
    f.priceMax !== undefined ? { key: "priceMax", label: `Up to ${formatCompactPrice(f.priceMax)}` } : null,
    bedroomsChip(f),
    f.bathsMin !== undefined ? { key: "bathsMin", label: `${f.bathsMin}+ baths` } : null,
    f.propertyTypes?.length ? { key: "propertyTypes", label: propertyTypesLabel(f.propertyTypes) } : null,
    f.outsideSpace ? { key: "outsideSpace", label: "Outside space" } : null,
    f.parking ? { key: "parking", label: "Parking" } : null,
  ];
  return chips.filter((c): c is FilterChip => c !== null);
}

/** Remove one filter; the bedroom chip clears both ends of the range. */
export function withoutFilter(filters: SearchFilters, key: FilterKey): SearchFilters {
  const next = { ...filters };
  delete next[key];
  if (key === "bedsMin") delete next.bedsMax;
  return next;
}

/**
 * The bedroom chip when the quick options (any, studio, 1+ … 4+) can't express the filter
 * (ranges, max-only, 5+), else `null`. Shared by the search bar and the filter panel.
 */
export function customBedroomsChip(f: SearchFilters): FilterChip | null {
  const chip = bedroomsChip(f);
  const beds = bedroomsValue(f);
  const quick = beds === 0 || (f.bedsMax === undefined && beds !== null && beds <= 4);
  return chip && !quick ? chip : null;
}

/** Bedroom option value: `null` any, 0 studio only, n = n or more. */
export function bedroomsValue(f: SearchFilters): number | null {
  if (f.bedsMin === 0 && f.bedsMax === 0) return 0;
  return f.bedsMin ?? null;
}

export function withBedrooms(f: SearchFilters, value: number | null): SearchFilters {
  const next = { ...f };
  delete next.bedsMin;
  delete next.bedsMax;
  if (value === null) return next;
  return value === 0 ? { ...next, bedsMin: 0, bedsMax: 0 } : { ...next, bedsMin: value };
}

/** Set or clear one optional filter, dropping empty values so URLs stay clean. */
export function withFilter<K extends FilterKey>(f: SearchFilters, key: K, value: SearchFilters[K] | null): SearchFilters {
  const next = { ...f };
  const empty = value === null || value === undefined || (Array.isArray(value) && !value.length);
  if (empty) delete next[key];
  else next[key] = value;
  return next;
}

/** Stable identity for comparing filter objects (e.g. to reset drafts when the URL changes). */
export const filtersKey = (f: SearchFilters) => toSearchParams(normaliseFilters(f)).toString();

/** Parse a typed amount: "850,000", "£850k", "1.5m". `null` when it isn't a valid price. */
export function parseMoneyInput(raw: string): number | null {
  const match = /^£?\s*([\d,]*\.?\d+)\s*([km])?$/i.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]!.replace(/,/g, ""));
  const multiplier = { k: 1_000, m: 1_000_000 }[match[2]?.toLowerCase() as "k" | "m"] ?? 1;
  const amount = Math.round(value * multiplier);
  return Number.isFinite(amount) && amount >= 0 && amount <= MAX_PRICE ? amount : null;
}
