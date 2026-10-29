import { buildInviteShareCard, type ShareCard } from './shareCard';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildInvitePreviewHtml(card: ShareCard) {
  const title = escapeHtml(card.title);
  const description = escapeHtml('Exact location is hidden.');
  const url = escapeHtml(card.url);
  const image = escapeHtml(new URL('/og.png', card.url).href);
  const body = escapeHtml(card.text);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${description}">
</head>
<body>
<p>${body}</p>
</body>
</html>
`;
}

export function buildInvitePreviewDocument(input: {
  inviteCode: string;
  webBaseUrl: string;
  forwardedBy?: string | null;
}) {
  return buildInvitePreviewHtml(
    buildInviteShareCard({
      inviteCode: input.inviteCode,
      webBaseUrl: input.webBaseUrl,
    }),
  );
}
