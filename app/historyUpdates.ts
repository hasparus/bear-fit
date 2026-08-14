export interface HistoryUpdate {
  clock: string;
  value: Uint8Array;
}

const HEADER_SIZE = 8;
const MAX_FIELD_SIZE = 0xffffffff;
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const textEncoder = new TextEncoder();

export function encodeHistoryUpdates(
  updates: readonly HistoryUpdate[],
): Uint8Array {
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

export function decodeHistoryUpdates(body: Uint8Array): HistoryUpdate[] {
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

function validateFieldLengths(clockLength: number, valueLength: number) {
  if (clockLength === 0) {
    throw new Error("Invalid history: missing clock");
  }
  if (valueLength === 0) {
    throw new Error("Invalid history: missing value");
  }
  if (clockLength > MAX_FIELD_SIZE || valueLength > MAX_FIELD_SIZE) {
    throw new Error("Invalid history: field too large");
  }
}
