import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/finance-app/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Finance',
        short_name: 'Finance',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/finance-app/',
        scope: '/finance-app/',
        icons: [
          { src: '/finance-app/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/finance-app/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/finance-app/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
