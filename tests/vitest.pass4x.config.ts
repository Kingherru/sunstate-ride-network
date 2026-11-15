import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/pass4x-rules.test.ts'],environment:'node'}});