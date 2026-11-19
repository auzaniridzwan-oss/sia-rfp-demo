import { defineConfig } from 'vitest/config';

// Unit tests only; e2e/ is Playwright (pnpm smoke).
export default defineConfig({
  test: { include: ['packages/**/src/**/*.test.ts'] },
});
