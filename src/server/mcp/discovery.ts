import "server-only";

import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";

import { MCP_ENDPOINT_PATH, MCP_PATH, SITE_NAME } from "~/lib/site";
import { absoluteUrl } from "~/server/urls";
import { MCP_SERVER_VERSION } from "./server";

/*
 * Machine-readable descriptions of the MCP server, linked from the /mcp page's developer card:
 *   /mcp/server-card               server card (application/mcp-server-card+json)
 *   /.well-known/mcp/server.json   MCP Registry server.json, for registries and clients
 *   /.well-known/ai-catalog.json   catalogue pointing at the server card
 */

/** Reverse-DNS name, as the MCP Registry expects for a server on its own domain. */
const SERVER_NAME = "ai.resboost/homes";
const TITLE = `${SITE_NAME} London homes`;
const DESCRIPTION =
  "Search live London homes for sale and read full listings, straight from the estate agents marketing them (LonRes). Read-only, free, no sign-in.";

export const SERVER_CARD_PATH = `${MCP_PATH}/server-card`;
export const REGISTRY_PATH = "/.well-known/mcp/server.json";
export const AI_CATALOG_PATH = "/.well-known/ai-catalog.json";

const icons = () => [{ src: absoluteUrl("/icon.svg"), mimeType: "image/svg+xml", sizes: ["any"] }];

export function serverCard() {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: SERVER_NAME,
    version: MCP_SERVER_VERSION,
    title: TITLE,
    description: DESCRIPTION,
    websiteUrl: absoluteUrl("/"),
    icons: icons(),
    remotes: [
      {
        type: "streamable-http",
        url: absoluteUrl(MCP_ENDPOINT_PATH),
        supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      },
    ],
  };
}

export function registryServer() {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: SERVER_NAME,
    title: TITLE,
    description: DESCRIPTION,
    version: MCP_SERVER_VERSION,
    websiteUrl: absoluteUrl(MCP_PATH),
    icons: icons(),
    remotes: [{ type: "streamable-http", url: absoluteUrl(MCP_ENDPOINT_PATH) }],
  };
}

export function aiCatalog() {
  const host = new URL(absoluteUrl("/")).hostname;
  return {
    specVersion: "1.0",
    entries: [
      {
        identifier: `urn:air:${host}:mcp:homes`,
        type: "application/mcp-server-card+json",
        url: absoluteUrl(SERVER_CARD_PATH),
      },
    ],
  };
}

/** JSON with a day's caching and CORS open, so browser-based tools can read it too. */
export const discoveryResponse = (body: unknown, contentType = "application/json") =>
  new Response(`${JSON.stringify(body, null, 2)}\n`, {
    headers: {
      "content-type": `${contentType}; charset=utf-8`,
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      "access-control-allow-origin": "*",
    },
  });
