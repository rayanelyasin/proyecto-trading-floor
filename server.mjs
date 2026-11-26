// Servidor estático de Pulso con Node (sin dependencias, sin permisos de administrador).
// Escucha en todas las interfaces para abrir el campus desde el teléfono en la misma red Wi-Fi.
// Uso: node server.mjs [puerto]   (por defecto 5173)
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 5173);
const dataFile = path.join(root, 'data', 'campus.json');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary',
  '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8',
};

async function body(req, limit = 300_000) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new Error('grande'); chunks.push(c); }
  return Buffer.concat(chunks);
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/__campus') {
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'GET') {
        const txt = await fs.readFile(dataFile, 'utf8').catch(() => '{"places":[]}');
        res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(txt);
      }
      if (req.method === 'POST') {
        const data = JSON.parse((await body(req)).toString('utf8'));
        if (!Array.isArray(data.places) || data.places.length > 100) { res.writeHead(400); return res.end('datos no válidos'); }
        await fs.mkdir(path.dirname(dataFile), { recursive: true });
        await fs.writeFile(dataFile, JSON.stringify({ places: data.places, savedAt: Date.now() }));
        res.writeHead(200); return res.end('ok');
      }
    }
    if (req.method === 'POST' && url.pathname === '/__save') { // herramienta local de desarrollo (solo /assets)
      const dest = path.resolve(root, url.searchParams.get('path') || '');
      if (!dest.startsWith(path.join(root, 'assets'))) { res.writeHead(403); return res.end('no'); }
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, await body(req, 100_000_000)); res.writeHead(200); return res.end('ok');
    }
    let rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const file = path.resolve(root, rel);
    if (!file.startsWith(root) || file.startsWith(path.join(root, 'data')) || file.startsWith(path.join(root, '.git'))) { res.writeHead(404); return res.end('404'); }
    const buf = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end(e.code === 'ENOENT' ? '404' : 'error');
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Pulso en http://localhost:${port}`);
  for (const list of Object.values(os.networkInterfaces())) for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`Desde el teléfono (misma red): http://${i.address}:${port}`);
});
