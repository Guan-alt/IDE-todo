// 由 public/icon.svg 的设计生成打包用 public/icon.png（512x512 RGBA）。
// 零依赖：仅使用 Node 内置 zlib + 自实现 CRC32，按矢量设计超采样抗锯齿渲染。
// 用法： node scripts/gen-icon.cjs
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = path.join(__dirname, "..", "public", "icon.png");
const OUT_SIZE = 512; // 最终 PNG 尺寸
const SS = 4; // 超采样倍数（在 OUT_SIZE*SS 上渲染后降采样）
const R = OUT_SIZE * SS; // 渲染分辨率
const VB = 32; // 设计空间（对应 icon.svg viewBox）
const SCALE = R / VB;

const hexToRgb = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const C1 = hexToRgb("#4c6ef5"); // 渐变起点（左上）
const C2 = hexToRgb("#748ffc"); // 渐变终点（右下）
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 圆角矩形：[0,VB]x[0,VB]，角半径 RX
const RX = 8;
function inRoundedRect(x, y) {
  if (x < 0 || y < 0 || x > VB || y > VB) return false;
  const r = RX;
  const cx = clamp(x, r, VB - r);
  const cy = clamp(y, r, VB - r);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

// 点到线段距离
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  const ex = px - (ax + t * dx), ey = py - (ay + t * dy);
  return Math.sqrt(ex * ex + ey * ey);
}

// 勾：M9 16 L14 21 L23 12，stroke-width=3，圆角端点/连接（用胶囊并集近似）
const CR = 1.5; // 描边半径
function inCheck(x, y) {
  return (
    distSeg(x, y, 9, 16, 14, 21) <= CR ||
    distSeg(x, y, 14, 21, 23, 12) <= CR
  );
}

// 渲染到 R x R，再降采样到 OUT_SIZE
const raw = Buffer.alloc(R * R * 4);
for (let py = 0; py < R; py++) {
  const y = (py + 0.5) / SCALE;
  for (let px = 0; px < R; px++) {
    const x = (px + 0.5) / SCALE;
    const i = (py * R + px) * 4;
    if (inCheck(x, y)) {
      raw[i] = 255; raw[i + 1] = 255; raw[i + 2] = 255; raw[i + 3] = 255;
    } else if (inRoundedRect(x, y)) {
      const t = (x + y) / (VB * 2);
      raw[i] = (C1[0] + (C2[0] - C1[0]) * t) | 0;
      raw[i + 1] = (C1[1] + (C2[1] - C1[1]) * t) | 0;
      raw[i + 2] = (C1[2] + (C2[2] - C1[2]) * t) | 0;
      raw[i + 3] = 255;
    } else {
      raw[i] = 0; raw[i + 1] = 0; raw[i + 2] = 0; raw[i + 3] = 0;
    }
  }
}

// 降采样：SS x SS 块取平均
const out = Buffer.alloc(OUT_SIZE * OUT_SIZE * 4);
for (let oy = 0; oy < OUT_SIZE; oy++) {
  for (let ox = 0; ox < OUT_SIZE; ox++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) {
      for (let dx = 0; dx < SS; dx++) {
        const si = ((oy * SS + dy) * R + (ox * SS + dx)) * 4;
        r += raw[si]; g += raw[si + 1]; b += raw[si + 2]; a += raw[si + 3];
      }
    }
    const n = SS * SS;
    const oi = (oy * OUT_SIZE + ox) * 4;
    out[oi] = r / n; out[oi + 1] = g / n; out[oi + 2] = b / n; out[oi + 3] = a / n;
  }
}

// PNG 编码（RGBA，8 位）
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OUT_SIZE, 0);
ihdr.writeUInt32BE(OUT_SIZE, 4);
ihdr[8] = 8;  // 位深
ihdr[9] = 6;  // 颜色类型 RGBA
const scan = Buffer.alloc((OUT_SIZE * 4 + 1) * OUT_SIZE);
for (let y = 0; y < OUT_SIZE; y++) {
  scan[y * (OUT_SIZE * 4 + 1)] = 0; // 过滤字节
  out.copy(scan, y * (OUT_SIZE * 4 + 1) + 1, y * OUT_SIZE * 4, (y + 1) * OUT_SIZE * 4);
}
const idat = zlib.deflateSync(scan, { level: 9 });
const png = Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, png);
console.log("已生成:", OUT, `(${OUT_SIZE}x${OUT_SIZE}, ${png.length} bytes)`);
