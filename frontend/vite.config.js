import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

// Custom plugin: after build, copy index.html → 404.html
// Vercel serves 404.html for any route that doesn't match a real file,
// so React Router will load and handle client-side routing on refresh.
const spa404Fallback = () => ({
  name: 'spa-404-fallback',
  closeBundle() {
    const outDir = resolve(__dirname, 'dist')
    try {
      copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'))
      console.log('✅ Copied index.html → 404.html (SPA fallback for Vercel)')
    } catch (e) {
      console.warn('⚠️  Could not copy 404.html fallback:', e.message)
    }
  }
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    spa404Fallback(),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
