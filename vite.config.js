import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Emulator suites: `npm run test:rules` and `npm run test:integration`
    exclude: ['**/node_modules/**', 'tests/rules/**', 'tests/integration/**'],
  },
})
