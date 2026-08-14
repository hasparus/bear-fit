import {
  HEADER_SIZE,
  type HistoryUpdate,
  validateFieldLengths,
} from "./historyUpdate";

export function decodeHistoryUpdates(body: Uint8Array): HistoryUpdate[] {
  const textDecoder = new TextDecoder("utf-8", { fatal: true });
  const updates: HistoryUpdate[] = [];
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let offset = 0;

  while (offset < body.length) {
    if (body.length - offset < HEADER_SIZE) {
      throw new Error("Invalid history: truncated record header");
    }

    const clockLength = view.getUint32(offset);
    const valueLength = view.getUint32(offset + 4);
    offset += HEADER_SIZE;
    validateFieldLengths(clockLength, valueLength);

    const clockEnd = offset + clockLength;
    const valueEnd = clockEnd + valueLength;

    if (clockEnd > body.length) {
      throw new Error("Invalid history: truncated clock");
    }
    if (valueEnd > body.length) {
      throw new Error("Invalid history: truncated value");
    }

    const clock = textDecoder.decode(body.subarray(offset, clockEnd));
    const value = body.slice(clockEnd, valueEnd);
    updates.push({ clock, value });
    offset = valueEnd;
  }

  return updates;
}
