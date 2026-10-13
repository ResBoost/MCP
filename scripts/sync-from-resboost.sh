#!/usr/bin/env bash
# Stage and validate the public source before replacing this repo's snapshot.
# Usage: scripts/sync-from-resboost.sh [path to the Resboost app, default ../Resboost]
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-$REPO/../Resboost}"
APP="$(cd "$APP" && pwd)"
cd "$REPO"
[ "$APP" != "$REPO" ] || { echo "Source must be the parent app, not this repo" >&2; exit 1; }
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
for f in "${FILES[@]}"; do
    [ -f "$APP/$f" ] && [ ! -L "$APP/$f" ] || { echo "Missing or symlinked source file: $f" >&2; exit 1; }
done
STAGE="$(mktemp -d "$REPO/.sync-XXXXXX")"
cleanup() {
    # Restore the old snapshot if installing the staged directory failed.
    if [ -d "$STAGE/previous" ] && [ ! -d "$REPO/src" ]; then
        mv "$STAGE/previous" "$REPO/src"
    fi
    rm -rf "$STAGE"
}
trap cleanup EXIT
for f in "${FILES[@]}"; do
    mkdir -p "$STAGE/$(dirname "$f")"
    cp "$APP/$f" "$STAGE/$f"
done
node scripts/check-release.mjs --source "$STAGE/src"
if [ -d src ]; then mv src "$STAGE/previous"; fi
mv "$STAGE/src" src
echo "Synced ${#FILES[@]} public source files"
