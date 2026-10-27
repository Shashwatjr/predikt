import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const artifact = process.env.PREVIEW_PACKAGE_DIR;
assert(artifact, 'PREVIEW_PACKAGE_DIR must point to the actual packaged Expo artifact');
const { createPreviewServer } = await import(pathToFileURL(resolve(artifact, 'server.mjs')));
const listen = (s) => new Promise(r => s.listen(0, '127.0.0.1', r));
const close = (s) => new Promise(r => s.close(r));

test('actual preview package request path: OG before SPA, deep routes, proxy and privacy', async () => {
  const calls = [];
  const upstream = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ url: req.url, origin: req.headers.origin, auth: req.headers.authorization, body });
    if (req.url === '/redirect') { res.writeHead(302, { location: 'https://myprediktion.com' }).end(); return; }
    res.writeHead(req.url === '/missing' ? 404 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });
  await listen(upstream);
  const webOrigin = 'https://phase1-preview.example.test';
  const server = createPreviewServer({ root: resolve(artifact, 'public'), webOrigin,
    apiOrigin: `http://127.0.0.1:${upstream.address().port}` });
  await listen(server); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const path of ['/?joinCode=ab12', '/join?joinCode=%41B12', '/join/ab12']) {
      const response = await fetch(base + path + (path.includes('?') ? '&' : '?') + 'destination=PLANTED_PRIVATE_PLACE&token=PLANTED_SECRET&forwardedBy=untrusted');
      assert.equal(response.status, 200);
      const html = await response.text();
      assert(html.indexOf('property="og:title"') < html.indexOf('<script'));
      assert(html.includes('Exact location is hidden.'));
      assert(html.includes(webOrigin + '?joinCode=AB12'));
      assert(!/PLANTED_|untrusted|forwardedBy=/.test(html));
      assert.equal((html.match(/property="og:title"/g) ?? []).length, 1);
      const browserHtml = await (await fetch(base + path, { headers: { 'User-Agent': 'Browser' } })).text();
      const crawlerHtml = await (await fetch(base + path, { headers: { 'User-Agent': 'facebookexternalhit/1.1' } })).text();
      assert.equal(browserHtml, crawlerHtml);
      assert(response.headers.get('content-security-policy').includes("connect-src 'self'"));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    }
    assert.equal(calls.length, 0, 'OG must not fetch or disclose room data');
    for (const route of ['/RoomCreated?roomId=r', '/LiveRoom?roomId=r', '/Result?roomId=r', '/join?joinCode=invalid!']) {
      const response = await fetch(base + route); assert.equal(response.status, 200); assert((await response.text()).includes('<script'));
    }
    assert.equal((await fetch(base + '/_expo/static/missing.js')).status, 404);
    const response = await fetch(base + '/api/rooms/r/join', { method: 'POST',
      headers: { Origin: webOrigin, Authorization: 'Bearer local-test-marker', 'Content-Type': 'application/json' }, body: '{"forwardedBy":"local-id"}' });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(calls[0], { url: '/rooms/r/join', origin: webOrigin, auth: 'Bearer local-test-marker', body: '{"forwardedBy":"local-id"}' });
    assert.equal((await fetch(base + '/api/missing')).status, 404, 'API failures must not become SPA HTML');
    assert.equal((await fetch(base + '/api/redirect')).status, 502);
    assert.equal((await fetch(base + '/api/health', { headers: { Origin: 'https://untrusted.example.test' } })).status, 403);
    assert.equal((await fetch(base + '/api/health', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.throws(() => createPreviewServer({ root: artifact, webOrigin, apiOrigin: 'https://predikt-api-676327407919.asia-southeast1.run.app' }), /Production/);
  } finally { await close(server); await close(upstream); }
});
