import { describe, expect, it } from "vitest";

import { isValidDateRange } from "./dateRangeValidation";
import { eachDayOfInterval } from "./eachDayOfInterval";
import { getPaddingDays } from "./getPaddingDays";

const utc = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day));

describe("eachDayOfInterval", () => {
  it("includes both endpoints", () => {
    const days = eachDayOfInterval(utc(2026, 5, 1), utc(2026, 5, 3));
    expect(days).toHaveLength(3);
    expect(days[0].toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(days[2].toISOString()).toBe("2026-06-03T00:00:00.000Z");
  });

  it("returns a single day when from === to", () => {
    expect(eachDayOfInterval(utc(2026, 5, 1), utc(2026, 5, 1))).toHaveLength(1);
  });

  it("is empty when from > to", () => {
    expect(eachDayOfInterval(utc(2026, 5, 3), utc(2026, 5, 1))).toEqual([]);
  });

  it("spans 90 days inclusively as 91 dates", () => {
    const days = eachDayOfInterval(
      utc(2026, 0, 1),
      addUtcDays(utc(2026, 0, 1), 90),
    );
    expect(days).toHaveLength(91);
    expect(new Set(days.map((d) => d.toISOString())).size).toBe(91);
  });
});

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

// These inputs are UTC midnights and the suite runs with TZ=UTC
// (vitest.config.ts), so local getDay() agrees with the UTC weekday.
describe("getPaddingDays", () => {
  it("is 0 when the first day is the week start", () => {
    // 2026-06-01 is a Monday.
    expect(getPaddingDays(utc(2026, 5, 1), 1)).toBe(0);
  });

  it("offsets a mid-week first day from the week start", () => {
    // 2026-06-10 is a Wednesday.
    expect(getPaddingDays(utc(2026, 5, 10), 1)).toBe(2);
  });

  it("wraps a Sunday to the end of a Monday-started week", () => {
    // 2026-06-07 is a Sunday.
    expect(getPaddingDays(utc(2026, 5, 7), 1)).toBe(6);
  });

  it("uses Sunday as week start when weekStartsOn is 0", () => {
    expect(getPaddingDays(utc(2026, 5, 7), 0)).toBe(0);
    expect(getPaddingDays(utc(2026, 5, 10), 0)).toBe(3);
  });
});

describe("isValidDateRange", () => {
  it("is true when from < to", () => {
    expect(
      isValidDateRange({ from: utc(2026, 5, 1), to: utc(2026, 5, 3) }),
    ).toBe(true);
  });

  it("is false when from === to", () => {
    // current behavior: single-day ranges are rejected (strict <).
    expect(
      isValidDateRange({ from: utc(2026, 5, 1), to: utc(2026, 5, 1) }),
    ).toBe(false);
  });

  it("is false when either side is missing", () => {
    expect(isValidDateRange({ from: utc(2026, 5, 1), to: undefined })).toBe(
      false,
    );
    expect(isValidDateRange({ from: undefined, to: utc(2026, 5, 3) })).toBe(
      false,
    );
    expect(isValidDateRange({ from: undefined, to: undefined })).toBe(false);
  });

  it("is false for an inverted range", () => {
    expect(
      isValidDateRange({ from: utc(2026, 5, 3), to: utc(2026, 5, 1) }),
    ).toBe(false);
  });
});
