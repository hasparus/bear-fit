import {
  HEADER_SIZE,
  type HistoryUpdate,
  validateFieldLengths,
} from "./historyUpdate";

export function encodeHistoryUpdates(
  updates: readonly HistoryUpdate[],
): Uint8Array {
  const textEncoder = new TextEncoder();
  const records = updates.map(({ clock, value }) => {
    const encodedClock = textEncoder.encode(clock);

    validateFieldLengths(encodedClock.length, value.length);

    return { clock: encodedClock, value };
  });
  const size = records.reduce(
    (total, record) =>
      total + HEADER_SIZE + record.clock.length + record.value.length,
    0,
  );
  const body = new Uint8Array(size);
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let offset = 0;

  for (const record of records) {
    view.setUint32(offset, record.clock.length);
    view.setUint32(offset + 4, record.value.length);
    offset += HEADER_SIZE;
    body.set(record.clock, offset);
    offset += record.clock.length;
    body.set(record.value, offset);
    offset += record.value.length;
  }

  return body;
}
