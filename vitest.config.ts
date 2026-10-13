import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
const local = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  resolve: { alias: [
    ...["env", "lib/site", "server/urls", "server/lonres/client", "server/lonres/service"].map((name) => ({
      find: `~/${name}`, replacement: local(`./tests/stubs/${name.split("/").at(-1)}.ts`),
    })),
    { find: "server-only", replacement: local("./tests/stubs/server-only.ts") },
    { find: "~", replacement: local("./src") },
  ] },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
