/*
 * Rebuild the wordmark from the opaque dark-navy source:
 *   1. flood-fill the flat navy field from the borders -> real alpha
 *   2. clear enclosed navy pockets in the wordmark region (letter counters)
 *   3. crop to content
 *   4. emit brand-colour + on-dark (lightness-lifted, hue-preserving) variants
 */
const fs = require('fs'), zlib = require('zlib');

const path = require('path');
const ASSETS = path.join(__dirname, '..', 'assets');
const SRC = path.join(ASSETS, 'logo-wordmark-dark.png');
const OUT_BRAND = path.join(ASSETS, 'logo-wordmark.png');
const OUT_ONDARK = path.join(ASSETS, 'logo-wordmark-ondark.png');

const T_FLAT = 24;    // <= this distance from bg == flat background
const T_EDGE = 120;   // fringe ramp ceiling
const WORDMARK_X = 472 / 1228; // fraction of the *cropped* width where the wordmark begins
// Tallest in-app use is 74pt (Login/Register), so 400px covers @3x with headroom.
const OUT_HEIGHT = 400;

// ---------- png io ----------
function decodeRGB(file) {
  const b = fs.readFileSync(file);
  const W = b.readUInt32BE(16), H = b.readUInt32BE(20);
  if (b[24] !== 8 || b[25] !== 2) throw new Error('expected 8-bit RGB source');
  let o = 8; const idat = [];
  while (o < b.length) { const len = b.readUInt32BE(o); const t = b.toString('ascii', o + 4, o + 8); if (t === 'IDAT') idat.push(b.slice(o + 8, o + 8 + len)); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 3, stride = W * bpp, img = Buffer.alloc(H * stride); let p = 0;
  for (let y = 0; y < H; y++) {
    const f = raw[p++]; const line = raw.slice(p, p + stride); p += stride;
    const cur = img.slice(y * stride, (y + 1) * stride), prev = y > 0 ? img.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0; let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += bb; else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c); }
      cur[i] = v & 255;
    }
  }
  return { W, H, img, stride };
}
function crc32(buf) { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) r = t[(r ^ buf[i]) & 0xFF] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0; }
function chunk(ty, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(ty, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); }
/** Adaptive row filtering (try all 5, keep the lowest absolute-sum) — costs nothing
 *  at build time and roughly halves the encoded size versus filter 0 everywhere. */
function encodeRGBA(W, H, rgba) {
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  const bpp = 4, stride = W * bpp;
  const raw = Buffer.alloc(H * (stride + 1));
  const cand = Buffer.alloc(stride);
  for (let y = 0; y < H; y++) {
    const cur = rgba.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? rgba.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    let bestF = 0, bestSum = Infinity, best = null;
    for (let f = 0; f <= 4; f++) {
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let v;
        if (f === 0) v = cur[i];
        else if (f === 1) v = cur[i] - a;
        else if (f === 2) v = cur[i] - b;
        else if (f === 3) v = cur[i] - ((a + b) >> 1);
        else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = cur[i] - ((pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c)); }
        v &= 255; cand[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; bestF = f; best = Buffer.from(cand); }
    }
    raw[y * (stride + 1)] = bestF;
    best.copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Box-average downscale in premultiplied space so transparent pixels don't bleed colour. */
function downscale(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const fx = sw / dw, fy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * fy), y1 = Math.max(y0 + 1, Math.min(sh, Math.ceil((y + 1) * fy)));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * fx), x1 = Math.max(x0 + 1, Math.min(sw, Math.ceil((x + 1) * fx)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = (sy * sw + sx) * 4, al = src[i + 3] / 255;
        r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
      }
      const am = a / n, o = (y * dw + x) * 4;
      if (am > 0) {
        out[o] = Math.min(255, Math.round(r / n / am));
        out[o + 1] = Math.min(255, Math.round(g / n / am));
        out[o + 2] = Math.min(255, Math.round(b / n / am));
        out[o + 3] = Math.round(am * 255);
      }
    }
  }
  return out;
}

// ---------- colour ----------
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}
function hslToRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
}
const srgb = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = c => 0.2126 * srgb(c[0]) + 0.7152 * srgb(c[1]) + 0.0722 * srgb(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// ---------- 1. decode + background reference ----------
const { W, H, img, stride } = decodeRGB(SRC);
const at = (x, y) => y * stride + x * 3;
const ring = [[], [], []];
for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = at(x, y); ring[0].push(img[i]); ring[1].push(img[i + 1]); ring[2].push(img[i + 2]); }
for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = at(x, y); ring[0].push(img[i]); ring[1].push(img[i + 1]); ring[2].push(img[i + 2]); }
const bg = ring.map(a => a.sort((p, q) => p - q)[a.length >> 1]);
const dist = i => Math.abs(img[i] - bg[0]) + Math.abs(img[i + 1] - bg[1]) + Math.abs(img[i + 2] - bg[2]);
console.log('source', `${W}x${H}`, 'bg rgb', bg);

