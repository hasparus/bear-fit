import { type } from "arktype";
import { describe, expect, it } from "vitest";

import { MAX_CALENDAR_DAYS } from "../app/calendarDateRange";
import {
  CalendarEvent,
  IsoDate,
  resolveCalendarDates,
  resolveRollingWindow,
} from "../app/schemas";
import {
  isValidDateRange,
  requireValidDateRange,
} from "../app/ui/dateRangeValidation";
import { eachDayOfInterval } from "../app/ui/eachDayOfInterval";

const event = { id: "bounded", creator: "test", name: "Bounded dates" };
const fixed = { endDate: "2024-12-31", startDate: "2024-01-01" };
const today = new Date("2024-01-01");

describe("bounded calendar dates", () => {
  it("expands the inclusive maximum across a leap year", () => {
    const days = eachDayOfInterval(today, new Date(fixed.endDate));
    expect(days).toHaveLength(MAX_CALENDAR_DAYS);
    expect(days?.[59].toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(resolveCalendarDates(fixed)).toEqual(fixed);
    expect(CalendarEvent({ ...event, ...fixed })).not.toBeInstanceOf(
      type.errors,
    );
  });

  it("rejects MAX+1 before expanding dates", () => {
    expect(eachDayOfInterval(today, new Date("2025-01-01"))).toBeNull();
    const oversized = { ...fixed, endDate: "2025-01-01" };
    expect(resolveCalendarDates(oversized)).toBeNull();
    expect(CalendarEvent({ ...event, ...oversized })).toBeInstanceOf(
      type.errors,
    );
  });

  it.each([
    ["invalid", "2024-01-01"],
    ["2024-01-01", "invalid"],
    ["2024-01-02", "2024-01-01"],
  ])("rejects invalid or reversed intervals: %s to %s", (from, to) => {
    expect(eachDayOfInterval(new Date(from), new Date(to))).toBeNull();
    expect(resolveCalendarDates({ endDate: to, startDate: from })).toBeNull();
  });

  it.each(["invalid", "2024-02-30", "2024-2-01", "", "2024-01-01T00:00:00Z"])(
    "rejects malformed ISO dates without throwing: %s",
    (date) => {
      expect(IsoDate(date)).toBeInstanceOf(type.errors);
      expect(
        CalendarEvent({ ...event, ...fixed, startDate: date }),
      ).toBeInstanceOf(type.errors);
    },
  );

  it.each([0, -1, 0.5, 366, NaN, Infinity, -Infinity, 1e300])(
    "rejects invalid rolling days before arithmetic: %s",
    (rolling) => {
      expect(resolveRollingWindow(rolling, today)).toBeNull();
      expect(resolveCalendarDates({ rolling }, today)).toBeNull();
      expect(CalendarEvent({ ...event, rolling })).toBeInstanceOf(type.errors);
    },
  );

  it("resolves valid rolling limits and rejects invalid or overflowing today", () => {
    for (const rolling of [1, 14, 365]) {
      const dates = resolveRollingWindow(rolling, today);
      expect(dates).not.toBeNull();
      expect(
        eachDayOfInterval(new Date(dates!.startDate), new Date(dates!.endDate)),
      ).toHaveLength(rolling + 1);
      expect(CalendarEvent({ ...event, rolling })).not.toBeInstanceOf(
        type.errors,
      );
    }
    expect(resolveRollingWindow(1, new Date(NaN))).toBeNull();
    expect(resolveRollingWindow(365, new Date(8.64e15))).toBeNull();
    expect(resolveCalendarDates({ rolling: "14" })).toBeNull();
    expect(resolveCalendarDates({ ...fixed, rolling: 14 })).toBeNull();
  });

  it("distinguishes incomplete documents from invalid dates", () => {
    expect(resolveCalendarDates({})).toBeUndefined();
    expect(
      resolveCalendarDates({ startDate: fixed.startDate }),
    ).toBeUndefined();
    expect(resolveCalendarDates({ startDate: "invalid" })).toBeNull();
    expect(resolveCalendarDates({ endDate: null })).toBeNull();
  });

  it("keeps strict form ordering, bounded validation and past-date editing", () => {
    const maximum = { from: today, to: new Date(fixed.endDate) };
    expect(isValidDateRange(maximum)).toBe(true);
    expect(requireValidDateRange(maximum)).toEqual(maximum);
    for (const range of [
      { from: today, to: today },
      { from: today, to: new Date("2025-01-01") },
      { from: new Date(NaN), to: today },
      { from: today, to: undefined },
      { from: new Date("2024-01-02"), to: today },
    ]) {
      expect(isValidDateRange(range)).toBe(false);
      expect(() => requireValidDateRange(range)).toThrow();
    }
    expect(eachDayOfInterval(today, today)).toHaveLength(1);
  });
});
