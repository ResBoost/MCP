#!/usr/bin/env bash
# Copy the public MCP server's source from the Resboost app into src/.
# The MCP layer and the formatters that shape its output only: the LonRes client, database, auth,
# admin and environment config are private and never copied.
# Usage: scripts/sync-from-resboost.sh [path to the Resboost app, default ../AIBoost]
set -euo pipefail
cd "$(dirname "$0")/.."
APP="${1:-../AIBoost}"
[ -f "$APP/src/server/mcp/server.ts" ] || { echo "Resboost app not found at $APP" >&2; exit 1; }

FILES=(
    "src/app/api/mcp/route.ts"
    "src/app/.well-known/mcp/server.json/route.ts"
    "src/app/.well-known/ai-catalog.json/route.ts"
    "src/app/(site)/mcp/server-card/route.ts"
    "src/server/mcp/server.ts"
    "src/server/mcp/discovery.ts"
    "src/lib/mcp/assistants.ts"
    "src/lib/property/constants.ts"
    "src/lib/property/filters.ts"
    "src/lib/property/format.ts"
    "src/lib/property/ids.ts"
    "src/lib/property/present.ts"
    "src/lib/property/types.ts"
    "src/lib/property/urls.ts"
)

rm -rf src
for f in "${FILES[@]}"; do
    mkdir -p "$(dirname "$f")"
    cp "$APP/$f" "$f"
done

# Guard: no secrets, private hosts or environment values may slip in
PRIVATE='lonres\.dev|feeds_api|process\.env|API_KEY|SECRET|PASSWORD|AUTH_'
if grep -rlE "$PRIVATE" src | grep -q .; then
    echo "Refusing: a copied file mentions something private" >&2
    grep -rnE "$PRIVATE" src >&2
    exit 1
fi
echo "Synced $(find src -name '*.ts' | wc -l | tr -d ' ') files from $APP"
