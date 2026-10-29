import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addWebMetadata } from '../scripts/postprocess-web.mjs';

test('static export provides private-data-free OG before scripts and an actual PNG', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'predikt-og-'));
  try {
    await writeFile(join(dir, 'index.html'), '<html><head><title>Old</title><script src="/app.js"></script></head><body><div id="root"></div></body></html>');
    await addWebMetadata(dir, 'http://127.0.0.1:8221');
    const html = await readFile(join(dir, 'index.html'), 'utf8');
    assert(html.indexOf('property="og:title"') < html.indexOf('<script'));
    assert.match(html, /og:image" content="http:\/\/127\.0\.0\.1:8221\/og.png/);
    assert.match(html, /<div id="root"><\/div>/);
    assert(!/forwardedBy|joinCode|coordinates|latitude|longitude/.test(html));
    assert.deepEqual([...((await readFile(join(dir, 'og.png'))).subarray(0, 8))], [137, 80, 78, 71, 13, 10, 26, 10]);
    await addWebMetadata(dir, 'http://127.0.0.1:8221');
    assert.equal(await readFile(join(dir, 'index.html'), 'utf8'), html, 'postprocessing is repeatable');
    await assert.rejects(addWebMetadata(dir, 'https://user:secret@example.com'), /HTTPS origin/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Vercel SPA rewrite excludes preview image and Expo assets but preserves invite routes', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const route = new RegExp(`^${config.rewrites[0].source}$`);
  for (const path of ['/', '/join', '/join/AB123', '/room/room-id']) assert(route.test(path));
  for (const path of ['/og.png', '/_expo/static/app.js', '/assets/icon.png']) assert(!route.test(path));
});
