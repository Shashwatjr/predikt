import { createServer } from 'node:http';
import { register } from 'node:module';

register(new URL('../../tests/resolve-ts.mjs', import.meta.url), import.meta.url);
const htmlModule = await import('./invitePreviewHtml.ts');
const port = Number(process.env.INVITE_PREVIEW_PORT || 8096);
const host = '127.0.0.1';

const server = createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${host}:${port}`);
  const code = requestUrl.searchParams.get('joinCode') || 'LOCAL1';
  const forwardedBy = requestUrl.searchParams.get('forwardedBy');
  const html = htmlModule.buildInvitePreviewDocument({
    inviteCode: code,
    webBaseUrl: `http://${host}:${port}`,
    forwardedBy,
  });
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
});

server.listen(port, host, () => {
  process.stdout.write(`invite-preview http://${host}:${port}\n`);
});