// ---------- 2. flood fill from the borders ----------
const outside = new Uint8Array(W * H);
const qx = new Int32Array(W * H), qy = new Int32Array(W * H);
let head = 0, tail = 0;
const push = (x, y) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const k = y * W + x;
  if (outside[k] || dist(at(x, y)) > T_FLAT) return;
  outside[k] = 1; qx[tail] = x; qy[tail] = y; tail++;
};
for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
while (head < tail) { const x = qx[head], y = qy[head]; head++; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
console.log('border-connected background:', `${(100 * tail / (W * H)).toFixed(1)}%`);

// ---------- 3. content bbox (needed to locate the wordmark region) ----------
let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!outside[y * W + x]) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
const wordmarkStartX = bx0 + Math.round((bx1 - bx0 + 1) * WORDMARK_X);
console.log('content bbox x', bx0, bx1, 'y', by0, by1, '| wordmark region starts at x =', wordmarkStartX);

// ---------- 4. clear enclosed navy pockets inside the wordmark ----------
let pockets = 0, pocketPx = 0;
const seen = new Uint8Array(W * H);
for (let y = by0; y <= by1; y++) for (let x = wordmarkStartX; x <= bx1; x++) {
  const k0 = y * W + x;
  if (outside[k0] || seen[k0] || dist(at(x, y)) > T_FLAT) continue;
  // gather this flat-navy component
  const comp = [k0]; seen[k0] = 1; let qi = 0;
  while (qi < comp.length) {
    const k = comp[qi++], cx = k % W, cy = (k - cx) / W;
    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (seen[nk] || outside[nk] || dist(at(nx, ny)) > T_FLAT) continue;
      seen[nk] = 1; comp.push(nk);
    }
  }
  for (const k of comp) outside[k] = 1;
  pockets++; pocketPx += comp.length;
}
console.log('enclosed letter-counter pockets cleared:', pockets, `(${pocketPx}px)`);

// ---------- 5. alpha with fringe ramp ----------
const alpha = new Uint8Array(W * H);
const nearOutside = (x, y, r) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    if (outside[ny * W + nx]) return true;
  }
  return false;
};
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const k = y * W + x;
  if (outside[k]) { alpha[k] = 0; continue; }
  const d = dist(at(x, y));
  alpha[k] = (d < T_EDGE && nearOutside(x, y, 2)) ? Math.round(255 * Math.min(1, d / T_EDGE)) : 255;
}

// ---------- 6. final crop ----------
let minx = W, miny = H, maxx = -1, maxy = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 8) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
const M = Math.round((maxx - minx + 1) * 0.02);
minx = Math.max(0, minx - M); maxx = Math.min(W - 1, maxx + M);
miny = Math.max(0, miny - M); maxy = Math.min(H - 1, maxy + M);
const cw = maxx - minx + 1, ch = maxy - miny + 1;
console.log('cropped to', `${cw}x${ch}`, 'aspect', (cw / ch).toFixed(4));

// ---------- 7. emit both variants ----------
function build(lift) {
  const out = Buffer.alloc(cw * ch * 4);
  const before = {}, after = {};
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const sx = minx + x, sy = miny + y, si = at(sx, sy), a = alpha[sy * W + sx], oi = (y * cw + x) * 4;
    if (a === 0) continue;
    let c = [0, 1, 2].map(k => {
      const v = a === 255 ? img[si + k] : bg[k] + (img[si + k] - bg[k]) * (255 / a);
      return Math.max(0, Math.min(255, Math.round(v)));
    });
    if (lift && sx >= wordmarkStartX) {
      const key = c.join(',');
      const [h, s, l] = rgbToHsl(c[0], c[1], c[2]);
      // preserve hue + saturation, lift lightness into the top band so it reads on dark surfaces
      c = hslToRgb(h, s, 0.60 + 0.32 * l);
      if (!before[key]) { before[key] = 0; after[key] = c.join(','); }
      before[key]++;
    }
    out[oi] = c[0]; out[oi + 1] = c[1]; out[oi + 2] = c[2]; out[oi + 3] = a;
  }
  if (lift) {
    const top = Object.entries(before).sort((a, b) => b[1] - a[1]).slice(0, 4);
    console.log('  wordmark recolour (hue preserved), contrast vs app bg #060816:');
    for (const [k, n] of top) {
      const oc = k.split(',').map(Number), nc = after[k].split(',').map(Number);
      const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
      console.log(`    ${hex(oc)} (${ratio(oc, [6, 8, 22]).toFixed(2)}:1) -> ${hex(nc)} (${ratio(nc, [6, 8, 22]).toFixed(2)}:1)   n=${n}`);
    }
  }
  return out;
}

// ---------- 8. downscale to shipping size and write ----------
const dh = Math.min(OUT_HEIGHT, ch);
const dw = Math.round(dh * (cw / ch));
console.log('shipping size', `${dw}x${dh}`);

function emit(file, lift) {
  const full = build(lift);
  const px = dh === ch ? full : downscale(full, cw, ch, dw, dh);
  fs.writeFileSync(file, encodeRGBA(dw, dh, px));
  console.log('  wrote', path.basename(file), (fs.statSync(file).size / 1024).toFixed(1) + 'KB');
}

emit(OUT_BRAND, false);
emit(OUT_ONDARK, true);

console.log('\nBrandLogo ASPECT_RATIO must be', `${dw} / ${dh}`, '=', (dw / dh).toFixed(4));
