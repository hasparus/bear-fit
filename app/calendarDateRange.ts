export const MAX_CALENDAR_DAYS = 366;
export const DAY_MS = 86_400_000;

export const INVALID_CALENDAR_DATES_MESSAGE =
  "Invalid calendar dates. Choose an ordered date range of at most 366 days (365 days ahead for rolling calendars).";

export const isIsoDateString = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

export const isRollingDays = (days: unknown): days is number =>
  typeof days === "number" &&
  Number.isInteger(days) &&
  days > 0 &&
  days < MAX_CALENDAR_DAYS;

export const isBoundedDateInterval = (from: Date, to: Date): boolean => {
  const start = from.getTime();
  const end = to.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
    return false;
  }
  const startDay = new Date(start);
  const endDay = new Date(end);
  startDay.setUTCHours(0, 0, 0, 0);
  endDay.setUTCHours(0, 0, 0, 0);
  return (endDay.getTime() - startDay.getTime()) / DAY_MS < MAX_CALENDAR_DAYS;
};
