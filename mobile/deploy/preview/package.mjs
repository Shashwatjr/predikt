import { mkdir, readFile, writeFile, cp, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
const [exportDir, outputDir] = process.argv.slice(2);
if (!exportDir || !outputDir || !process.env.EXPO_PUBLIC_PREVIEW_WEB_ORIGIN) throw Error('Usage: EXPO_PUBLIC_PREVIEW_WEB_ORIGIN=... node deploy/preview/package.mjs EXPORT_DIR OUTPUT_DIR');
const origin = new URL(process.env.EXPO_PUBLIC_PREVIEW_WEB_ORIGIN);
if (origin.origin !== process.env.EXPO_PUBLIC_PREVIEW_WEB_ORIGIN) throw Error('Origin only, no path');
const local = ['localhost','127.0.0.1'].includes(origin.hostname);
if (!(origin.protocol === 'https:' || (local && origin.protocol === 'http:')) ||
    /myprediktion\.com$|predikt-api-676327407919/.test(origin.hostname)) throw Error('Dedicated non-production origin required');
const jsFiles = await readdir(resolve(exportDir, '_expo/static/js/web'));
const bundles = await Promise.all(jsFiles.filter(f => f.endsWith('.js')).map(f => readFile(resolve(exportDir, '_expo/static/js/web', f), 'utf8')));
if (!bundles.some(text => text.includes('previewWebOrigin:' + JSON.stringify(origin.origin)))) throw Error('Export does not contain the configured preview origin; rebuild with --clear');
const output = resolve(outputDir);
if (output === resolve(exportDir) || output.startsWith(resolve(exportDir) + '/')) throw Error('Output must be outside export directory');
try { await stat(output); throw Error('Output already exists; choose a fresh package directory'); }
catch (e) { if (e.code !== 'ENOENT') throw e; }
await mkdir(output + '/lib', { recursive: true });
await cp(resolve(exportDir), output + '/public', { recursive: true });
for (const [name, path] of [['shareCard','share/shareCard'], ['invitePreviewHtml','share/invitePreviewHtml'], ['inviteRouting','navigation/inviteRouting']]) {
  const source = await readFile(resolve('src/' + path + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace("from './shareCard'", "from './shareCard.mjs'");
  await writeFile(output + '/lib/' + name + '.mjs', compiled);
}
await cp(new URL('./server.mjs', import.meta.url), output + '/server.mjs');
const index = await readFile(output + '/public/index.html');
const files = {};
for (const path of (await readdir(output, { recursive: true })).sort()) {
  if (path === 'manifest.json') continue;
  try { files[path] = createHash('sha256').update(await readFile(resolve(output, path))).digest('hex'); }
  catch (e) { if (e.code !== 'EISDIR') throw e; }
}
const manifest = { files, webOrigin: origin.origin, indexSha256: createHash('sha256').update(index).digest('hex'), runtime: 'node >=24', apiMode: 'same-origin /api; explicit nonproduction upstream required' };
await writeFile(output + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('Prepared preview package: ' + output);
