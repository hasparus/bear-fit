import * as v from "valibot";

const isoDate = () => v.pipe(v.string(), v.isoDate(), v.brand("IsoDate"));

export type IsoDate = v.InferOutput<ReturnType<typeof isoDate>>;

export const IsoDate = (date: Date): IsoDate =>
  date.toISOString().split("T")[0] as IsoDate;

export const CalendarEvent = v.object({
  id: v.string(),
  name: v.string(),
  startDate: isoDate(),
  endDate: isoDate(),
});

export type CalendarEvent = v.InferOutput<typeof CalendarEvent>;

export const AvailabilityDelta = v.object({
  userId: v.string(),
  name: v.optional(v.string()),
  add: v.optional(v.array(v.string())),
  remove: v.optional(v.array(v.string())),
});

export type AvailabilityDelta = v.InferOutput<typeof AvailabilityDelta>;

export type UserId = string & { __brand: "UserId" };

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
  return { userId: userId as UserId, date: date as IsoDate };
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
  userId: UserId;
  date: IsoDate;
} => {
  const [userId, date] = key.split(AVAILABILITY_KEY_SEPARATOR);

  if (!v.is(isoDate(), date)) {
    throw new Error(`Invalid AvailabilityKey with IsoDate: ${date}`);
  }

  return { userId: userId as UserId, date: date as IsoDate };
};

export type AvailabilitySet = Record<AvailabilityKey, true>;
