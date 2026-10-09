import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves this repository below /enigma/.
  base: process.env.GITHUB_ACTIONS ? '/enigma/' : '/',
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
