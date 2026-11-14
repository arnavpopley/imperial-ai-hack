import { defineConfig } from 'vitest/config';

// Tests always run offline: agents take their deterministic paths and no model is called.
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], env: { MODULEMATCH_OFFLINE: '1' } } });
