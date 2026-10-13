import { MEDIA_PATH_PREFIX } from "./constants";
import type { KeyFacts, MediaItem, Price } from "./types";

/*
 * Primitive formatters shared by the UI and MCP so both present data identically.
 * Listing-level presentation (status, fact tables, contact links) lives in `present.ts`.
 */

export const NOT_SUPPLIED = "Not supplied";
export const SEPARATOR = " · ";

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-GB");

export const plural = (n: number, noun: string, pluralNoun = `${noun}s`) => (n === 1 ? noun : pluralNoun);

/** "£1.5m", "£750k"; only abbreviates when exact, so a filter is never misstated. */
export function formatCompactPrice(amount: number): string {
  if (amount >= 1_000_000 && amount % 10_000 === 0) return `£${amount / 1_000_000}m`;
  if (amount >= 1_000 && amount < 1_000_000 && amount % 1_000 === 0) return `£${amount / 1_000}k`;
  return gbp.format(amount);
}

/** Monthly figure for a weekly rent, matching lonres_api `monthly_rent`. */
export const monthlyRent = (weekly: number) => Math.round((weekly * 52) / 12);

/** The price itself: "£950,000", "£2,950 pw / £12,783 pcm", "POA"/"ROA". No qualifier. */
export function formatPrice(price: Price): string {
  if (price.onApplication) return price.period === "week" ? "ROA" : "POA";
  if (price.amount !== null) {
    return price.period === "week"
      ? `${gbp.format(price.amount)} pw / ${gbp.format(monthlyRent(price.amount))} pcm`
      : gbp.format(price.amount);
  }
  return price.display ?? "Price not supplied";
}

/** One-line price with its qualifier ("Guide price £49,500,000"): metadata, alt text, MCP. */
export const formatPriceLine = (price: Price) =>
  price.qualifier && !price.onApplication ? `${price.qualifier} ${formatPrice(price)}` : formatPrice(price);

/** Zero bedrooms is a studio; `null` is unknown or not applicable. */
export function formatBedrooms(beds: number | null, style: "short" | "long" = "short"): string | null {
  if (beds === null) return null;
  if (beds === 0) return "Studio";
  return style === "short" ? `${beds} ${plural(beds, "bed")}` : `${beds}-bedroom`;
}

export const formatBathrooms = (baths: number | null) => (baths === null ? null : `${baths} ${plural(baths, "bath")}`);

export const formatArea = (sqFt: number | null) => (sqFt === null ? null : `${number.format(sqFt)} sq ft`);

/** Tri-state flags: unknown (`null`) is not "No"; callers render it as "Not supplied". */
export const formatFlag = (value: boolean | null) => (value === null ? null : value ? "Yes" : "No");

export const orNotSupplied = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === "" ? NOT_SUPPLIED : String(value);

/** "Flat", "Parking space"; the API's type name in sentence case. */
export function formatPropertyType(facts: KeyFacts): string {
  const type = facts.propertyType?.toLowerCase() ?? "property";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/** "3-bedroom flat", "Studio flat", "Parking space". */
export function formatPropertyTitle(facts: KeyFacts): string {
  const beds = formatBedrooms(facts.bedrooms, "long");
  return beds ? `${beds} ${formatPropertyType(facts).toLowerCase()}` : formatPropertyType(facts);
}

/** "3 beds · 2 baths · 906 sq ft". Unknown facts are left out; `null` when nothing is known. */
export function formatKeyFacts(facts: KeyFacts): string | null {
  const parts = [formatBedrooms(facts.bedrooms), formatBathrooms(facts.bathrooms), formatArea(facts.floorAreaSqFt)];
  const known = parts.filter(Boolean);
  return known.length ? known.join(SEPARATOR) : null;
}

/** Card/MCP summary: "Flat · 3 beds · 2 baths · 906 sq ft" or "Parking space". */
export const formatSummaryLine = (facts: KeyFacts) =>
  [formatPropertyType(facts), formatKeyFacts(facts)].filter(Boolean).join(SEPARATOR);

/** Short feature tags, only for values the agent actually supplied. */
export function featureTags(facts: KeyFacts): string[] {
  return [
    facts.tenureType,
    facts.epcRating && `EPC ${facts.epcRating}`,
    facts.outsideSpace && "Outside space",
    facts.parking && "Parking",
    facts.lift && "Lift",
  ].filter((t): t is string => typeof t === "string" && t.length > 0);
}

/** "W9" from "W9 1AA": the district shown publicly. */
export const postcodeDistrict = (postcode: string | null) => postcode?.trim().split(/\s+/)[0]?.toUpperCase() ?? null;

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** "March 2026" from an ISO date. */
export function formatMonth(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Resolve a LonRes media thumbnail template (`…{max}{width}x{height}.jpg`). */
export function thumbnailUrl(media: Pick<MediaItem, "thumbnailTemplate" | "url">, width: number, height: number): string {
  if (!media.thumbnailTemplate) return media.url;
  return media.thumbnailTemplate.replace("{max}", "").replace("{width}", String(width)).replace("{height}", String(height));
}

export interface FittedImage {
  src: string;
  /** Pixel size of `src`; `null` when the API didn't supply the original's dimensions. */
  width: number | null;
  height: number | null;
}

/**
 * The media scaled to fit within `maxWidth`×`maxHeight`, keeping its aspect ratio and never
 * upscaling. A plain `{width}x{height}` thumbnail is stretched to exactly that size, which distorts
 * floorplans; with unknown dimensions the template's `{max}` (fit-within) variant is used instead.
 */
export function fitThumbnail(media: Pick<MediaItem, "thumbnailTemplate" | "url" | "width" | "height">, maxWidth: number, maxHeight: number): FittedImage {
  const { width, height } = media;
  const known = width !== null && height !== null && width > 0 && height > 0;
  if (!media.thumbnailTemplate) return { src: media.url, width: known ? width : null, height: known ? height : null };
  if (!known) {
    const src = media.thumbnailTemplate.replace("{max}", "max").replace("{width}", String(maxWidth)).replace("{height}", String(maxHeight));
    return { src, width: null, height: null };
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { src: thumbnailUrl(media, w, h), width: w, height: h };
}

/**
 * Whether `next/image` may optimise `src`: LonRes images, which the server rewrites to this site's
 * own `/images/...` path (`images.localPatterns` in next.config.js). Anything else is served as-is.
 */
export const isOptimisableImage = (src: string): boolean => src.startsWith(MEDIA_PATH_PREFIX);
