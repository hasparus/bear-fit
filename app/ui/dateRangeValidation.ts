import { type DateRange } from "@daypicker/react";

import { isBoundedDateInterval } from "../calendarDateRange";

export const isValidDateRange = (dateRange: DateRange): boolean => {
  return !!(
    dateRange.from &&
    dateRange.to &&
    dateRange.from < dateRange.to &&
    isBoundedDateInterval(dateRange.from, dateRange.to)
  );
};

export const requireValidDateRange = (
  dateRange: DateRange,
): { from: Date; to: Date } => {
  const { from, to } = dateRange;
  if (!from || !to || !isValidDateRange(dateRange)) {
    throw new Error("an ordered date range of at most 366 days is required");
  }
  return { from, to };
};
