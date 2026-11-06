/**
 * Draws the link-preview card's static parts and glyphs in Chromium and saves
 * them to `public/og-card.bin`, which `party/ogImage.ts` renders from. Rerun
 * after changing the design or the font, and bump `CARD_DESIGN` in
 * `party/linkPreview.ts` so crawlers refetch cached cards:
 *
 *   node scripts/og-card.ts
 *
 * Set CHROMIUM_PATH to use a browser other than Playwright's.
 */
import { chromium } from "@playwright/test";
import fs from "node:fs";
import zlib from "node:zlib";

import type { CardMeta, Font } from "../party/ogImage";

/** Czikago's characters: ASCII, Latin-1, Polish and common punctuation. */
const CHARSET = [
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => 0x20 + i),
  ...Array.from({ length: 0x100 - 0xa1 }, (_, i) => 0xa1 + i).filter(
    (cp) => cp !== 0xad,
  ),
  ..."ĄąĆćĘęŁłŃńŒœŚśŠšŸŹźŻżƒ–—‘’‚“”„†‡•…‰‹›™",
].map((c) => (typeof c === "number" ? String.fromCodePoint(c) : c));

const font = fs.readFileSync("public/fonts/Czikago.woff2").toString("base64");
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
});
const page = await browser.newPage();
await page.setContent(
  `<style>@font-face{font-family:Czikago;src:url(data:font/woff2;base64,${font})}</style><p style="font:16px Czikago">x</p>`,
);
await page.evaluate(() => document.fonts.ready);

