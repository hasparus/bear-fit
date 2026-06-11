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

// These inputs are UTC midnights and getPaddingDays reads getUTCDay(),
// so the expectations hold in every host timezone. Run the suite with
// TZ=America/Los_Angeles and TZ=Pacific/Kiritimati as regression proof.
describe("getPaddingDays", () => {
  it("reads the weekday in UTC regardless of host timezone", () => {
    // 2026-07-01 is a Wednesday; with the week starting Monday, padding = 2.
    // Before the getUTCDay() fix this was 1 under TZ=America/Los_Angeles.
    expect(getPaddingDays(utc(2026, 6, 1), 1)).toBe(2);
  });

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

describe("calendar month grouping", () => {
  // Replicates the monthKey reduce in EventDetails.tsx over dates parsed
  // from stored IsoDate strings (UTC midnights). With UTC getters a July
  // event groups under a single July key in every host timezone; local
  // getters put 2026-07-01 under June for any user west of UTC.
  it("groups an early-July range under a single month key in any timezone", () => {
    const groups = eachDayOfInterval(
      new Date("2026-07-01"),
      new Date("2026-07-03"),
    ).reduce(
      (acc, day) => {
        const monthKey = `${day.getUTCFullYear()}-${day.getUTCMonth()}`;
        (acc[monthKey] ??= []).push(day);
        return acc;
      },
      {} as Record<string, Date[]>,
    );

    expect(Object.keys(groups)).toEqual(["2026-6"]);
    expect(groups["2026-6"]).toHaveLength(3);
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
