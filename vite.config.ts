import { resolve } from 'node:path'

import tailwind from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vitest/config'

// ttyd backend used by the dev server proxy
const TTYD_URL = 'http://localhost:7681'

export default defineConfig({
  publicDir: false,
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    assetsInlineLimit: Number.POSITIVE_INFINITY,
    chunkSizeWarningLimit: Number.POSITIVE_INFINITY
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src')
    }
  },
  plugins: [react(), tailwind(), viteSingleFile()],
  server: {
    port: 5173,
    proxy: {
      '/token': { target: TTYD_URL, changeOrigin: true },
      '/ws': { target: TTYD_URL, changeOrigin: true, ws: true }
    }
  },
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/App.tsx', 'src/lib/**/*.ts']
    }
  }
})
