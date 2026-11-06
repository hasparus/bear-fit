import { DAY_MS, isBoundedDateInterval } from "../calendarDateRange";

export function eachDayOfInterval(from: Date, to: Date): Date[] | null {
  if (!isBoundedDateInterval(from, to)) return null;
  const days = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY_MS)) {
    days.push(new Date(d));
  }
  return days;
}
