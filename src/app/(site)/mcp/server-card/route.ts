import { discoveryResponse, serverCard } from "~/server/mcp/discovery";

export const dynamic = "force-static";

/** The MCP server card (linked from /mcp and /.well-known/ai-catalog.json). */
export function GET() {
  return discoveryResponse(serverCard(), "application/mcp-server-card+json");
}
