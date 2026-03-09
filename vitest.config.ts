import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
          environment: 'node',
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.integration.test.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup-integration.ts'],
        },
      },
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './') },
  },
})
