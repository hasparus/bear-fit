#! /usr/bin/env bun

const key = await crypto.subtle.generateKey("Ed25519", true, [
  "sign",
  "verify",
]);

const privateFile = await Bun.write(
  new URL("./id_ed25519", import.meta.url),
  Buffer.from(await crypto.subtle.exportKey("pkcs8", key.privateKey)).toString(
    "base64",
  ),
);

const publicFile = await Bun.write(
  new URL("./id_ed25519.pub", import.meta.url),
  Buffer.from(await crypto.subtle.exportKey("raw", key.publicKey)).toString(
    "base64",
  ),
);

const testMessage = new TextEncoder().encode("test message");

const signature = await crypto.subtle.sign(
  "Ed25519",
  key.privateKey,
  testMessage,
);

const verified = await crypto.subtle.verify(
  "Ed25519",
  key.publicKey,
  signature,
  testMessage,
);

console.log(
  ` ${privateFile} bytes written\n`,
  `${publicFile} bytes written\n`,
  `test signature: ${Buffer.from(signature).toString("base64")}\n`,
  `verified: ${verified}`,
);

export {};
