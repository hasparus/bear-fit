/**
 * Renders the link-preview card: a grayscale PNG drawn from the templates and
 * glyphs in `public/og-card.bin` (made by `scripts/og-card.ts`).
 */

/** [advance, left, top, width, height, offset] */
type Glyph = [number, number, number, number, number, number];

interface Font {
  baseline: number;
  glyphs: Record<string, Glyph>;
}

interface Card {
  textWidth: number;
  width: number;
  bytes: Uint8Array;
  fonts: { dates: Font; name: Font };
  height: number;
  ink: number;
  textLeft: number;
  templates: {
    dates: number;
    names: number[];
    offset: number;
  }[];
}

let card: Promise<Card> | undefined;

/** Loads the card once per isolate; a failed load is retried next time. */
export function loadCard(assets: Fetcher, origin: string): Promise<Card> {
  card ??= (async () => {
    const response = await assets.fetch(new URL("/og-card.bin", origin));
    if (!response.ok || !response.body) {
      throw new Error(`og-card.bin: ${response.status}`);
    }
    const buffer = await new Response(
      response.body.pipeThrough(new DecompressionStream("deflate")),
    ).arrayBuffer();
    const length = new DataView(buffer).getUint32(0, true);
    const meta = JSON.parse(
      new TextDecoder().decode(new Uint8Array(buffer, 4, length)),
    );
    return { ...meta, bytes: new Uint8Array(buffer, 4 + length) };
  })().catch((error) => {
    card = undefined;
    throw error;
  });
  return card;
}

export async function renderCard(
  card: Card,
  name: string,
  dates: string,
): Promise<Uint8Array> {
  const names = wrap(card.fonts.name, name, card.textWidth, 2);
  const template = card.templates[Math.max(names.length, 1) - 1];
  const size = card.width * card.height;
  const pixels = card.bytes.slice(template.offset, template.offset + size);

  names.forEach((line, i) => {
    draw(card, pixels, card.fonts.name, line, template.names[i]);
  });
  draw(card, pixels, card.fonts.dates, dates, template.dates);

  return encodePng(pixels, card.width, card.height);
}

/** Draws `text` in the line box starting at `top`, glyph by glyph. */
function draw(
  card: Card,
  pixels: Uint8Array,
  font: Font,
  text: string,
  top: number,
) {
  const baseline = Math.round(top + font.baseline);
  let pen = card.textLeft;
  for (const char of text) {
    const glyph = font.glyphs[char];
    if (!glyph) continue;
    const [advance, left, glyphTop, width, height, offset] = glyph;
    const x0 = Math.round(pen) - left;
    const y0 = baseline - glyphTop;
    for (let y = 0; y < height; y++) {
      const row = (y0 + y) * card.width;
      for (let x = 0; x < width; x++) {
        const coverage = card.bytes[offset + y * width + x];
        if (!coverage) continue;
        const i = row + x0 + x;
        pixels[i] += ((card.ink - pixels[i]) * coverage) / 255;
      }
    }
    pen += advance;
  }
}

const width = (font: Font, text: string) => {
  let total = 0;
  for (const char of text) total += font.glyphs[char]?.[0] ?? 0;
  return total;
};

/**
 * Splits `text` into at most `maxLines` lines of `maxWidth`, breaking between
 * words (inside a word only when it can't fit a line), and ends the last line
 * with an ellipsis if the text doesn't fit, like CSS `line-clamp`.
 */
export function wrap(
  font: Font,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = [...normalize(font, text).split(" ")];
  const lines: string[] = [];
  let line = "";
  while (words.length) {
    const word = words[0];
    const candidate = line ? `${line} ${word}` : word;
    if (width(font, candidate) <= maxWidth) {
      line = candidate;
      words.shift();
      continue;
    }
    if (!line) {
      // A word wider than a line: take as many characters as fit.
      const chars = [...word];
      let cut = 1;
      while (width(font, chars.slice(0, cut + 1).join("")) <= maxWidth) cut++;
      line = chars.slice(0, cut).join("");
      words[0] = chars.slice(cut).join("");
    }
    lines.push(line);
    line = "";
    if (lines.length === maxLines) break;
  }
  if (line) lines.push(line);
  if (!words.length) return lines;

  let last = lines[maxLines - 1];
  while (last && width(font, `${last}…`) > maxWidth) {
    last = [...last].slice(0, -1).join("");
  }
  lines[maxLines - 1] = `${last.trimEnd()}…`;
  return lines;
}

/** Keeps only characters the font has, with whitespace collapsed. */
function normalize(font: Font, text: string) {
  return [...text.normalize("NFC").replace(/\s+/g, " ")]
    .filter((char) => font.glyphs[char])
    .join("")
    .replace(/ +/g, " ")
    .trim();
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array) {
  const bytes = new Uint8Array(12 + data.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(new TextEncoder().encode(type), 4);
  bytes.set(data, 8);
  view.setUint32(8 + data.length, crc32(bytes.subarray(4, 8 + data.length)));
  return bytes;
}

/** An 8-bit grayscale PNG, compressed by the runtime's zlib. */
async function encodePng(pixels: Uint8Array, width: number, height: number) {
  const rows = new Uint8Array((width + 1) * height); // filter byte 0 per row
  for (let y = 0; y < height; y++) {
    rows.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  const idat = new Uint8Array(
    await new Response(
      new Blob([rows]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 0, 0, 0, 0], 8); // 8-bit grayscale, no interlace
  return new Uint8Array(
    await new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", header),
      chunk("IDAT", idat),
      chunk("IEND", new Uint8Array()),
    ]).arrayBuffer(),
  );
}
