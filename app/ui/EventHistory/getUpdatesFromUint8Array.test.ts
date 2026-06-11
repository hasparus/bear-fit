import { describe, expect, it } from "vitest";

import { getUpdatesFromUint8Array } from "./getUpdatesFromUint8Array";

const SEPARATOR = [10, 10]; // "\n\n"

/**
 * Mirrors the server's encodeHistory (party/editor.partyserver.ts):
 * every part is `label \n\n value \n\n`, including a trailing separator.
 */
function encodeHistory(pairs: [string, number[]][]): Uint8Array {
  const textEncoder = new TextEncoder();
  const bytes: number[] = [];
  for (const [label, value] of pairs) {
    bytes.push(...textEncoder.encode(label), ...SEPARATOR);
    bytes.push(...value, ...SEPARATOR);
  }
  return new Uint8Array(bytes);
}

describe("getUpdatesFromUint8Array", () => {
  it("decodes label/value pairs from a server-encoded body", () => {
    const body = encodeHistory([
      ["1", [0x01, 0x02]],
      ["2", [0x03]],
    ]);

    const updates = getUpdatesFromUint8Array(body);

    expect(updates).toHaveLength(2);
    expect(updates[0].clock).toBe("1");
    expect(Array.from(updates[0].value)).toEqual([0x01, 0x02]);
    expect(updates[1].clock).toBe("2");
    expect(Array.from(updates[1].value)).toEqual([0x03]);
  });

  it("returns [] for empty input", () => {
    expect(getUpdatesFromUint8Array(new Uint8Array(0))).toEqual([]);
  });

  it("ignores the trailing separator the server appends", () => {
    // The body ends in \n\n; the final empty segment is not emitted.
    const body = encodeHistory([["7", [0xff]]]);
    expect(body[body.length - 2]).toBe(10);
    expect(body[body.length - 1]).toBe(10);

    const updates = getUpdatesFromUint8Array(body);

    expect(updates).toHaveLength(1);
    expect(updates[0].clock).toBe("7");
    expect(Array.from(updates[0].value)).toEqual([0xff]);
  });

  it("mis-splits binary values containing the separator bytes", () => {
    // BUG: binary values containing \n\n are split; fixed by plan 002.
    // The value [5, 10, 10, 6] splits into [5] and [6]; [6] is then misread
    // as the next pair's clock label ("\x06") with no value.
    const body = encodeHistory([["1", [0x05, 0x0a, 0x0a, 0x06]]]);

    const updates = getUpdatesFromUint8Array(body);

    expect(updates).toHaveLength(2);
    expect(updates[0].clock).toBe("1");
    expect(Array.from(updates[0].value)).toEqual([0x05]);
    expect(updates[1].clock).toBe("\x06");
    expect(updates[1].value).toBeUndefined();
  });
});
