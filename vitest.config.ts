import { defineConfig } from 'vitest/config';

// Standalone test config so Vitest does NOT load vite.config.ts (PWA plugin).
// Node environment is enough: tests only touch pure functions in src/utils.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
