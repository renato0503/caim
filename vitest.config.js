import { defineConfig } from 'vitest/config';

// Config isolada do Vite (sem plugin PWA): testes unitários rodam em Node.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.spec.js'],
    setupFiles: ['src/test/setup.js'],
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
});