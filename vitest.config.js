import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.next/**',
      'apps/docs/**', // Exclude docs app tests (has its own config)
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'build/**',
        'coverage/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
      ],
    },
  },
})
