import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  }
} as any)
