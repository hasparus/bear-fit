#! /usr/bin/env bun

const message = process.argv[2];

if (!message) {
  console.error("Message is required. Usage: bun sign-message.tsx <message>");
  process.exit(1);
}

const file = await Bun.file(new URL("./id_ed25519", import.meta.url)).text();
const decoded = Buffer.from(file, "base64");

const key = await crypto.subtle.importKey("pkcs8", decoded, "Ed25519", false, [
  "sign",
]);

const signature = await crypto.subtle.sign(
  "Ed25519",
  key,
  new TextEncoder().encode(message),
);

console.log(Buffer.from(signature).toString("base64"));

export {};
