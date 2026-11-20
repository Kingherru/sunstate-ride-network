import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/provider-overview-activity.test.ts'], environment: 'node' } });