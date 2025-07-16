import { type DateRange } from "react-day-picker";

export const isValidDateRange = (dateRange: DateRange): boolean => {
  return !!(dateRange.from && dateRange.to && dateRange.from < dateRange.to);
};

export const requireValidDateRange = (
  dateRange: DateRange,
): { from: Date; to: Date } => {
  const { from, to } = dateRange;
  if (!from || !to) {
    throw new Error("full date range is required");
  }
  return { from, to };
};
