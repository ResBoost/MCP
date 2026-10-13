import { SEARCH_RESULT_LIMIT } from "./constants";
import {
  formatArea,
  formatBedrooms,
  formatDate,
  formatFlag,
  formatMonth,
  formatPrice,
  formatPropertyType,
  plural,
  postcodeDistrict,
} from "./format";
import type { Agent, Availability, MediaItem, MediaKind, PropertyDetail, SearchResult, Section } from "./types";

/*
 * Listing-level presentation shared by the page organisms and the MCP text output, so the
 * website and AI answers can't drift apart.
 */

export interface FactItem {
  label: string;
  /** `null` renders as "Not supplied". */
  value: string | null;
}

/** Live listings can be enquired about; the rest are shown as history. */
export const isLive = (availability: Availability) => availability === "available" || availability === "under-offer";

export function listingStatusLabel(section: Section, availability: Availability): string {
  switch (availability) {
    case "under-offer":
      return "Under offer";
    case "sold":
      return "Sold";
    case "let":
      return "Let agreed";
    case "withdrawn":
      return "No longer available";
    default:
      return section === "lettings" ? "To let" : "For sale";
  }
}

/** "sold in March 2026" when the closing date is published, else "now sold". */
function closedPhrase(availability: Availability, closedOn: string | null): string {
  const month = formatMonth(closedOn);
  if (availability === "sold") return month ? `sold in ${month}` : "now sold";
  if (availability === "let") return month ? `let in ${month}` : "now let";
  return "no longer on the market";
}

/** The one notice shown for closed listings (page banner and MCP). */
export function closedListingNotice(p: Pick<PropertyDetail, "section" | "availability" | "closedOn">): string {
  const month = formatMonth(p.closedOn);
  const state =
    month && (p.availability === "sold" || p.availability === "let")
      ? `was ${p.availability} in ${month}`
      : `is ${listingStatusLabel(p.section, p.availability).toLowerCase()}`;
  return `This home ${state}. It stays here for reference; the price and the agent’s contact details are no longer shown.`;
}

/** Verb phrase for titles: "for sale", "to rent". */
export const sectionPhrase = (section: Section) => (section === "lettings" ? "to rent" : "for sale");

/**
 * One factual sentence at the top of a listing, e.g. "4-bedroom freehold house for sale in
 * Example Road, E11, marketed by ABC Estates, asking price £1,250,000." Built only from supplied
 * facts, so machines can quote it without inferring anything. Closed listings omit the price.
 */
export function listingSummary(p: PropertyDetail): string {
  const { facts } = p;
  const tenure = p.section === "sales" ? facts.tenureType?.toLowerCase() : null;
  const subject = [formatBedrooms(facts.bedrooms, "long"), tenure, facts.propertyType?.toLowerCase() ?? "property"].filter(Boolean).join(" ");
  // Town and district are appended only when the public address doesn't already name them
  // (any postcode in the address counts: "Park Lane, London W1" shouldn't gain ", W1K").
  const names = (part: string) => new RegExp(`\\b${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(p.address);
  const town = p.locality && !names(p.locality) ? p.locality : null;
  const district = postcodeDistrict(p.postcode);
  const hasPostcode = /\b[A-Z]{1,2}\d[A-Z\d]?\b/.test(p.address);
  const place = [p.address, town, district && !hasPostcode ? district : null].filter(Boolean).join(", ");
  const live = isLive(p.availability);

  let sentence = `${subject.charAt(0).toUpperCase()}${subject.slice(1)}`;
  sentence += live ? ` ${sectionPhrase(p.section)}${p.availability === "under-offer" ? " (under offer)" : ""} in ${place}` : ` in ${place}`;
  if (p.agent.organisation) sentence += `, marketed by ${p.agent.organisation}`;
  if (!live) sentence += `, ${closedPhrase(p.availability, p.closedOn)}`;
  else if (p.price.onApplication) sentence += `, price on application`;
  else if (p.price.amount !== null) {
    const label = p.price.qualifier?.toLowerCase() ?? (p.section === "lettings" ? "rent" : "asking price");
    sentence += `, ${label} ${formatPrice(p.price)}`;
  }
  return `${sentence}.`;
}

/** Full facts table for a listing. Sales-only rows are omitted for lettings and vice versa. */
export function detailFactItems(p: PropertyDetail): FactItem[] {
  const { facts } = p;
  const sales = p.section === "sales";
  const items: (FactItem | false)[] = [
    { label: "Property type", value: facts.propertyType ? formatPropertyType(facts) : null },
    { label: "Floor area", value: formatArea(facts.floorAreaSqFt) },
    { label: "Receptions", value: facts.receptions === null ? null : String(facts.receptions) },
    sales && { label: "Tenure", value: facts.tenure },
    { label: "EPC rating", value: facts.epcRating },
    { label: "Floor", value: p.floor },
    { label: "Parking", value: formatFlag(facts.parking) },
    { label: "Outside space", value: formatFlag(facts.outsideSpace) },
    { label: "Lift", value: formatFlag(facts.lift) },
    sales && p.serviceCharge !== null && { label: "Service charge", value: p.serviceCharge },
    sales && p.groundRent !== null && { label: "Ground rent", value: p.groundRent },
    !sales && { label: "Furnished", value: p.furnished },
    !sales && { label: "Available from", value: availableFrom(p.dateAvailable) },
    { label: "Postcode district", value: postcodeDistrict(p.postcode) },
  ];
  return items.filter((i): i is FactItem => Boolean(i));
}

const londonToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

/** "Now" once the date has passed (as the legacy site shows), otherwise the date. */
export const availableFrom = (iso: string | null) => (iso === null ? null : iso <= londonToday() ? "Now" : formatDate(iso));

export const mediaOfKind = (media: MediaItem[], kind: MediaKind) => media.filter((m) => m.kind === kind);

export const marketedBy = (agent: Agent) =>
  agent.organisation ? `Marketed by ${agent.organisation}` : "Marketed by the listing agent";

export interface ContactChannel {
  kind: "call" | "email" | "whatsapp";
  label: string;
  shortLabel: string;
  href: string;
}

/** Direct contact routes, each present only when the agent supplied a usable value. */
export function contactChannels(agent: Agent, subject?: string): ContactChannel[] {
  const channels: ContactChannel[] = [];
  if (agent.telephoneE164) channels.push({ kind: "call", label: "Call agent", shortLabel: "Call", href: `tel:${agent.telephoneE164}` });
  if (agent.email) {
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    channels.push({ kind: "email", label: "Email agent", shortLabel: "Email", href: `mailto:${encodeURIComponent(agent.email)}${query}` });
  }
  if (agent.whatsappE164)
    channels.push({ kind: "whatsapp", label: "WhatsApp", shortLabel: "WhatsApp", href: `https://wa.me/${agent.whatsappE164.replace(/^\+/, "")}` });
  return channels;
}

export const capNotice = (limit = SEARCH_RESULT_LIMIT) =>
  `Showing the first ${limit} matches, lowest price first. Narrow your search to see other homes.`;

/** "3 results · Lowest price first", never presenting a capped batch as a market total. */
export function describeResultCount(result: Pick<SearchResult, "items" | "capped" | "limit">): string {
  const n = result.items.length;
  return result.capped
    ? `Showing the first ${result.limit} matches · Lowest price first`
    : `${n} ${plural(n, "result")} · Lowest price first`;
}
