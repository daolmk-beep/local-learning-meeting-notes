// 앱 아이콘 생성기 — 의존성 없이 PNG를 직접 인코딩한다.
// 디자인: 짙은 배경 + 가운데 카드 + 노트 라인(상단은 accent). "노트" 느낌.
// 실행: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(new URL(".", import.meta.url))), "icons");
mkdirSync(OUT, { recursive: true });

// ---- CRC32 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // 스캔라인마다 필터바이트(0) 추가
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- 그리기 ----
function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
const BG = hex("#0f172a");
const CARD = hex("#1e293b");
const ACCENT = hex("#3b82f6");
const LINE = hex("#94a3b8");

function draw(size) {
  const buf = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
  };
  const rect = (x0, y0, w, h, col, radius = 0) => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (radius > 0) {
          const dx = Math.min(x - x0, x0 + w - 1 - x);
          const dy = Math.min(y - y0, y0 + h - 1 - y);
          if (dx < radius && dy < radius) {
            const ddx = radius - dx, ddy = radius - dy;
            if (ddx * ddx + ddy * ddy > radius * radius) continue;
          }
        }
        set(x, y, col);
      }
    }
  };
  // 배경
  rect(0, 0, size, size, BG);
  // 카드 (중앙 70%, maskable 안전영역 안)
  const m = Math.round(size * 0.18);
  const cardW = size - m * 2;
  const cardH = size - m * 2;
  rect(m, m, cardW, cardH, CARD, Math.round(size * 0.06));
  // 노트 라인 4개 (맨 위는 accent, 길이 다양)
  const lineX = m + Math.round(cardW * 0.14);
  const lineH = Math.max(2, Math.round(size * 0.045));
  const gap = Math.round(cardH * 0.17);
  const startY = m + Math.round(cardH * 0.22);
  const widths = [0.62, 0.72, 0.5, 0.66];
  for (let i = 0; i < widths.length; i++) {
    const col = i === 0 ? ACCENT : LINE;
    rect(lineX, startY + i * gap, Math.round(cardW * widths[i]), lineH, col, Math.round(lineH / 2));
  }
  return buf;
}

for (const size of [192, 512]) {
  const png = encodePng(size, size, draw(size));
  const path = join(OUT, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log("wrote", path, png.length, "bytes");
}
