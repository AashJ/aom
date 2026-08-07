import { deflateSync } from "node:zlib";

const [inputPath, outputPath] = Bun.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: bun scripts/decode-classic-ddt.ts <input.ddt> <output.png>");
}

const bytes = new Uint8Array(await Bun.file(inputPath).arrayBuffer());
const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
if (bytes.byteLength < 24 || new TextDecoder().decode(bytes.subarray(0, 4)) !== "RTS3") {
  throw new Error(`${inputPath} is not a Classic DDT texture.`);
}

const alphaBits = view.getUint8(5);
const format = view.getUint8(6);
const mipLevels = view.getUint8(7);
const width = view.getUint32(8, true);
const height = view.getUint32(12, true);
if (width < 1 || height < 1 || mipLevels < 1) throw new Error("Invalid Classic DDT dimensions.");

function imageEntry(offset: number): readonly [number, number] {
  const dataOffset = view.getUint32(offset, true);
  const size = view.getUint32(offset + 4, true);
  if (dataOffset + size > bytes.byteLength) throw new Error("Classic DDT image is out of bounds.");
  return [dataOffset, size];
}

function flipRgbaVertically(pixels: Uint8Array): void {
  const stride = width * 4;
  const row = new Uint8Array(stride);
  for (let y = 0; y < Math.floor(height / 2); y += 1) {
    const opposite = height - 1 - y;
    const top = y * stride;
    const bottom = opposite * stride;
    row.set(pixels.subarray(top, top + stride));
    pixels.copyWithin(top, bottom, bottom + stride);
    pixels.set(row, bottom);
  }
}

function expand4(value: number): number {
  return value * 17;
}

function decodeSwizzledDxt3(): Uint8Array {
  if (alphaBits !== 4) throw new Error(`Unsupported DXT3 alpha depth ${alphaBits}.`);
  const [dataOffset, size] = imageEntry(16);
  const blockWidth = Math.ceil(width / 4);
  const blockHeight = Math.ceil(height / 4);
  if (size !== blockWidth * blockHeight * 16) throw new Error("Invalid swizzled DXT3 size.");
  const pixels = new Uint8Array(width * height * 4);

  for (let blockY = 0; blockY < blockHeight; blockY += 1) {
    for (let blockX = 0; blockX < blockWidth; blockX += 1) {
      const offset = dataOffset + (blockY * blockWidth + blockX) * 16;
      const colorWords = [view.getUint16(offset, true), view.getUint16(offset + 2, true)];
      const colors = colorWords.map((color) => [
        expand4((color >>> 8) & 0xf),
        expand4((color >>> 4) & 0xf),
        expand4(color & 0xf),
      ]);
      colors.push(
        colors[0]!.map((channel, index) => Math.round((channel * 2 + colors[1]![index]!) / 3)),
        colors[0]!.map((channel, index) => Math.round((channel + colors[1]![index]! * 2) / 3)),
      );
      const alphaWords = [
        view.getUint16(offset + 4, true),
        view.getUint16(offset + 7, true),
        view.getUint16(offset + 10, true),
        view.getUint16(offset + 13, true),
      ];
      const indexBits =
        view.getUint8(offset + 6) |
        (view.getUint8(offset + 9) << 8) |
        (view.getUint8(offset + 12) << 16) |
        (view.getUint8(offset + 15) << 24);

      for (let pixel = 0; pixel < 16; pixel += 1) {
        const localX = pixel & 3;
        const localY = pixel >>> 2;
        const x = blockX * 4 + localX;
        const y = blockY * 4 + localY;
        if (x >= width || y >= height) continue;
        const color = colors[(indexBits >>> (pixel * 2)) & 3]!;
        const alpha = (alphaWords[localY]! >>> (localX * 4)) & 0xf;
        const destination = (y * width + x) * 4;
        pixels[destination] = color[0]!;
        pixels[destination + 1] = color[1]!;
        pixels[destination + 2] = color[2]!;
        pixels[destination + 3] = expand4(alpha);
      }
    }
  }
  return pixels;
}

function expand5(value: number): number {
  return (value << 3) | (value >>> 2);
}

function expand6(value: number): number {
  return (value << 2) | (value >>> 4);
}

