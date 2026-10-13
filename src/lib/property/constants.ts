/** Property type IDs accepted by the `property_types` filter (lonres_api PropertyType). */
export const PROPERTY_TYPES = [
  { id: 5, label: "Flat" },
  { id: 14, label: "House" },
  { id: 1000000002, label: "Block of flats" },
  { id: 1000000001, label: "Development opportunity" },
  { id: 1000000003, label: "Land only" },
  { id: 1000000004, label: "Parking space" },
] as const;

export type PropertyTypeId = (typeof PROPERTY_TYPES)[number]["id"];

export const PROPERTY_TYPE_IDS = PROPERTY_TYPES.map((t) => t.id) as [PropertyTypeId, ...PropertyTypeId[]];

export const propertyTypeLabel = (id: number) => PROPERTY_TYPES.find((t) => t.id === id)?.label ?? null;

/**
 * Types where bedrooms and bathrooms don't apply (lonres_api `bed_count_`), matched on the
 * API's type name. A zero bedroom count on these is "not applicable", never "Studio".
 */
const NON_RESIDENTIAL = new Set(["block of flats", "development opportunity", "land only", "parking space"]);
export const isResidentialType = (type: string | null) => !type || !NON_RESIDENTIAL.has(type.toLowerCase());

/** lonres_api PriceQualifier ids with special meaning. */
export const PRICE_QUALIFIER = { DEFAULT: 0, ON_APPLICATION: 1 } as const;

/** The JSON search is hard-capped and ordered by ascending price upstream. */
export const SEARCH_RESULT_LIMIT = 50;

/** Upper bound for price filters: well above any listing, and a safe integer for the API. */
export const MAX_PRICE = 1_000_000_000;

/** `null` = any. 0 = studio only. */
export const BEDROOM_OPTIONS = [
  { value: null, label: "Any" },
  { value: 0, label: "Studio" },
  { value: 1, label: "1+" },
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
  { value: 4, label: "4+" },
] as const;

export const BATHROOM_OPTIONS = [
  { value: null, label: "Any" },
  { value: 1, label: "1+" },
  { value: 2, label: "2+" },
  { value: 3, label: "3+" },
] as const;

export const PRICE_OPTIONS = [
  250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000,
  10_000_000,
] as const;

/**
 * Property types with their own landing page under a district: /properties/{district}/{slug}.
 * Bedroom facets are deliberately left out: bedrooms are a min/max range (studio, 1+, 2–3…),
 * so no single path would be the one canonical form, and each would multiply the URL space.
 */
export const PROPERTY_FACETS = [
  { slug: "flats", typeId: 5, label: "Flats" },
  { slug: "houses", typeId: 14, label: "Houses" },
] as const satisfies readonly { slug: string; typeId: PropertyTypeId; label: string }[];

export type PropertyFacet = (typeof PROPERTY_FACETS)[number];
export type PropertyFacetSlug = PropertyFacet["slug"];

export const facetBySlug = (slug: string) => PROPERTY_FACETS.find((f) => f.slug === slug) ?? null;
export const facetByTypeId = (id: number) => PROPERTY_FACETS.find((f) => f.typeId === id) ?? null;

/** LonRes images are served from this site under this path (see `~/server/lonres/media`). */
export const MEDIA_PATH_PREFIX = "/images/";
