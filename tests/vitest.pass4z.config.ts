import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/pass4z-rules.test.ts','tests/pass4y-rules.test.ts','tests/pass4x-rules.test.ts'],environment:'node'}});