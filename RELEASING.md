# Publishing a release

The hosted service is deployed from the private Resboost app. This repository
publishes its public source and connection instructions; it is not an npm server package.

1. Apply MCP source changes to the parent app and run its typecheck and relevant tests.
   In particular, confirm closed-listing and address redaction in the private mapper.
2. Configure hosting request-rate and concurrency limits for `/api/mcp`, including
   a useful 429 response. This repo does not implement a distributed limiter.
   Confirm the hosting platform preserves the canonical `Host` header; the endpoint
   deliberately does not trust client-supplied `x-forwarded-host`.
3. Deploy the parent app. The canonical site URL must be `https://resboost.ai`.
4. Run `scripts/sync-from-resboost.sh` (defaults to `../Resboost`) and review the diff.
   The script stages an explicit file allowlist, scans it, and validates versions
   before replacing `src`. The scan is a basic safeguard, not a complete secret detector.
5. Run `npm ci`, `npm run check` and `npm run check:live`. Check a real assistant
   connection too. The isolated tests validate the public source with a fake service;
   they do not prove production access controls, upstream data handling or hosting limits.
6. Review tracked files and Git history with your organisation's secret scanner
   before making the repository public. Ensure GitHub private vulnerability reporting
   is enabled so the link in `SECURITY.md` works.
7. Update `MCP_SERVER_VERSION`, `server.json`, `package.json`, the lockfile and
   `CHANGELOG.md` together for a new server version. Confirm generated discovery
   metadata matches the static registry file. Publish a matching Git tag/release.

The MCP Registry requires a separate submission and namespace ownership verification;
serving `/.well-known/mcp/server.json` alone does not register the server.

## Checks provided here

- Typechecking of the public source and isolated harness.
- Real SDK initialization, notifications, tool discovery and tool execution.
- Text/structured output, invalid arguments, missing listings and safe error messages.
- Closed-listing contact and price redaction at the MCP boundary.
- Host/origin checks, body read failures, streaming byte limit, batches and unsupported methods.
- Snapshot sync failure safety, metadata consistency and README local links.
- Optional deployed handshake, search, detail and registry checks.

Test-only aliases in `vitest.config.ts` stand in for private app imports. They must
never be used in the production app. Dependencies are pinned to the reviewed SDK
1.32.1 and Zod 3.25.76; re-run the checks when upgrading the app's SDK or Zod.

Registry publication guide: https://modelcontextprotocol.io/registry/quickstart
