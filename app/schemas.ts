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
): { endDate: IsoDate; startDate: IsoDate } => ({
  endDate: isoDate(addDays(today, days)),
  startDate: isoDate(today),
});

export const CalendarEvent = type({
  id: "string",
  creator: UserId,
  "endDate?": IsoDate,
  name: "string",
  "rolling?": "number.integer > 0",
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

export type EventDatesPatch =
  | { endDate: IsoDate; startDate: IsoDate }
  | { rolling: number };

export const resolveEventDates = (
  event: Pick<Partial<CalendarEvent>, "endDate" | "rolling" | "startDate">,
  today: Date = startOfTodayUtc(),
): { endDate: IsoDate | undefined; startDate: IsoDate | undefined } => {
  if (event.rolling) return resolveRollingWindow(event.rolling, today);
  return { endDate: event.endDate, startDate: event.startDate };
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
