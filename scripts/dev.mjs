import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(process.cwd())
const port = Number(process.env.PORT || 4173)
const host = process.env.HOST || '127.0.0.1'
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
}

function resolvePath(pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0])
  const safe = normalize(decoded).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
  const candidates = safe
    ? [join(root, safe), join(root, 'public', safe)]
    : [join(root, 'index.html')]

  for (const candidate of candidates) {
    if (candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return join(root, 'index.html')
}

createServer((request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    const file = resolvePath(url.pathname)
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    })
    createReadStream(file).pipe(response)
  } catch (error) {
    console.error(error)
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Internal server error')
  }
}).listen(port, host, () => {
  console.log(`Tail Room development server: http://${host}:${port}`)
})
