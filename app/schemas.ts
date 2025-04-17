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

export const CalendarEvent = type({
  id: "string",
  creator: UserId,
  endDate: IsoDate,
  name: "string",
  startDate: IsoDate,
});

export type CalendarEvent = typeof CalendarEvent.infer;

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
