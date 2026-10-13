/**
 * Domain models used by the UI, tRPC and MCP. They are produced from raw LonRes API
 * responses by `~/server/lonres/mappers` and never contain API-specific casing.
 *
 * `null` always means "not supplied by the agent", never zero or false.
 */

export type Section = "sales" | "lettings";

/** Where the listing is in its lifecycle. Only `available` and `under-offer` are live. */
export type Availability = "available" | "under-offer" | "sold" | "let" | "withdrawn";

export interface Agent {
  organisation: string | null;
  /** Individual negotiator. `null` when the listing hides the agent name. */
  name: string | null;
  /** Number as supplied, for display. */
  telephone: string | null;
  /** E.164 (`+442071234567`), or `null` when the supplied number can't be parsed. */
  telephoneE164: string | null;
  /** Validated address, or `null` when missing or malformed. */
  email: string | null;
  /** E.164, only when the agent has WhatsApp enabled and the number parses. */
  whatsappE164: string | null;
  logoUrl: string | null;
  /** The marketing branch's office address on one line. Detail only. */
  officeAddress: string | null;
  /** Negotiator headshot. Detail only; `null` when not supplied or the agent name is hidden. */
  photoUrl: string | null;
  /** The org's brand colours. Detail only; `null` when the org hasn't set them. */
  brand: AgentBrand | null;
}

/** Validated `#rrggbb` colours from the org's LonRes styling preferences. */
export interface AgentBrand {
  colour: string;
  /** Background to show the logo on; `null` means a plain white surface. */
  logoBackground: string | null;
}

export interface Price {
  /** `null` when withheld (POA/ROA) or not supplied. Weekly for lettings. */
  amount: number | null;
  /** List endpoint only: the API's pre-formatted price, cleaned of qualifier and STC text. */
  display: string | null;
  /** e.g. "Guide price", "Offers in excess of". Never set for POA/ROA. */
  qualifier: string | null;
  /** The agent withheld the price (qualifier id 1): shown as POA or ROA. */
  onApplication: boolean;
  /** `week` for lettings: `amount` is per week and a monthly figure is derived. */
  period: "week" | null;
  currency: string;
}

export interface KeyFacts {
  bedrooms: number | null;
  bathrooms: number | null;
  receptions: number | null;
  floorAreaSqFt: number | null;
  propertyType: string | null;
  /** Short type, e.g. "Leasehold". */
  tenureType: string | null;
  /** The agent's full tenure text, e.g. "Leasehold, 99 years remaining". */
  tenure: string | null;
  epcRating: string | null;
  parking: boolean | null;
  outsideSpace: boolean | null;
  lift: boolean | null;
}

export interface PropertySummary {
  id: string;
  /** Public address: never includes flat or building numbers. */
  address: string;
  description: string | null;
  price: Price;
  facts: KeyFacts;
  /** Up to five 600×400 previews, not the full gallery. */
  photos: string[];
  agent: Agent;
}

export type MediaKind = "photo" | "floorplan";

export interface MediaItem {
  kind: MediaKind;
  url: string;
  /** API template with `{max}{width}x{height}` placeholders; see `thumbnailUrl()`. */
  thumbnailTemplate: string | null;
  width: number | null;
  height: number | null;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Agent-authored notices the listing page must republish alongside the particulars. */
export interface AgentNotices {
  about: string | null;
  disclaimer: string | null;
  /** Lettings client-money-protection and fees statement. */
  capNotes: string | null;
}

export interface PropertyDetail extends PropertySummary {
  section: Section;
  availability: Availability;
  /** The API's status label, e.g. "For Sale", "Sold", "To Let". */
  status: string | null;
  accommodation: string | null;
  postcode: string | null;
  /** Town or city, e.g. "London". */
  locality: string | null;
  /** Sold or let listings: ISO date (YYYY-MM-DD) the listing closed. */
  closedOn: string | null;
  floor: string | null;
  groundRent: string | null;
  serviceCharge: string | null;
  /** Lettings only. */
  furnished: string | null;
  /** Lettings only: ISO date (YYYY-MM-DD). */
  dateAvailable: string | null;
  location: GeoPoint | null;
  media: MediaItem[];
  videoUrl: string | null;
  virtualTourUrl: string | null;
  notices: AgentNotices;
}

export interface SearchResult {
  items: PropertySummary[];
  /** The API returns at most this many homes, lowest price first. */
  limit: number;
  /** True when the result hit the API cap, so more homes may match. */
  capped: boolean;
}
