import { expect, test } from "@playwright/test";

import { decodeHistoryUpdates, encodeHistoryUpdates } from "./historyUpdates";

test("history framing preserves arbitrary binary update values", () => {
  const updates = [
    { clock: "sv", value: new Uint8Array([0, 10, 10, 255]) },
    { clock: "42", value: new Uint8Array([10, 10, 1, 10, 10]) },
  ];

  const decoded = decodeHistoryUpdates(encodeHistoryUpdates(updates));

  expect(decoded.map(({ clock }) => clock)).toEqual(["sv", "42"]);
  expect([...decoded[0].value]).toEqual([...updates[0].value]);
  expect([...decoded[1].value]).toEqual([...updates[1].value]);
});

test("history parser rejects incomplete records", () => {
  const validRecord = encodeHistoryUpdates([
    { clock: "1", value: new Uint8Array([1, 2, 3]) },
  ]);
  const malformedBodies = [
    new Uint8Array([0, 0, 0, 1]),
    frame(0, 1, [1]),
    frame(1, 0, [49]),
    frame(2, 1, [49, 1]),
    frame(1, 2, [49, 1]),
    concatenate(validRecord, new Uint8Array([0, 0, 0, 1])),
  ];

  for (const body of malformedBodies) {
    expect(() => decodeHistoryUpdates(body)).toThrow(/Invalid history/);
  }
});

function concatenate(first: Uint8Array, second: Uint8Array) {
  const result = new Uint8Array(first.length + second.length);
  result.set(first);
  result.set(second, first.length);
  return result;
}

function frame(clockLength: number, valueLength: number, payload: number[]) {
  const result = new Uint8Array(8 + payload.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, clockLength);
  view.setUint32(4, valueLength);
  result.set(payload, 8);
  return result;
}
