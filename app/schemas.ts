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

export type AvailabilityKey = `${UserId}-${IsoDate}`;
export type AvailabilitySet = Record<AvailabilityKey, true>;
