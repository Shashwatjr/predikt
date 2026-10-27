import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInvitePreviewDocument } from './lib/invitePreviewHtml.mjs';
import { parseInviteTarget } from './lib/inviteRouting.mjs';

export function createPreviewServer({ root, webOrigin, apiOrigin }) {
  const web = new URL(webOrigin), api = new URL(apiOrigin);
  for (const u of [web, api]) {
    if (u.origin !== u.href.replace(/\/$/, '') || u.username || u.password ||
        !(u.protocol === 'https:' || (['localhost', '127.0.0.1'].includes(u.hostname) && u.protocol === 'http:'))) throw Error('Explicit HTTPS origins required (HTTP only on loopback)');
    if (/myprediktion\.com$|predikt-api-676327407919/.test(u.hostname)) throw Error('Production origins forbidden in preview package');
  }
  root = resolve(root);
  const csp = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' data: https:; connect-src 'self' https://*.googleapis.com https://*.gstatic.com https://*.tile.openstreetmap.org https://nominatim.openstreetmap.org; worker-src 'self' blob:";
  return createServer(async (req, res) => {
    // Never log query strings, Authorization headers, response bodies or coordinates.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(), usb=()');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Cache-Control', 'no-store');
    try {
      const url = new URL(req.url ?? '/', webOrigin);
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
        if (req.headers.origin && req.headers.origin !== web.origin) { res.writeHead(403).end(); return; }
        if (req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403).end(); return; }
        const upstream = new URL(api.origin + url.pathname.slice(4) + url.search);
        const headers = {};
        for (const name of ['authorization', 'content-type', 'accept', 'origin']) if (req.headers[name]) headers[name] = req.headers[name];
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 1024 * 1024) { res.writeHead(413).end(); return; } chunks.push(chunk); }
        const response = await fetch(upstream, { method: req.method, headers,
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
          redirect: 'manual', signal: AbortSignal.timeout(15000) });
        // Never relay upstream redirects to a different host or cache authenticated data.
        if (response.status >= 300 && response.status < 400) { res.writeHead(502).end(); return; }
        res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
        res.writeHead(response.status).end(Buffer.from(await response.arrayBuffer())); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok","app":"predikt-preview-web"}'); return; }
      const path = resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!path.startsWith(root + sep) && path !== root) { res.writeHead(404).end(); return; }
      const mime = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };
      if (extname(path) && !['.html'].includes(extname(path))) {
        let bytes; try { bytes = await readFile(path); } catch { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', mime[extname(path)] ?? 'application/octet-stream');
        if (url.pathname.startsWith('/_expo/static/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.writeHead(200).end(req.method === 'HEAD' ? undefined : bytes); return;
      }
      let html = await readFile(resolve(root, 'index.html'), 'utf8');
      const { joinCode } = parseInviteTarget(url.pathname + url.search);
      if (joinCode) {
        // Generic metadata only: no room fetch, private title/location, user identity,
        // reward amounts, credentials, or client-supplied descriptive query fields.
        const document = buildInvitePreviewDocument({ inviteCode: joinCode, webBaseUrl: web.origin });
        const head = document.match(/<head>([\s\S]*?)<\/head>/)[1];
        html = html.replace(/<title>[\s\S]*?<\/title>/i, '').replace('<head>', '<head>' + head);
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.writeHead(200).end(req.method === 'HEAD' ? undefined : html);
    } catch { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); res.end('{"error":"Preview request failed"}'); }
  });
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
  if (process.env.PREVIEW_WEB_ORIGIN !== manifest.webOrigin) throw Error('Runtime origin must match package build origin');
  const server = createPreviewServer({ root: fileURLToPath(new URL('./public', import.meta.url)),
    webOrigin: manifest.webOrigin, apiOrigin: process.env.PREVIEW_API_ORIGIN });
  server.listen(Number(process.env.PORT ?? 8080), process.env.PREVIEW_BIND_HOST ?? '127.0.0.1');
}
