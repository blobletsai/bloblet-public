import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@/src': resolve(rootDir, 'src'),
      '@/components': resolve(rootDir, 'components'),
      '@/types': resolve(rootDir, 'types')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['tests/setupEnv.ts'],
    globals: false
  }
})
