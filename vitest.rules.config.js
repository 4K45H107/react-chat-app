import { defineConfig } from 'vitest/config'

// Firestore rules tests, run inside `firebase emulators:exec`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 20000,
    fileParallelism: false,
  },
})
