import { defineConfig } from 'vitest/config';
export default defineConfig({ resolve: { alias: { '@': new URL('../src', import.meta.url).pathname } }, test: { include: ['tests/scheduler-drop.test.ts','tests/cleanup-handlers.test.ts','tests/draft-fields.test.ts','tests/driver-assignment-notice.test.ts'], environment: 'node' } });
