// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from 'vite';
import path from 'node:path';

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
// MCP server intentionally disabled (see AGENTS.md). To rebuild: re-add
// @lovable.dev/mcp-js + mcpPlugin() and restore the archived src/lib/mcp.
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    vite: {
      resolve: { alias: {
        'entities/lib/decode.js': path.resolve(process.cwd(), 'node_modules/entities/lib/decode.js'),
        'entities/lib/encode.js': path.resolve(process.cwd(), 'node_modules/entities/lib/encode.js'),
        entities: path.resolve(process.cwd(), 'node_modules/entities'),
      } },
    },
  tanstackStart: {
    server: { entry: "server" },
  },
  };
});
