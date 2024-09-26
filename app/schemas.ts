import * as v from "valibot";

const isoDate = () => v.pipe(v.string(), v.isoDate(), v.brand("IsoDate"));

export type IsoDate = v.InferOutput<ReturnType<typeof isoDate>>;

export const IsoDate = (date: Date): IsoDate =>
  date.toISOString().split("T")[0] as IsoDate;

export const CalendarEvent = v.object({
  endDate: isoDate(),
  id: v.string(),
  name: v.string(),
  startDate: isoDate(),
});

export type CalendarEvent = v.InferOutput<typeof CalendarEvent>;

export const AvailabilityDelta = v.object({
  add: v.optional(v.array(v.string())),
  name: v.optional(v.string()),
  remove: v.optional(v.array(v.string())),
  userId: v.string(),
});

export type AvailabilityDelta = v.InferOutput<typeof AvailabilityDelta>;

export type UserId = { __brand: "UserId" } & string;

const AVAILABILITY_KEY_SEPARATOR = "〷";
export type AvailabilityKey =
  `${UserId}${typeof AVAILABILITY_KEY_SEPARATOR}${IsoDate}`;

export const AvailabilityKey = (
  userId: UserId,
  date: IsoDate
): AvailabilityKey =>
  `${userId}${AVAILABILITY_KEY_SEPARATOR}${date}` as AvailabilityKey;

AvailabilityKey.split = (key: AvailabilityKey) => {
  const [userId, date] = key.split(AVAILABILITY_KEY_SEPARATOR);
  return { date: date as IsoDate, userId: userId as UserId };
};

AvailabilityKey.parse = (key: string): AvailabilityKey => {
  const [_, date] = key.split(AVAILABILITY_KEY_SEPARATOR);

  if (!v.is(isoDate(), date)) {
    throw new Error(`Invalid AvailabilityKey with IsoDate: ${date}`);
  }

  return key as AvailabilityKey;
};

AvailabilityKey.parseToObject = (
  key: string
): {
  date: IsoDate;
  userId: UserId;
} => {
  const [userId, date] = key.split(AVAILABILITY_KEY_SEPARATOR);

  if (!v.is(isoDate(), date)) {
    throw new Error(`Invalid AvailabilityKey with IsoDate: ${date}`);
  }

  return { date: date as IsoDate, userId: userId as UserId };
};

export type AvailabilitySet = Record<AvailabilityKey, true>;
