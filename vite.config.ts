// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from 'vite';
import type { ConfigEnv } from 'vite';
import path from 'node:path';
import { mcpPlugin } from '@lovable.dev/mcp-js/stacks/tanstack/vite';

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default (env: ConfigEnv) => {
  const { mode } = env;
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return defineConfig({
    vite: {
      plugins: [mcpPlugin()],
      resolve: { alias: {
        'entities/lib/decode.js': path.resolve(process.cwd(), 'node_modules/entities/lib/decode.js'),
        'entities/lib/encode.js': path.resolve(process.cwd(), 'node_modules/entities/lib/encode.js'),
        entities: path.resolve(process.cwd(), 'node_modules/entities'),
      } },
    },
  tanstackStart: {
    server: { entry: "server" },
  },
  })(env);
};
