export const EVENT_TTL_MS = 60 * 24 * 60 * 60 * 1000;
export const COMPACTION_THRESHOLD = 5_000;

export function shouldCompact(count: number): boolean {
  return count > COMPACTION_THRESHOLD;
}
