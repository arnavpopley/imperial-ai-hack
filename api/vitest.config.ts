import { defineConfig } from 'vitest/config';

// Tests always run offline (agents take their deterministic paths) against a private in-memory database.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], env: { MODULEMATCH_OFFLINE: '1', DATABASE_PATH: ':memory:' } },
});
