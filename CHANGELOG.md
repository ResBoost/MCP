# Changelog

Versions match the `version` the server reports in its handshake and on its
[registry card](https://resboost.ai/.well-known/mcp/server.json).

## 0.2.0 — 2026-10

- Two public, read-only tools: `search_properties` and `get_property`.
- Both tools return typed structured content alongside text, with declared output schemas.
- Agent-written descriptions are labelled "not verified". Closed listings drop their price and contact details.
- Discovery: MCP Registry `server.json` at `/.well-known/mcp/server.json`, a server card at `/mcp/server-card`,
  and an AI catalogue at `/.well-known/ai-catalog.json`.
- Stateless streamable HTTP with host and origin checks (DNS-rebinding protection), a 64 KB request cap,
  and no JSON-RPC batches.
