const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
(async () => {
  const artifact = process.env.PREVIEW_PACKAGE_DIR;
  assert(artifact, 'Set PREVIEW_PACKAGE_DIR to the final artifact');
  const { createPreviewServer } = await import(pathToFileURL(artifact + '/server.mjs'));
  const server = createPreviewServer({ root: artifact + '/public', webOrigin: 'http://localhost:18790', apiOrigin: 'http://127.0.0.1:55438' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    for (const width of [390,1440]) {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width, height: 900 }, userAgent: 'facebookexternalhit/1.1' });
      const page = await context.newPage();
      for (const invite of ['PUBLIC','PRIVATE','GHOST']) {
        const response = await page.goto(base + '/join/' + invite + '?destination=PRIVATE_ADDRESS&creatorId=PRIVATE_HOST&latitude=12.345678');
        assert.equal(response.status(), 200);
        const html = await response.text();
        assert.equal((html.match(/property="og:title"/g) || []).length, 1);
        assert(html.indexOf('property="og:title"') < html.indexOf('<script'));
        assert(!/PRIVATE_ADDRESS|PRIVATE_HOST|12\.345678/.test(html));
        assert.equal(await page.locator('meta[property="og:image:type"]').getAttribute('content'), 'image/png');
        console.log('PASS generic crawler HTML preserves invite privacy', width, invite);
      }
      const png = await context.request.get(base + '/og.png');
      assert.equal(png.status(), 200); assert.match(png.headers()['content-type'], /^image\/png/);
      assert.deepEqual([...((await png.body()).subarray(0,8))], [137,80,78,71,13,10,26,10]);
      await page.goto(base + '/og.png');
      await page.locator('img').waitFor();
      console.log('PASS real PNG response and browser image', width);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