const { chunks, meta } = await page.evaluate(
  (
    charset,
  ): {
    chunks: string[];
    meta: CardMeta;
  } => {
    const W = 1200;
    const H = 630;
    const HEADER = 60;

    // Colors as the app draws them; `dark` applies the app's invert(0.9).
    const INK = "#000";
    const PAPER = "#fff";
    const MUTED = "#737373"; // neutral-500
    const RULE = "#d4d4d4"; // neutral-300
    const dark = (v: number) => Math.round(229.5 - 0.8 * v);

    const chunks: string[] = [];
    let offset = 0;
    /** Stores the canvas's red channel, inverted to dark mode or as coverage. */
    const store = (ctx: CanvasRenderingContext2D, mode: "alpha" | "dark") => {
      const { data, height, width } = ctx.getImageData(
        0,
        0,
        ctx.canvas.width,
        ctx.canvas.height,
      );
      const bytes = new Uint8Array(width * height);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = mode === "dark" ? dark(data[i * 4]) : 255 - data[i * 4];
      }
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      chunks.push(btoa(binary));
      const at = offset;
      offset += bytes.length;
      return at;
    };
    const canvas = (width: number, height: number) => {
      const ctx = Object.assign(document.createElement("canvas"), {
        height,
        width,
      }).getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, width, height);
      return ctx;
    };

    /** Baseline of `font` centered in a CSS line box, as the browser lays it. */
    const baseline = (ctx: CanvasRenderingContext2D, lineHeight: number) => {
      const m = ctx.measureText("x");
      const content = m.fontBoundingBoxAscent + m.fontBoundingBoxDescent;
      return (lineHeight - content) / 2 + m.fontBoundingBoxAscent;
    };

    const TEXT = {
      dates: { font: "54px Czikago", lineHeight: 81 },
      label: { font: "33px Czikago", lineHeight: 49.5 },
      name: { font: "84px Czikago", lineHeight: 96.6 },
    };
    const PADDING = 6 + 30; // card border + padding
    const GAP = 36; // below the name
    const cardHeight = (lines: number) =>
      Math.round(
        2 * PADDING +
          2 * TEXT.label.lineHeight +
          lines * TEXT.name.lineHeight +
          GAP +
          TEXT.dates.lineHeight,
      );

    /** Text boxes for a card whose name takes `lines` lines. */
    const layout = (lines: number) => {
      const top = HEADER + Math.round((H - HEADER - cardHeight(lines)) / 2);
      const name = top + PADDING + TEXT.label.lineHeight;
      const datesLabel = name + lines * TEXT.name.lineHeight + GAP;
      return {
        card: top,
        dates: datesLabel + TEXT.label.lineHeight,
        datesLabel,
        label: top + PADDING,
        names: Array.from(
          { length: lines },
          (_, i) => name + i * TEXT.name.lineHeight,
        ),
      };
    };

    /** The app's dotted body background, at 3×, then header and card. */
    const template = (lines: number) => {
      const ctx = canvas(W, H);
      const box = layout(lines);
      ctx.fillStyle = INK;
      for (let y = 15; y < H; y += 66) {
        for (let x = 36; x < W; x += 66) ctx.fillRect(x, y, 3, 3);
      }

      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, W, HEADER);
      ctx.fillStyle = RULE;
      ctx.fillRect(0, HEADER - 2, W, 2);
      ctx.font = "bold 28px Czikago";
      ctx.fillStyle = INK;
      ctx.fillText("bear fit", 24, 8 + baseline(ctx, 42));
      ctx.font = "24px Czikago";
      ctx.fillStyle = MUTED;
      ctx.textAlign = "right";
      ctx.fillText(
        "find a time that works for everybody",
        W - 24,
        11 + baseline(ctx, 36),
      );
      ctx.textAlign = "left";

      const height = cardHeight(lines);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(66, box.card + 6, 1080, height, 6); // box-shadow
      ctx.roundRect(60, box.card, 1080, height, 6); // border
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.fillRect(66, box.card + 6, 1068, height - 12);

      ctx.font = TEXT.label.font;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = INK;
      const labelBaseline = baseline(ctx, TEXT.label.lineHeight);
      ctx.fillText("Calendar", 96, box.label + labelBaseline);
      ctx.fillText("Dates", 96, box.datesLabel + labelBaseline);
      ctx.globalAlpha = 1;

      return { dates: box.dates, names: box.names, offset: store(ctx, "dark") };
    };

    /** Each character's coverage bitmap and metrics, drawn at a whole pixel. */
    const glyphs = (font: string, lineHeight: number): Font => {
      const measure = canvas(1, 1);
      measure.font = font;
      const table: Font["glyphs"] = {};
      for (const char of charset) {
        const m = measure.measureText(char);
        const left = Math.ceil(m.actualBoundingBoxLeft) + 1;
        const top = Math.ceil(m.actualBoundingBoxAscent) + 1;
        const width = left + Math.ceil(m.actualBoundingBoxRight) + 1;
        const height = top + Math.ceil(m.actualBoundingBoxDescent) + 1;
        const ctx = canvas(Math.max(width, 1), Math.max(height, 1));
        ctx.font = font;
        ctx.fillStyle = INK;
        ctx.fillText(char, left, top);
        table[char] = {
          advance: m.width,
          height: ctx.canvas.height,
          left,
          offset: store(ctx, "alpha"),
          top,
          width: ctx.canvas.width,
        };
      }
      return { baseline: baseline(measure, lineHeight), glyphs: table };
    };

    return {
      chunks,
      meta: {
        fonts: {
          dates: glyphs(TEXT.dates.font, TEXT.dates.lineHeight),
          name: glyphs(TEXT.name.font, TEXT.name.lineHeight),
        },
        height: H,
        ink: dark(0),
        templates: [template(1), template(2)],
        textLeft: 96,
        textWidth: 1080 - 2 * PADDING,
        width: W,
      },
    };
  },
  CHARSET,
);
await browser.close();

const json = Buffer.from(JSON.stringify(meta));
const length = Buffer.alloc(4);
length.writeUInt32LE(json.length);
const bytes = Buffer.concat([
  length,
  json,
  ...chunks.map((chunk) => Buffer.from(chunk, "base64")),
]);
const out = zlib.deflateSync(bytes, { level: 9 });
fs.writeFileSync("public/og-card.bin", out);
console.log(
  `public/og-card.bin: ${(out.length / 1024).toFixed(1)} KiB (${(bytes.length / 1024).toFixed(0)} KiB raw)`,
);
