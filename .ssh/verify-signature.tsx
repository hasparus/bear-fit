#! /usr/bin/env bun

// usage: bun .ssh/verify-signature.tsx <signature> <message> [outDir]
// example: bun .ssh/verify-signature.tsx "<signature>" "my message" ./test

const signature = process.argv[2];
const message = process.argv[3];
const outDir = process.argv[4] || ".";

if (!signature || !message) {
  console.error(
    "Signature and message are required. Usage: bun verify-signature.tsx <signature> <message> [outDir]",
  );
  process.exit(1);
}

const file = await Bun.file(
  new URL(`${outDir}/id_ed25519.pub`, import.meta.url),
).text();
const rawKey = Buffer.from(file, "base64");

const key = await crypto.subtle.importKey("raw", rawKey, "Ed25519", false, [
  "verify",
]);

const verified = await crypto.subtle.verify(
  "Ed25519",
  key,
  Buffer.from(signature, "base64"),
  new TextEncoder().encode(message),
);

console.log(verified);

export {};
