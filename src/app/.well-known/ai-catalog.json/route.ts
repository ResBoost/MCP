import { aiCatalog, discoveryResponse } from "~/server/mcp/discovery";

export const dynamic = "force-static";

/** Catalogue of this site's AI-facing services: the MCP server card. */
export function GET() {
  return discoveryResponse(aiCatalog());
}
