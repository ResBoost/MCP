import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { describeFilters, searchFiltersSchema } from "~/lib/property/filters";
import {
  formatPriceLine,
  formatSummaryLine,
  orNotSupplied,
  SEPARATOR,
} from "~/lib/property/format";
import { publicIdSchema } from "~/lib/property/ids";
import {
  closedListingNotice,
  describeResultCount,
  detailFactItems,
  isLive,
  listingStatusLabel,
  listingSummary,
  marketedBy,
  mediaOfKind,
} from "~/lib/property/present";
import type { PropertyDetail, PropertySummary } from "~/lib/property/types";
import { propertyPath } from "~/lib/property/urls";
import { SITE_NAME } from "~/lib/site";
import { SEARCH_RESULT_LIMIT } from "~/lib/property/constants";
import { LonresApiError } from "~/server/lonres/client";
import { getProperty, logUpstreamError, searchProperties } from "~/server/lonres/service";
import { absoluteUrl } from "~/server/urls";

/*
 * Lightweight, read-only MCP server over the same property service as the website. Text and
 * structured output are built from the shared formatters in ~/lib/property, so AI answers match
 * what visitors see.
 */

const listingUrl = (id: string) => absoluteUrl(propertyPath(id));

// ---- Structured output (declared, so clients can rely on the shape) --------------------------

const summaryView = z.object({
  id: z.string().describe("Public listing ID; pass it to get_property."),
  url: z.string().describe("The listing page on this site, to link or cite."),
  address: z.string().describe("Street, area and postcode district. Never includes flat or house numbers."),
  price: z.string().describe("Display price including any qualifier, e.g. 'Guide price £1,250,000' or 'POA'."),
  priceAmount: z.number().nullable().describe("Asking price in GBP; null when withheld or not supplied."),
  propertyType: z.string().nullable().describe("e.g. Flat, House, Parking space."),
  bedrooms: z.number().nullable().describe("0 = studio; null = not supplied or not applicable."),
  bathrooms: z.number().nullable(),
  floorAreaSqFt: z.number().nullable().describe("Internal floor area in square feet, as the agent supplied it."),
  marketedBy: z.string().nullable().describe("The estate agency branch marketing the home."),
});

export const searchOutput = {
  results: z.array(summaryView).describe("Matching homes, lowest price first."),
  resultCount: z.number().describe("Homes in this response; not a total of all matches."),
  capped: z.boolean().describe(`True when the ${SEARCH_RESULT_LIMIT}-result cap was hit: more homes match, so narrow the filters.`),
  appliedFilters: z.array(z.string()).describe("The filters as understood, in words, e.g. '2+ beds'."),
};

export const detailOutput = {
  ...summaryView.shape,
  summary: z.string().describe("One factual sentence built only from supplied facts; safe to quote."),
  section: z.enum(["sales", "lettings"]),
  status: z.string().describe("For sale, To let, Under offer, Sold, Let agreed or No longer available."),
  pricePeriod: z.enum(["week"]).nullable().describe("'week' for lettings: priceAmount is per week."),
  facts: z
    .array(z.object({ label: z.string(), value: z.string().nullable() }))
    .describe("Key facts as shown on the page (tenure, EPC, service charge…); value null = not supplied."),
  photoCount: z.number(),
  floorplanCount: z.number(),
  agent: z.object({
    organisation: z.string().nullable().describe("The marketing branch, e.g. 'Winkworth (Maida Vale)'."),
    name: z.string().nullable().describe("The negotiator; null when the agent hides it."),
    telephone: z.string().nullable().describe("Null once the listing has closed."),
    email: z.string().nullable().describe("Null once the listing has closed."),
    officeAddress: z.string().nullable().describe("The marketing branch's office address."),
  }),
  closedOn: z.string().nullable().describe("Sold or let listings: ISO date the listing closed."),
  description: z.string().nullable().describe("Written by the agent; not verified."),
};

/** Reported to clients, and in the server card and registry entry (`./discovery`). */
export const MCP_SERVER_VERSION = "0.2.0";

/** Tool names, titles and schemas: registered below and documented on the /mcp page. */
export const SEARCH_TOOL = {
  name: "search_properties",
  title: "Search properties for sale",
  description: `Search homes for sale on ${SITE_NAME} (LonRes). Returns at most ${SEARCH_RESULT_LIMIT} matches, lowest price first; when \`capped\` is true more homes match, so narrow the filters (e.g. add postcodes or raise priceMin). Rentals are not searchable. All filters are optional.`,
  inputSchema: searchFiltersSchema,
  outputSchema: searchOutput,
} as const;

export const DETAIL_TOOL = {
  name: "get_property",
  title: "Get property details",
  description: `Full details for one ${SITE_NAME} listing by its public listing ID (from search_properties or a /property/{id} URL).`,
  inputSchema: z.object({ id: publicIdSchema.describe("The listing's public ID, e.g. 4446329653.") }).strict(),
  outputSchema: detailOutput,
} as const;

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

function toSummaryView(p: PropertySummary): z.infer<typeof summaryView> {
  return {
    id: p.id,
    url: listingUrl(p.id),
    address: p.address,
    price: formatPriceLine(p.price),
    priceAmount: p.price.amount,
    propertyType: p.facts.propertyType,
    bedrooms: p.facts.bedrooms,
    bathrooms: p.facts.bathrooms,
    floorAreaSqFt: p.facts.floorAreaSqFt,
    marketedBy: p.agent.organisation,
  };
}

