import { type DateRange } from "@daypicker/react";

import {
  addDays,
  type CalendarDatesPatch,
  diffDays,
  isoDate,
  startOfTodayUtc,
} from "../schemas";
import { CheckboxField } from "./CheckboxField";
import { DateRangePicker, type DateRangePickerProps } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";

const DEFAULT_ROLLING_DAYS = 14;

export interface CalendarDatesValue {
  isRolling: boolean;
  range: DateRange;
}

export const defaultCalendarDatesValue = (
  partial?: Partial<CalendarDatesValue>,
): CalendarDatesValue => ({
  isRolling: false,
  range: { from: undefined, to: undefined },
  ...partial,
});

export const isCalendarDatesValueValid = (value: CalendarDatesValue): boolean => {
  if (value.isRolling) {
    const today = startOfTodayUtc();
    return isValidDateRange({ from: today, to: value.range.to });
  }
  return isValidDateRange(value.range);
};

export const calendarDatesValueToPatch = (
  value: CalendarDatesValue,
): CalendarDatesPatch => {
  if (value.isRolling) {
    const today = startOfTodayUtc();
    const { to } = requireValidDateRange({ from: today, to: value.range.to });
    return { rolling: diffDays(to, today) };
  }
  const { from, to } = requireValidDateRange(value.range);
  return { endDate: isoDate(to), startDate: isoDate(from) };
};

export interface CalendarDatesPickerProps {
  fixedRangeLabel?: string;
  name: string;
  onChange: (value: CalendarDatesValue) => void;
  value: CalendarDatesValue;
  fixedRangeProps?: Pick<
    DateRangePickerProps,
    "disabled" | "modifiers" | "modifiersClassNames"
  >;
}

export function CalendarDatesPicker({
  fixedRangeLabel = "Choose a date range",
  fixedRangeProps,
  name,
  onChange,
  value,
}: CalendarDatesPickerProps) {
  const today = startOfTodayUtc();
  const selected = value.isRolling
    ? { from: today, to: value.range.to }
    : value.range;

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (value.isRolling) {
      const picked = range?.to ?? range?.from;
      if (!picked) return;
      const nextRange = { from: today, to: picked };
      if (!isValidDateRange(nextRange)) return;
      onChange({ ...value, range: nextRange });
      return;
    }
    onChange({
      ...value,
      range: range || { from: undefined, to: undefined },
    });
  };

  const handleRollingChange = (checked: boolean) => {
    if (!checked) {
      onChange({ ...value, isRolling: false });
      return;
    }
    const dayCount =
      value.range.from && value.range.to
        ? diffDays(value.range.to, value.range.from)
        : DEFAULT_ROLLING_DAYS;
    onChange({
      ...value,
      isRolling: true,
      range: { from: today, to: addDays(today, dayCount) },
    });
  };

  const rollingDays =
    value.isRolling && value.range.to
      ? diffDays(value.range.to, today)
      : undefined;

  return (
    <div className="mb-4">
      <label className="mb-2 block">
        <span>{fixedRangeLabel}</span>
        <small className="block text-neutral-500">
          what times should the guests consider?
        </small>
      </label>
      <DateRangePicker
        {...fixedRangeProps}
        onSelect={handleRangeSelect}
        selected={selected}
        disabled={
          value.isRolling ? { before: today } : fixedRangeProps?.disabled
        }
      />
      <CheckboxField
        id={`${name}-rolling`}
        checked={value.isRolling}
        className="mt-2"
        onChange={(event) => handleRollingChange(event.target.checked)}
      >
        Rolling window
        {rollingDays !== undefined && rollingDays > 0 && (
          <small className="ml-2 text-neutral-500">
            {rollingDays} day{rollingDays === 1 ? "" : "s"} ahead
          </small>
        )}
      </CheckboxField>
    </div>
  );
}

export type { CalendarDatesPatch };
