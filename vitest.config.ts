import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const alias = { '@': path.resolve(__dirname, './') }

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'unit',
          include: [
            'app/**/*.test.ts',
            'app/**/*.test.tsx',
            'lib/**/*.test.ts',
            'lib/**/*.test.tsx',
            'components/**/*.test.ts',
            'components/**/*.test.tsx',
            '*.test.ts',
            '*.test.tsx',
          ],
          environment: 'node',
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.integration.test.ts'],
          environment: 'node',
          setupFiles: ['./tests/setup-integration.ts'],
        },
      },
    ],
  },
})
