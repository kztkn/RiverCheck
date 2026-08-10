import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outputDirectory = resolve("public/icons");
const iconSpecs = [
  { file: "apple-touch-icon.png", maskable: false, size: 180 },
  { file: "icon-192.png", maskable: false, size: 192 },
  { file: "icon-512.png", maskable: false, size: 512 },
  { file: "icon-maskable-192.png", maskable: true, size: 192 },
  { file: "icon-maskable-512.png", maskable: true, size: 512 },
];
const glyphs = {
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
};

await mkdir(outputDirectory, { recursive: true });
for (const spec of iconSpecs) {
  await writeFile(
    resolve(outputDirectory, spec.file),
    createIconPng(spec.size, spec.maskable),
  );
}
console.log(`PWAアイコン生成OK（${iconSpecs.length}件）`);

function createIconPng(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4);
  const inset = Math.round(size * (maskable ? 0.18 : 0.08));
  const radius = Math.round(size * 0.16);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const glowDistance = Math.hypot(x - size * 0.78, y - size * 0.14);
      const glow = Math.max(0, 1 - glowDistance / (size * 0.85));
      setPixel(pixels, size, x, y, [
        Math.round(8 + glow * 8),
        Math.round(19 + glow * 31),
        Math.round(15 + glow * 20),
        255,
      ]);
    }
  }

  const border = Math.max(2, Math.round(size * 0.012));
  for (let y = inset; y < size - inset; y += 1) {
    for (let x = inset; x < size - inset; x += 1) {
      const outer = inRoundedRect(
        x,
        y,
        inset,
        inset,
        size - inset - 1,
        size - inset - 1,
        radius,
      );
      const inner = inRoundedRect(
        x,
        y,
        inset + border,
        inset + border,
        size - inset - border - 1,
        size - inset - border - 1,
        Math.max(0, radius - border),
      );
      if (outer && !inner) {
        blendPixel(pixels, size, x, y, [57, 222, 141, 150]);
      }
    }
  }

  const unit = Math.max(3, Math.floor(size * (maskable ? 0.042 : 0.052)));
  const gap = unit;
  const glyphWidth = unit * 5;
  const totalWidth = glyphWidth * 2 + gap;
  const startX = Math.floor((size - totalWidth) / 2);
  const startY = Math.floor((size - unit * 7) / 2);
  drawGlyph(pixels, size, glyphs.R, startX, startY, unit);
  drawGlyph(pixels, size, glyphs.C, startX + glyphWidth + gap, startY, unit);

  return encodePng(size, size, pixels);
}

function drawGlyph(pixels, size, rows, startX, startY, unit) {
  rows.forEach((row, rowIndex) => {
    [...row].forEach((value, columnIndex) => {
      if (value !== "1") return;
      for (let y = 0; y < unit; y += 1) {
        for (let x = 0; x < unit; x += 1) {
          setPixel(
            pixels,
            size,
            startX + columnIndex * unit + x,
            startY + rowIndex * unit + y,
            [57, 222, 141, 255],
          );
        }
      }
    });
  });
}

function inRoundedRect(x, y, left, top, right, bottom, radius) {
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  return Math.hypot(x - nearestX, y - nearestY) <= radius;
}

function setPixel(pixels, width, x, y, color) {
  const offset = (y * width + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = color[3];
}

function blendPixel(pixels, width, x, y, color) {
  const offset = (y * width + x) * 4;
  const alpha = color[3] / 255;
  for (let index = 0; index < 3; index += 1) {
    pixels[offset + index] = Math.round(
      pixels[offset + index] * (1 - alpha) + color[index] * alpha,
    );
  }
}

function encodePng(width, height, pixels) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0;
    pixels.copy(scanlines, rowOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8);
  return chunk;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
