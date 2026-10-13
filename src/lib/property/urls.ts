import { facetBySlug, facetByTypeId, type PropertyFacet, type PropertyFacetSlug } from "./constants";
import { normaliseFilters, parseSearchParams, toSearchParams, withoutFilter, type SearchFilters } from "./filters";

/** Canonical site paths. Framework-free and client-safe: absolute URLs live in `~/server/urls`. */
export const SEARCH_PATH = "/properties";

/** Outward postcode (district) such as W9 or NW8: these get their own landing page. */
export const isDistrict = (value: string) => /^[A-Z]{1,2}\d[A-Z\d]?$/.test(value);

export const districtPath = (district: string) => `${SEARCH_PATH}/${district}`;

/** District × property type landing page, e.g. /properties/W8/flats. */
export const facetPath = (district: string, facet: PropertyFacetSlug) => `${districtPath(district)}/${facet}`;

export const propertyPath = (id: string) => `/property/${id}`;

/**
 * Results URL. A search for exactly one district lives at /properties/{district}; if it also has
 * exactly one facet type (flat or house) it lives at /properties/{district}/{facet}. Every other
 * filter stays in the query string.
 */
export function searchPath(filters: SearchFilters = {}): string {
  let f = normaliseFilters(filters);
  const district = f.postcodes?.length === 1 && isDistrict(f.postcodes[0]!) ? f.postcodes[0]! : null;
  let base = SEARCH_PATH;
  if (district) {
    f = withoutFilter(f, "postcodes");
    const facet = f.propertyTypes?.length === 1 ? facetByTypeId(f.propertyTypes[0]!) : null;
    if (facet) f = withoutFilter(f, "propertyTypes");
    base = facet ? facetPath(district, facet.slug) : districtPath(district);
  }
  const query = toSearchParams(f).toString();
  return query ? `${base}?${query}` : base;
}

const safeDecode = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null; // malformed escape such as %E0%A4
  }
};

/**
 * Landing page path segments (/properties/{district}[/{facet}]) as a district and facet, or
 * `null` when they aren't one (unknown facet, not a district, malformed percent-encoding).
 */
export function parseLandingSegments(district: string, facet?: string): { district: string; facet: PropertyFacet | null } | null {
  const d = safeDecode(district)?.toUpperCase();
  if (!d || !isDistrict(d)) return null;
  if (facet === undefined) return { district: d, facet: null };
  const f = safeDecode(facet);
  const match = f === null ? null : facetBySlug(f.toLowerCase());
  return match ? { district: d, facet: match } : null;
}

/**
 * Filters for a landing page: the query's filters scoped by the path. The path's facet type
 * joins any `types` in the query; more than one type canonicalises to the district page.
 */
export function landingFilters(district: string, facet: PropertyFacet | null, query: SearchFilters): SearchFilters {
  const propertyTypes = facet ? [...new Set([facet.typeId, ...(query.propertyTypes ?? [])])] : query.propertyTypes;
  return { ...query, postcodes: [district], ...(propertyTypes ? { propertyTypes } : {}) };
}

/**
 * The canonical href a results request must redirect to, or `null` if it is already canonical.
 * Both path and query count: `/properties/W9/flats?types=5` or `/properties/NW1?postcodes=NW8`
 * repeat or contradict the path, so they redirect. The query is compared after parsing and
 * normalising, so parameter order, invalid values and unknown params (utm_*) don't redirect.
 */
export function canonicalRedirect(requestedPath: string, query: URLSearchParams | Record<string, string | string[] | undefined>, filters: SearchFilters): string | null {
  const canonical = searchPath(filters);
  const [canonicalPath, canonicalQuery = ""] = canonical.split("?");
  const requestedQuery = toSearchParams(parseSearchParams(query)).toString();
  return canonicalPath === requestedPath && canonicalQuery === requestedQuery ? null : canonical;
}

/** Listing link that remembers the search it came from, for "Back to results". */
export function propertyHref(id: string, from?: SearchFilters): string {
  const query = from ? toSearchParams(normaliseFilters(from)).toString() : "";
  return query ? `${propertyPath(id)}?from=${encodeURIComponent(query)}` : propertyPath(id);
}

/**
 * Turn an untrusted `from` value back into a search path. It is re-parsed and re-serialised,
 * so it can only ever produce a results URL (no open redirects or `javascript:` hrefs).
 */
export function backToResultsPath(from: string | string[] | undefined): string {
  const raw = Array.isArray(from) ? from[0] : from;
  if (!raw) return SEARCH_PATH;
  return searchPath(parseSearchParams(new URLSearchParams(raw)));
}