// ---- Text output ----------------------------------------------------------------------------

const summaryText = (p: PropertySummary) =>
  [`${formatPriceLine(p.price)} — ${p.address}`, formatSummaryLine(p.facts), marketedBy(p.agent), listingUrl(p.id)].join("\n");

function detailText(p: PropertyDetail) {
  const live = isLive(p.availability);
  const agent = [p.agent.organisation, p.agent.name].filter(Boolean).join(" – ");
  const lines = [
    `# ${p.address}`,
    listingSummary(p),
    `Status: ${listingStatusLabel(p.section, p.availability)}`,
    live ? `Price: ${formatPriceLine(p.price)}` : closedListingNotice(p),
    formatSummaryLine(p.facts),
    "",
    ...detailFactItems(p).map((f) => `${f.label}: ${orNotSupplied(f.value)}`),
    ...(p.accommodation ? [`Accommodation: ${p.accommodation}`] : []),
    `Photos: ${mediaOfKind(p.media, "photo").length}${SEPARATOR}Floorplans: ${mediaOfKind(p.media, "floorplan").length}`,
    "",
    `Agent: ${agent || "Not supplied"}`,
    live
      ? [`Telephone: ${orNotSupplied(p.agent.telephone)}`, `Email: ${orNotSupplied(p.agent.email)}`, ...(p.agent.whatsappE164 ? [`WhatsApp: ${p.agent.whatsappE164}`] : [])].join(SEPARATOR)
      : "Contact details: not shown",
    ...(p.virtualTourUrl ? [`Virtual tour: ${p.virtualTourUrl}`] : []),
    ...(p.videoUrl ? [`Video: ${p.videoUrl}`] : []),
    `Listing: ${listingUrl(p.id)}`,
    "",
    "Description (written by the agent, not verified):",
    p.description ? `"""\n${p.description}\n"""` : "Not supplied",
  ];
  const notices = [p.notices.about, p.notices.disclaimer, p.notices.capNotes].filter(Boolean);
  if (notices.length) lines.push("", "From the agent:", ...(notices as string[]));
  return lines.join("\n");
}

const toolError = (context: string, error: unknown) => {
  logUpstreamError(context, error);
  const message = error instanceof LonresApiError ? LonresApiError.PUBLIC_MESSAGE : "Something went wrong.";
  return { isError: true, content: [{ type: "text" as const, text: `${message} Please try again shortly.` }] };
};

/** One line per tool call, the source for "MCP tool calls per day" (docs/seo-plan.md, Phase 0). */
const logToolCall = (tool: string, outcome: string) => console.info(`[mcp] ${tool}: ${outcome}`);

export function createMcpServer() {
  const server = new McpServer({ name: SITE_NAME, version: MCP_SERVER_VERSION });

  const { name: searchName, ...search } = SEARCH_TOOL;
  server.registerTool(
    searchName,
    { ...search, annotations: READ_ONLY },
    async (filters) => {
      try {
        const result = await searchProperties(filters);
        const applied = describeFilters(filters).map((c) => c.label);
        const header = `${describeResultCount(result)}. Filters: ${applied.join(", ") || "none"}.`;
        logToolCall(searchName, `${result.items.length} results; ${applied.join(", ") || "no filters"}`);
        return {
          content: [{ type: "text", text: [header, ...result.items.map(summaryText)].join("\n\n") }],
          structuredContent: {
            results: result.items.map(toSummaryView),
            resultCount: result.items.length,
            capped: result.capped,
            appliedFilters: applied,
          },
        };
      } catch (error) {
        return toolError("mcp.search_properties", error);
      }
    },
  );

  const { name: detailName, ...detail } = DETAIL_TOOL;
  server.registerTool(
    detailName,
    { ...detail, annotations: READ_ONLY },
    async ({ id }) => {
      try {
        const p = await getProperty(id);
        logToolCall(detailName, `${id} ${p ? "found" : "not found"}`);
        if (!p) return { isError: true, content: [{ type: "text", text: `No listing found with ID ${id}.` }] };
        const live = isLive(p.availability);
        return {
          content: [{ type: "text", text: detailText(p) }],
          structuredContent: {
            ...toSummaryView(p),
            summary: listingSummary(p),
            price: live ? formatPriceLine(p.price) : "Not shown (listing no longer available)",
            priceAmount: live ? p.price.amount : null,
            section: p.section,
            status: listingStatusLabel(p.section, p.availability),
            pricePeriod: p.price.period,
            facts: detailFactItems(p),
            photoCount: mediaOfKind(p.media, "photo").length,
            floorplanCount: mediaOfKind(p.media, "floorplan").length,
            agent: {
              organisation: p.agent.organisation,
              name: p.agent.name,
              telephone: p.agent.telephone,
              email: p.agent.email,
              officeAddress: p.agent.officeAddress,
            },
            closedOn: p.closedOn,
            description: p.description,
          },
        };
      } catch (error) {
        return toolError("mcp.get_property", error);
      }
    },
  );

  return server;
}
