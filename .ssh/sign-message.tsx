#! /usr/bin/env bun


import { AUTH_MESSAGE_PREFIX } from "../party/rooms";

const outDir = process.argv[2] || ".";
const timestampArg = process.argv[3];

const timestamp = timestampArg ? Number(timestampArg) : Date.now();

if (!Number.isSafeInteger(timestamp)) {
  console.error(
    `Invalid timestamp "${timestampArg}". Usage: bun sign-message.tsx [outDir] [timestamp]`,
  );
  process.exit(1);
}

const message = `${AUTH_MESSAGE_PREFIX}${timestamp}`;

const file = await Bun.file(
  new URL(`${outDir}/id_ed25519`, import.meta.url),
).text();
const decoded = Buffer.from(file, "base64");

const key = await crypto.subtle.importKey("pkcs8", decoded, "Ed25519", false, [
  "sign",
]);

const signature = await crypto.subtle.sign(
  "Ed25519",
  key,
  new TextEncoder().encode(message),
);

console.log(`${timestamp}.${Buffer.from(signature).toString("base64")}`);

export {};
