import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Static, identical metadata for humans and crawlers. Never fetch a room or
// interpolate invite parameters, attribution, locations or user identities.
export async function addWebMetadata(outputDir, webOrigin = 'https://myprediktion.com') {
  const origin = new URL(webOrigin);
  const local = ['localhost', '127.0.0.1'].includes(origin.hostname);
  if (origin.username || origin.password || origin.search || origin.hash ||
      origin.pathname !== '/' || !(origin.protocol === 'https:' || (local && origin.protocol === 'http:'))) {
    throw new Error('Web base must be an HTTPS origin (HTTP allowed on loopback).');
  }
  const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  const image = escape(`${origin.origin}/og.png`);
  const title = 'MyPrediktion — Predict with friends';
  const description = 'Turn everyday journeys into friendly prediction challenges. Exact location is hidden in shared previews.';
  const path = resolve(outputDir, 'index.html');
  let html = await readFile(path, 'utf8');
  if (!/<\/head>/i.test(html)) throw new Error('Export has no HTML head');
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)=["'](?:description|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '');
  const tags = `<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MyPrediktion">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="980">
<meta property="og:image:height" content="400">
<meta property="og:image:alt" content="MyPrediktion crystal-ball logo">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
<meta name="twitter:image" content="${image}">
`;
  // Insert first in head, before Expo scripts; preserve the exported application.
  html = html.replace(/<head\b[^>]*>\s*/i, (head) => head.trimEnd() + '\n' + tags);
  await copyFile(new URL('../assets/logo-wordmark-ondark.png', import.meta.url), resolve(outputDir, 'og.png'));
  await writeFile(path, html);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await addWebMetadata(resolve(process.argv[2] ?? 'dist'),
    process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'https://myprediktion.com');
}
