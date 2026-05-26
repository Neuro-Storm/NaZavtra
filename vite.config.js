import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import nazavtraMCP from './vite-plugin-nazavtra-mcp.js'

export default defineConfig({
  base: '/NaZavtra/',
  plugins: [
    vue(),
    nazavtraMCP(),
    {
      name: 'exit-command',
      configureServer(server) {
        server.middlewares.use('/api/exit', (_req, res) => {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(`<!doctype html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>НаЗавтра — закрыто</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;background:#1a1b1e;color:#e9ecef;text-align:center}p{font-size:1.2rem;opacity:.7}</style>
</head><body><p>Приложение закрыто. Можете закрыть вкладку.</p></body></html>`)
          setTimeout(() => process.exit(0), 500)
        })
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'НаЗавтра',
        short_name: 'НаЗавтра',
        description: 'Список задач на завтра',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icons.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: 'icons.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
})
