import { discoveryResponse, registryServer } from "~/server/mcp/discovery";

export const dynamic = "force-static";

/** MCP Registry server.json for the MCP server, at its well-known address. */
export function GET() {
  return discoveryResponse(registryServer());
}
