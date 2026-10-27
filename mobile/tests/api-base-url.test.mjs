import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';

register('./resolve-ts.mjs', import.meta.url);

const { PRODUCTION_WEB_API_BASE_URL, resolveApiBaseUrl } = await import('../src/services/apiBaseUrl.ts');

test('local web uses an explicit API override and otherwise stays on localhost:3000', () => {
  assert.equal(
    resolveApiBaseUrl('http://127.0.0.1:3400', {
      platform: 'web',
      hostname: 'localhost',
      fallback: 'http://localhost:3000',
    }),
    'http://127.0.0.1:3400',
  );
  assert.equal(
    resolveApiBaseUrl(undefined, {
      platform: 'web',
      hostname: '127.0.0.1',
      fallback: 'http://localhost:3000',
    }),
    'http://localhost:3000',
  );
});

test('hosted web keeps the production API', () => {
  assert.equal(
    resolveApiBaseUrl('http://127.0.0.1:3400', {
      platform: 'web',
      hostname: 'predikt-alpha.vercel.app',
      fallback: 'http://localhost:3000',
    }),
    PRODUCTION_WEB_API_BASE_URL,
  );
});


test('explicit preview build uses same-origin API and fails closed on origin mismatch', () => {
  const options = { platform: 'web', hostname: 'preview.example.test', origin: 'https://preview.example.test',
    previewWebOrigin: 'https://preview.example.test', fallback: 'http://localhost:3000' };
  assert.equal(resolveApiBaseUrl(PRODUCTION_WEB_API_BASE_URL, options), 'https://preview.example.test/api');
  assert.throws(() => resolveApiBaseUrl(undefined, { ...options, origin: 'https://other.example.test' }), /exact configured/);
  assert.throws(() => resolveApiBaseUrl(undefined, { ...options, previewWebOrigin: 'https://myprediktion.com', origin: 'https://myprediktion.com' }), /exact configured/);
});
