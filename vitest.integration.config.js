import { defineConfig } from 'vitest/config'

// App flows against seeded emulators, run inside `firebase emulators:exec`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.js'],
    testTimeout: 30000,
    fileParallelism: false,
    env: { VITE_USE_EMULATORS: 'true' },
  },
})
