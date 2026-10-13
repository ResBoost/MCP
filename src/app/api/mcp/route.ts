import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { env } from "~/env";
import { createMcpServer } from "~/server/mcp/server";

/** One tool call is a few hundred bytes; this leaves room while bounding abuse. */
const MAX_BODY_BYTES = 64 * 1024;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const rpcError = (status: number, code: number, message: string, headers?: HeadersInit) =>
  Response.json({ jsonrpc: "2.0", error: { code, message }, id: null }, { status, headers });

/**
 * DNS-rebinding protection: browsers always send Origin, so only this site (and localhost in
 * development) may call from a page. Non-browser MCP clients send no Origin and are allowed.
 */
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === new URL(env.NEXT_PUBLIC_SITE_URL).origin) return true;
  try {
    return env.NODE_ENV === "development" && LOCAL_HOSTS.has(new URL(origin).hostname);
  } catch {
    return false;
  }
}

/** Host allowlist (DNS rebinding): this site's host, plus localhost in development. */
function hostAllowed(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  if (host === new URL(env.NEXT_PUBLIC_SITE_URL).host) return true;
  return env.NODE_ENV === "development" && LOCAL_HOSTS.has(host.replace(/:\d+$/, ""));
}

/** Stateless Streamable HTTP: a fresh server per request, one JSON-RPC message per request. */
export async function POST(request: Request) {
  if (!hostAllowed(request)) return rpcError(403, -32000, "Host not allowed.");
  if (!originAllowed(request)) return rpcError(403, -32000, "Origin not allowed.");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES)
    return rpcError(413, -32600, "Request body too large.");

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return rpcError(413, -32600, "Request body too large.");

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return rpcError(400, -32700, "Parse error.");
  }
  // Batches would let one HTTP request fan out into many upstream searches.
  if (Array.isArray(body)) return rpcError(400, -32600, "Batch requests are not supported.");

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await createMcpServer().connect(transport);
  return transport.handleRequest(request, { parsedBody: body });
}

/** No sessions and no server-initiated stream in stateless mode. */
const methodNotAllowed = () => rpcError(405, -32000, "Method not allowed.", { Allow: "POST" });

export { methodNotAllowed as GET, methodNotAllowed as DELETE };
