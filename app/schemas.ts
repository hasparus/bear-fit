import { type } from "arktype";

import {
  DAY_MS,
  isBoundedDateInterval,
  isIsoDateString,
  isRollingDays,
} from "./calendarDateRange";

export const IsoDate = type("string")
  .narrow((date, ctx): boolean => {
    return (
      isIsoDateString(date) || ctx.reject("an ISO date in YYYY-MM-DD format")
    );
  })
  .brand("IsoDate");

export type IsoDate = typeof IsoDate.infer;

export const isoDate = (date: Date): IsoDate =>
  date.toISOString().split("T")[0] as IsoDate;

export const formatIsoDate = (date: IsoDate): string =>
  new Date(date).toLocaleDateString(undefined, { timeZone: "UTC" });

export const UserId = type("string").brand("UserId");
export type UserId = typeof UserId.infer;

export const startOfTodayUtc = (): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

export const utcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export const diffDays = (later: Date, earlier: Date): number =>
  (utcDay(later) - utcDay(earlier)) / 86_400_000;

export const addDays = (date: Date, days: number): Date =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
    ),
  );

export const resolveRollingWindow = (
  days: number,
  today: Date = startOfTodayUtc(),
): { endDate: IsoDate; startDate: IsoDate } | null => {
  if (!isRollingDays(days) || !Number.isFinite(today.getTime())) return null;
  const start = new Date(today);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + days * DAY_MS);
  if (!isBoundedDateInterval(start, end)) return null;
  const startDate = isoDate(start);
  const endDate = isoDate(end);
  if (!isIsoDateString(startDate) || !isIsoDateString(endDate)) return null;
  return { endDate, startDate };
};

export const CalendarEvent = type({
  id: "string",
  creator: UserId,
  "endDate?": IsoDate,
  name: "string",
  "startDate?": IsoDate,
  "rolling?": type("number.integer").narrow(
    (days, ctx) =>
      isRollingDays(days) || ctx.reject("a rolling window of 1–365 days"),
  ),
}).narrow((event, ctx): boolean => {
  return (
    !!resolveCalendarDates(event) ||
    ctx.reject({
      expected:
        "an ordered range of at most 366 days, or a rolling window of 1–365 days without fixed dates",
    })
  );
});

export type CalendarEvent = typeof CalendarEvent.infer;

export type CalendarDatesPatch =
  | { endDate: IsoDate; startDate: IsoDate }
  | { rolling: number };

export const resolveCalendarDates = (
  event: { endDate?: unknown; rolling?: unknown; startDate?: unknown },
  today: Date = startOfTodayUtc(),
): { endDate: IsoDate; startDate: IsoDate } | null | undefined => {
  if (event.rolling !== undefined) {
    if (
      !isRollingDays(event.rolling) ||
      event.startDate !== undefined ||
      event.endDate !== undefined
    )
      return null;
    return resolveRollingWindow(event.rolling, today);
  }
  const { endDate, startDate } = event;
  if (
    (startDate !== undefined && !isIsoDateString(startDate)) ||
    (endDate !== undefined && !isIsoDateString(endDate))
  )
    return null;
  if (startDate === undefined || endDate === undefined) return undefined;
  if (!isBoundedDateInterval(new Date(startDate), new Date(endDate)))
    return null;
  return { endDate: endDate as IsoDate, startDate: startDate as IsoDate };
};

export const AvailabilityDelta = type({
  "add?": type(["string"]),
  "name?": type("string"),
  "remove?": type(["string"]),
  userId: "string",
});

export type AvailabilityDelta = typeof AvailabilityDelta.infer;

const AVAILABILITY_KEY_SEPARATOR = "〷";
export type AvailabilityKey =
  `${UserId}${typeof AVAILABILITY_KEY_SEPARATOR}${IsoDate}`;

export const AvailabilityKey = (
  userId: UserId,
  date: IsoDate,
): AvailabilityKey =>
  `${userId}${AVAILABILITY_KEY_SEPARATOR}${date}` as AvailabilityKey;

AvailabilityKey.split = (key: AvailabilityKey) => {
  const [userId, date] = key.split(AVAILABILITY_KEY_SEPARATOR);
  return { date: date as IsoDate, userId: userId as UserId };
};

AvailabilityKey.parse = (key: string): AvailabilityKey => {
  const [_, date] = key.split(AVAILABILITY_KEY_SEPARATOR);

  if (IsoDate(date) instanceof type.errors) {
    throw new Error(`Invalid AvailabilityKey with IsoDate: ${date}`);
  }

  return key as AvailabilityKey;
};

AvailabilityKey.parseToObject = (
  key: string,
): {
  date: IsoDate;
  userId: UserId;
} => {
  const [userId, date] = key.split(AVAILABILITY_KEY_SEPARATOR);

  if (IsoDate(date) instanceof type.errors) {
    throw new Error(`Invalid AvailabilityKey with IsoDate: ${date}`);
  }

  return { date: date as IsoDate, userId: userId as UserId };
};

export type AvailabilitySet = Record<AvailabilityKey, true>;