function decodeDxt1(): Uint8Array {
  if (alphaBits !== 0) throw new Error(`Unsupported DXT1 alpha depth ${alphaBits}.`);
  const [dataOffset, size] = imageEntry(16);
  const blockWidth = Math.ceil(width / 4);
  const blockHeight = Math.ceil(height / 4);
  if (size !== blockWidth * blockHeight * 8) throw new Error("Invalid DXT1 size.");
  const pixels = new Uint8Array(width * height * 4);

  const rgb565 = (color: number): readonly [number, number, number, number] => [
    expand5((color >>> 11) & 0x1f),
    expand6((color >>> 5) & 0x3f),
    expand5(color & 0x1f),
    255,
  ];

  for (let blockY = 0; blockY < blockHeight; blockY += 1) {
    for (let blockX = 0; blockX < blockWidth; blockX += 1) {
      const offset = dataOffset + (blockY * blockWidth + blockX) * 8;
      const color0Word = view.getUint16(offset, true);
      const color1Word = view.getUint16(offset + 2, true);
      const color0 = rgb565(color0Word);
      const color1 = rgb565(color1Word);
      const colors: readonly (readonly [number, number, number, number])[] =
        color0Word > color1Word
          ? [
              color0,
              color1,
              [
                Math.floor((color0[0] * 2 + color1[0]) / 3),
                Math.floor((color0[1] * 2 + color1[1]) / 3),
                Math.floor((color0[2] * 2 + color1[2]) / 3),
                255,
              ],
              [
                Math.floor((color0[0] + color1[0] * 2) / 3),
                Math.floor((color0[1] + color1[1] * 2) / 3),
                Math.floor((color0[2] + color1[2] * 2) / 3),
                255,
              ],
            ]
          : [
              color0,
              color1,
              [
                Math.round((color0[0] + color1[0]) / 2),
                Math.round((color0[1] + color1[1]) / 2),
                Math.round((color0[2] + color1[2]) / 2),
                255,
              ],
              [0, 0, 0, 0],
            ];
      const indices = view.getUint32(offset + 4, true);

      for (let pixel = 0; pixel < 16; pixel += 1) {
        const x = blockX * 4 + (pixel & 3);
        const y = blockY * 4 + (pixel >>> 2);
        if (x >= width || y >= height) continue;
        const color = colors[(indices >>> (pixel * 2)) & 3]!;
        pixels.set(color, (y * width + x) * 4);
      }
    }
  }
  return pixels;
}

function decodeBt8(): Uint8Array {
  if (alphaBits !== 0) throw new Error(`Unsupported BT8 alpha depth ${alphaBits}.`);
  const colorCount = view.getUint32(16, true);
  const paletteOffset = view.getUint32(24, true);
  const [dataOffset, size] = imageEntry(40);
  if (colorCount < 1 || colorCount > 256 || paletteOffset + colorCount * 2 > bytes.byteLength) {
    throw new Error("Invalid Classic BT8 palette.");
  }
  if (size !== width * height) throw new Error("Invalid Classic BT8 image size.");
  const pixels = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const paletteIndex = bytes[dataOffset + pixel]!;
    if (paletteIndex >= colorCount) throw new Error("Classic BT8 palette index is out of bounds.");
    const color = view.getUint16(paletteOffset + paletteIndex * 2, true);
    const destination = pixel * 4;
    pixels[destination] = expand5((color >>> 11) & 0x1f);
    pixels[destination + 1] = expand6((color >>> 5) & 0x3f);
    pixels[destination + 2] = expand5(color & 0x1f);
    pixels[destination + 3] = 255;
  }
  return pixels;
}

const pixels =
  format === 6
    ? decodeSwizzledDxt3()
    : format === 4
      ? decodeDxt1()
      : format === 3
        ? decodeBt8()
        : null;
if (pixels === null) throw new Error(`Unsupported Classic DDT format ${format}.`);
flipRgbaVertically(pixels);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.byteLength);
  const chunkView = new DataView(chunk.buffer);
  const typeBytes = new TextEncoder().encode(type);
  chunkView.setUint32(0, data.byteLength);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  chunkView.setUint32(8 + data.byteLength, crc32(chunk.subarray(4, 8 + data.byteLength)));
  return chunk;
}

function encodePng(): Uint8Array {
  const scanlines = new Uint8Array(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const destination = y * (1 + width * 4);
    scanlines[destination] = 0;
    scanlines.set(pixels!.subarray(y * width * 4, (y + 1) * width * 4), destination + 1);
  }
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks = [
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", new Uint8Array()),
  ];
  const output = new Uint8Array(
    signature.byteLength + chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0),
  );
  output.set(signature);
  let offset = signature.byteLength;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

await Bun.write(outputPath, encodePng());
console.log(`Wrote ${outputPath} (${width}x${height}).`);
