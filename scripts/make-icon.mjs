import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "build");

const ACCENT = [47, 111, 79];
const PAGE = [255, 255, 255];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function inRoundedRect(x, y, minX, minY, maxX, maxY, radius) {
  if (x < minX || x > maxX || y < minY || y > maxY) {
    return false;
  }
  const dx = Math.max(minX + radius - x, 0, x - (maxX - radius));
  const dy = Math.max(minY + radius - y, 0, y - (maxY - radius));
  return dx * dx + dy * dy <= radius * radius;
}

function inTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const sign = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
  const d1 = sign(x, y, ax, ay, bx, by);
  const d2 = sign(x, y, bx, by, cx, cy);
  const d3 = sign(x, y, cx, cy, ax, ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function samplePixel(u, v) {
  if (!inRoundedRect(u, v, 0, 0, 1, 1, 0.215)) {
    return null;
  }
  let color = ACCENT;
  if (
    inRoundedRect(u, v, 0.24, 0.2, 0.76, 0.8, 0.06) &&
    !inTriangle(u, v, 0.76, 0.2, 0.58, 0.2, 0.76, 0.38)
  ) {
    color = PAGE;
    if (inRoundedRect(u, v, 0.34, 0.5, 0.66, 0.555, 0.028)) {
      color = ACCENT;
    } else if (inRoundedRect(u, v, 0.34, 0.61, 0.56, 0.665, 0.028)) {
      color = ACCENT;
    }
  }
  return color;
}

function render(size, supersample) {
  const rgba = Buffer.alloc(size * size * 4);
  const step = 1 / (size * supersample);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const u = (x * supersample + sx + 0.5) * step;
          const v = (y * supersample + sy + 0.5) * step;
          const color = samplePixel(u, v);
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            covered += 1;
          }
        }
      }
      const total = supersample * supersample;
      const offset = (y * size + x) * 4;
      if (covered > 0) {
        rgba[offset] = Math.round(r / covered);
        rgba[offset + 1] = Math.round(g / covered);
        rgba[offset + 2] = Math.round(b / covered);
        rgba[offset + 3] = Math.round((covered / total) * 255);
      }
    }
  }
  return rgba;
}

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = sizes.map((size) => encodePng(size, size, render(size, size <= 48 ? 6 : 3)));

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);

const entries = [];
let offset = 6 + sizes.length * 16;
for (let index = 0; index < sizes.length; index += 1) {
  const entry = Buffer.alloc(16);
  entry[0] = sizes[index] === 256 ? 0 : sizes[index];
  entry[1] = sizes[index] === 256 ? 0 : sizes[index];
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngs[index].length, 8);
  entry.writeUInt32LE(offset, 12);
  entries.push(entry);
  offset += pngs[index].length;
}

mkdirSync(outDir, { recursive: true });
const iconPath = join(outDir, "icon.ico");
writeFileSync(iconPath, Buffer.concat([header, ...entries, ...pngs]));
console.log(`Wrote ${iconPath} with sizes: ${sizes.join(", ")}`);
