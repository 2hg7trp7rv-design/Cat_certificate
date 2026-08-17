import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const root = resolve(process.cwd())
const port = Number(process.env.PORT || 4173)
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4'
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
    let pathname = decodeURIComponent(url.pathname)
    if (pathname === '/') pathname = '/index.html'

    const fullPath = normalize(join(root, pathname))
    if (!fullPath.startsWith(root)) throw new Error('Invalid path')

    const info = await stat(fullPath)
    const file = info.isDirectory() ? join(fullPath, 'index.html') : fullPath
    const data = await readFile(file)
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    })
    response.end(data)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Tail Room creator preview: http://127.0.0.1:${port}`)
})
