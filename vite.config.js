import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// Libraries change far less often than app code, so each gets its own
// long-cached file. Firestore, Storage and the emoji picker are split off by
// their dynamic imports and load only when needed.
const vendorChunk = (id) => {
  if (!id.includes('node_modules')) return undefined
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
  if (/node_modules\/@firebase\/(app|auth|component|logger|util)\//.test(id)) {
    return 'firebase-core'
  }
  return undefined
}

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
  test: {
    environment: 'node',
    // Emulator suites: `npm run test:rules` and `npm run test:integration`
    exclude: ['**/node_modules/**', 'tests/rules/**', 'tests/integration/**'],
  },
})
