/**
 * Decodes the length-prefixed history wire format produced by the server's
 * encodeHistory (party/editor.partyserver.ts). Per record:
 * [4-byte big-endian uint32: clock][4-byte big-endian uint32: byteLength][update bytes]
 */
export function getUpdatesFromUint8Array(body: Uint8Array) {
  const updates: { clock: string; value: Uint8Array }[] = [];
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let offset = 0;
  while (offset + 8 <= body.length) {
    const clock = view.getUint32(offset);
    const length = view.getUint32(offset + 4);
    if (offset + 8 + length > body.length) break; // truncated payload — stop cleanly
    updates.push({
      clock: String(clock),
      value: body.slice(offset + 8, offset + 8 + length),
    });
    offset += 8 + length;
  }
  return updates;
}
