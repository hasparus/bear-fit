import { type } from "arktype";
import { describe, expect, it } from "vitest";

import {
  addDays,
  AvailabilityKey,
  CalendarEvent,
  diffDays,
  IsoDate,
  isoDate,
  resolveEventDates,
  resolveRollingWindow,
  UserId,
} from "./schemas";

const utc = (year: number, monthIndex: number, day: number) =>
  new Date(Date.UTC(year, monthIndex, day));

describe("isoDate", () => {
  it("formats a UTC date as YYYY-MM-DD", () => {
    expect(isoDate(utc(2026, 0, 31))).toBe("2026-01-31");
  });
});

describe("IsoDate", () => {
  it("rejects an impossible calendar date", () => {
    expect(IsoDate("2026-02-30")).toBeInstanceOf(type.errors);
  });

  it("accepts a valid date and returns the string back", () => {
    expect(IsoDate("2026-02-28")).toBe("2026-02-28");
  });

  it("throws on unparseable strings instead of returning errors", () => {
    // BUG: the IsoDate narrow calls toISOString() on an Invalid Date, so
    // unparseable strings throw RangeError instead of returning type.errors.
    expect(() => IsoDate("not-a-date")).toThrow(RangeError);
  });
});

describe("diffDays", () => {
  it("is 0 for the same instant", () => {
    const date = utc(2026, 5, 10);
    expect(diffDays(date, date)).toBe(0);
  });

  it("is 1 for consecutive UTC days", () => {
    expect(diffDays(utc(2026, 5, 11), utc(2026, 5, 10))).toBe(1);
  });

  it("is 1 across a DST change (UTC math is immune)", () => {
    // 2026-03-08 -> 2026-03-09 spans the US spring-forward transition.
    expect(diffDays(utc(2026, 2, 9), utc(2026, 2, 8))).toBe(1);
  });
});

describe("addDays", () => {
  it("rolls over month boundaries", () => {
    expect(isoDate(addDays(utc(2026, 0, 31), 1))).toBe("2026-02-01");
  });

  it("rolls over year boundaries", () => {
    expect(isoDate(addDays(utc(2026, 11, 31), 1))).toBe("2027-01-01");
  });

  it("supports negative days", () => {
    expect(isoDate(addDays(utc(2026, 0, 1), -1))).toBe("2025-12-31");
  });
});

describe("resolveRollingWindow", () => {
  it("returns today and today + days", () => {
    expect(resolveRollingWindow(7, utc(2026, 5, 10))).toEqual({
      endDate: "2026-06-17",
      startDate: "2026-06-10",
    });
  });
});

describe("resolveEventDates", () => {
  it("derives dates from today for rolling events, ignoring start/end", () => {
    expect(
      resolveEventDates(
        {
          endDate: IsoDate.assert("2030-01-01"),
          rolling: 3,
          startDate: IsoDate.assert("2029-01-01"),
        },
        utc(2026, 5, 10),
      ),
    ).toEqual({ endDate: "2026-06-13", startDate: "2026-06-10" });
  });

  it("passes fixed dates through", () => {
    expect(
      resolveEventDates(
        {
          endDate: IsoDate.assert("2026-06-12"),
          startDate: IsoDate.assert("2026-06-10"),
        },
        utc(2026, 5, 10),
      ),
    ).toEqual({ endDate: "2026-06-12", startDate: "2026-06-10" });
  });
});

describe("CalendarEvent", () => {
  const base = {
    id: "e1",
    creator: UserId.assert("u1"),
    name: "Standup",
  };

  it("accepts a fixed-dates event", () => {
    expect(() =>
      CalendarEvent.assert({
        ...base,
        endDate: "2026-06-12",
        startDate: "2026-06-10",
      }),
    ).not.toThrow();
  });

  it("accepts a rolling event", () => {
    expect(() => CalendarEvent.assert({ ...base, rolling: 3 })).not.toThrow();
  });

  it("rejects rolling combined with startDate", () => {
    expect(() =>
      CalendarEvent.assert({ ...base, rolling: 3, startDate: "2026-06-10" }),
    ).toThrow();
  });

  it("rejects an event with neither rolling nor dates", () => {
    expect(() => CalendarEvent.assert({ ...base })).toThrow();
  });

  it("rejects rolling: 0", () => {
    expect(() => CalendarEvent.assert({ ...base, rolling: 0 })).toThrow();
  });

  it("rejects rolling: 1.5", () => {
    expect(() => CalendarEvent.assert({ ...base, rolling: 1.5 })).toThrow();
  });
});

describe("AvailabilityKey", () => {
  const userId = UserId.assert("u1");
  const date = IsoDate.assert("2026-06-10");

  it("joins userId and date with the separator", () => {
    expect(AvailabilityKey(userId, date)).toBe("u1〷2026-06-10");
  });

  it("parseToObject round-trips", () => {
    expect(
      AvailabilityKey.parseToObject(AvailabilityKey(userId, date)),
    ).toEqual({ date: "2026-06-10", userId: "u1" });
  });

  it("parse throws on an invalid date part", () => {
    expect(() => AvailabilityKey.parse("u1〷not-a-date")).toThrow();
  });

  it("parse accepts an empty userId part", () => {
    // BUG: userId part unvalidated - only the date half is checked.
    expect(AvailabilityKey.parse("〷2026-06-10")).toBe("〷2026-06-10");
  });
});
