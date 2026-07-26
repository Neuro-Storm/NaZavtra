import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { join } from 'path'
import { homedir } from 'os'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import nazavtraMCP from './vite-plugin-nazavtra-mcp.js'

const settingsPath = join(homedir(), '.nazavtra', 'settings.json')
let serverPort = 5174
try {
  if (existsSync(settingsPath)) {
    const s = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    if (s.port && !isNaN(s.port)) serverPort = s.port
  }
} catch {}

if (process.argv.includes('--host')) {
  console.warn('\n  \x1b[33m\u26A0\uFE0F  WARNING: Server is exposed to network (--host)')
  console.warn('  \u26A0\uFE0F  MCP API and data are accessible to everyone on the LAN\x1b[0m\n')
}

export default defineConfig({
  base: '/NaZavtra/',
  server: { port: serverPort },
  plugins: [
    vue(),
    nazavtraMCP(),
    {
      name: 'exit-command',
      configureServer(server) {
        server.middlewares.use('/api/exit', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'text/plain')
            res.end('Method not allowed')
            return
          }

          const origin = req.headers.origin || ''
          if (origin && !origin.startsWith('http://localhost:')) {
            res.statusCode = 403
            res.setHeader('Content-Type', 'text/plain')
            res.end('Forbidden')
            return
          }

          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', () => {
            try {
              const d = JSON.parse(body)
              if (d.confirm !== true) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'text/plain')
                res.end('Bad request')
                return
              }
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'text/plain')
              res.end('Bad request')
              return
            }

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!doctype html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>НаЗавтра — закрыто</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;background:#1a1b1e;color:#e9ecef;text-align:center}p{font-size:1.2rem;opacity:.7}</style>
</head><body><p>Приложение закрыто. Можете закрыть вкладку.</p></body></html>`)
            setTimeout(() => process.exit(0), 500)
          })
        })
      },
    },
    {
      name: 'update-command',
      configureServer(server) {
        server.middlewares.use('/api/update', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'text/plain')
            res.end('Method not allowed')
            return
          }

          const origin = req.headers.origin || ''
          if (origin && !origin.startsWith('http://localhost:')) {
            res.statusCode = 403
            res.setHeader('Content-Type', 'text/plain')
            res.end('Forbidden')
            return
          }

          let pullOutput = ''
          try {
            pullOutput = execSync('git pull', { timeout: 30000, encoding: 'utf-8' })
          } catch {}

          const serverFiles = ['vite.config.js', 'vite-plugin-nazavtra-mcp.js', 'package.json', 'package-lock.json']
          const needsRestart = serverFiles.some(f => pullOutput.includes(f))

          if (needsRestart) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!doctype html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>НаЗавтра — обновление</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;background:#1a1b1e;color:#e9ecef;text-align:center}p{font-size:1.2rem;opacity:.7}</style>
</head><body><p>Обновление требует перезапуска. Выполните: npm run dev</p></body></html>`)
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!doctype html>
<html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>НаЗавтра — обновление</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100dvh;margin:0;background:#1a1b1e;color:#e9ecef;text-align:center}p{font-size:1.2rem;opacity:.7}</style>
</head><body><p>Обновление загружено. Обновите страницу.</p></body></html>`)
          }
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
