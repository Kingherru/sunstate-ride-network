import {defineConfig} from 'vitest/config';
import {fileURLToPath} from 'node:url';
export default defineConfig({resolve:{alias:{'@':fileURLToPath(new URL('../src',import.meta.url))}},test:{include:['tests/pass5b-regional.test.ts','tests/trip-series.test.ts'],environment:'node'}});