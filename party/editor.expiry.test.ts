import { describe, expect, it } from "vitest";

import {
  COMPACTION_THRESHOLD,
  EVENT_TTL_MS,
  shouldCompact,
} from "./editor.expiry";

describe("EVENT_TTL_MS", () => {
  it("is 60 days in milliseconds", () => {
    expect(EVENT_TTL_MS).toBe(60 * 24 * 60 * 60 * 1000);
  });

  it("is greater than 30 days", () => {
    expect(EVENT_TTL_MS).toBeGreaterThan(30 * 24 * 60 * 60 * 1000);
  });
});

describe("COMPACTION_THRESHOLD", () => {
  it("is 5000", () => {
    expect(COMPACTION_THRESHOLD).toBe(5_000);
  });
});

describe("shouldCompact", () => {
  it("returns false at zero", () => {
    expect(shouldCompact(0)).toBe(false);
  });

  it("returns false at threshold exactly", () => {
    expect(shouldCompact(COMPACTION_THRESHOLD)).toBe(false);
  });

  it("returns true one above threshold", () => {
    expect(shouldCompact(COMPACTION_THRESHOLD + 1)).toBe(true);
  });

  it("returns true well above threshold", () => {
    expect(shouldCompact(10_000)).toBe(true);
  });
});
