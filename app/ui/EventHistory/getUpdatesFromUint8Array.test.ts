import { describe, expect, it } from "vitest";

import { getUpdatesFromUint8Array } from "./getUpdatesFromUint8Array";

/**
 * Mirrors the server's encodeHistory (party/editor.partyserver.ts):
 * per record, [4-byte BE uint32 clock][4-byte BE uint32 byteLength][update bytes].
 */
function encodeHistory(records: [number, number[]][]): Uint8Array {
  const totalSize = records.reduce((acc, [, value]) => acc + 8 + value.length, 0);
  const body = new Uint8Array(totalSize);
  const view = new DataView(body.buffer);
  let offset = 0;
  for (const [clock, value] of records) {
    view.setUint32(offset, clock);
    view.setUint32(offset + 4, value.length);
    body.set(value, offset + 8);
    offset += 8 + value.length;
  }
  return body;
}

describe("getUpdatesFromUint8Array", () => {
  it("round-trips records, including values containing consecutive 0x0A bytes", () => {
    /**
     * [10, 10, 10, 10] was the killer payload for the old "\n\n"-separated
     * format (mis-split into phantom records); with length-prefixed framing
     * it round-trips intact.
     */
    const body = encodeHistory([
      [1, [1, 2, 3]],
      [2, [10, 10, 10, 10]],
    ]);

    const updates = getUpdatesFromUint8Array(body);

    expect(updates).toHaveLength(2);
    expect(updates[0].clock).toBe("1");
    expect(Array.from(updates[0].value)).toEqual([1, 2, 3]);
    expect(updates[1].clock).toBe("2");
    expect(Array.from(updates[1].value)).toEqual([10, 10, 10, 10]);
  });

  it("returns [] for empty input", () => {
    expect(getUpdatesFromUint8Array(new Uint8Array(0))).toEqual([]);
  });

  it("returns only complete records for a truncated body, without throwing", () => {
    const body = encodeHistory([
      [1, [0x05, 0x06]],
      [2, [0x07, 0x08, 0x09]],
    ]);
    const truncated = body.slice(0, body.length - 2);

    const updates = getUpdatesFromUint8Array(truncated);

    expect(updates).toHaveLength(1);
    expect(updates[0].clock).toBe("1");
    expect(Array.from(updates[0].value)).toEqual([0x05, 0x06]);
  });

  it("preserves uint32-max clocks and record order", () => {
    const body = encodeHistory([
      [4294967295, [0xaa]],
      [7, [0xbb]],
      [3, [0xcc]],
    ]);

    const updates = getUpdatesFromUint8Array(body);

    expect(updates.map((u) => u.clock)).toEqual(["4294967295", "7", "3"]);
    expect(Array.from(updates[0].value)).toEqual([0xaa]);
    expect(Array.from(updates[1].value)).toEqual([0xbb]);
    expect(Array.from(updates[2].value)).toEqual([0xcc]);
  });
});
