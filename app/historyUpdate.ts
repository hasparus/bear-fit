export interface HistoryUpdate {
  clock: string;
  value: Uint8Array;
}

export const HEADER_SIZE = 8;
export const MAX_FIELD_SIZE = 0xffffffff;

export function validateFieldLengths(clockLength: number, valueLength: number) {
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
