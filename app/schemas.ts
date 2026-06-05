import { type } from "arktype";

export const IsoDate = type("string")
  .narrow((date, ctx): boolean => {
    const parsed = new Date(date);
    return (
      date === isoDate(parsed) || ctx.reject("an ISO date in YYYY-MM-DD format")
    );
  })
  .brand("IsoDate");

export type IsoDate = typeof IsoDate.infer;

export const isoDate = (date: Date): IsoDate =>
  date.toISOString().split("T")[0] as IsoDate;

export const UserId = type("string").brand("UserId");
export type UserId = typeof UserId.infer;

// A non-negative integer count of days and months relative to a reference date.
export const RollingOffset = type({
  days: "number.integer >= 0",
  months: "number.integer >= 0",
});

export type RollingOffset = typeof RollingOffset.infer;

// A rolling window: two offsets from "today". Refinement: end strictly after start.
export const RollingWindow = type({
  end: RollingOffset,
  start: RollingOffset,
}).narrow(
  (window, ctx) =>
    offsetToApproxDays(window.end) > offsetToApproxDays(window.start) ||
    ctx.reject({ expected: "end offset to be after start offset" }),
);

export type RollingWindow = typeof RollingWindow.infer;

const offsetToApproxDays = (o: RollingOffset): number => o.months * 31 + o.days;

export const CalendarEvent = type({
  id: "string",
  creator: UserId,
  "endDate?": IsoDate,
  name: "string",
  "rolling?": RollingWindow,
  "startDate?": IsoDate,
}).narrow((event, ctx): boolean => {
  if (event.rolling) {
    return (
      (!event.startDate && !event.endDate) ||
      ctx.reject({
        expected: "no startDate or endDate on rolling events",
      })
    );
  }
  return (
    !!(event.startDate && event.endDate) ||
    ctx.reject({
      expected: "either both startDate and endDate, or a rolling window",
    })
  );
});

export type CalendarEvent = typeof CalendarEvent.infer;

const applyOffset = (today: Date, offset: RollingOffset): IsoDate =>
  isoDate(
    new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() + offset.months,
        today.getUTCDate() + offset.days,
      ),
    ),
  );

export const resolveRollingWindow = (
  window: RollingWindow,
  today: Date = new Date(),
): { endDate: IsoDate; startDate: IsoDate } => ({
  endDate: applyOffset(today, window.end),
  startDate: applyOffset(today, window.start),
});

export const resolveCalendarEvent = <T extends Partial<CalendarEvent>>(
  event: T,
  today: Date = new Date(),
): T & { endDate?: IsoDate; startDate?: IsoDate } => {
  if (!event.rolling) return event;
  return { ...event, ...resolveRollingWindow(event.rolling, today) };
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
