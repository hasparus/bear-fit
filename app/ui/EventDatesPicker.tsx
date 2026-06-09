import { type DateRange } from "react-day-picker";

import { isoDate, type IsoDate, type RollingWindow } from "../schemas";
import { CheckboxField } from "./CheckboxField";
import { DateRangePicker, type DateRangePickerProps } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";

const DEFAULT_ROLLING_DAYS = 14;

export interface EventDatesValue {
  isRolling: boolean;
  range: DateRange;
}

export type EventDatesPayload =
  | { endDate: IsoDate; kind: "fixed"; startDate: IsoDate }
  | { kind: "rolling"; rolling: RollingWindow };

export const defaultEventDatesValue = (
  partial?: Partial<EventDatesValue>,
): EventDatesValue => ({
  isRolling: false,
  range: { from: undefined, to: undefined },
  ...partial,
});

const startOfTodayUtc = (): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

const utcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

const diffDays = (later: Date, earlier: Date): number =>
  (utcDay(later) - utcDay(earlier)) / 86_400_000;

const addDays = (date: Date, days: number): Date =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + days,
    ),
  );

const rangeToRolling = (range: DateRange, today: Date): RollingWindow => {
  const { to } = requireValidDateRange({ from: today, to: range.to });
  return {
    end: { days: diffDays(to, today), months: 0 },
    start: { days: 0, months: 0 },
  };
};

export const isEventDatesValueValid = (value: EventDatesValue): boolean => {
  if (value.isRolling) {
    const today = startOfTodayUtc();
    return isValidDateRange({ from: today, to: value.range.to });
  }
  return isValidDateRange(value.range);
};

export const eventDatesValueToPayload = (
  value: EventDatesValue,
): EventDatesPayload => {
  if (value.isRolling) {
    const today = startOfTodayUtc();
    return {
      kind: "rolling",
      rolling: rangeToRolling({ from: today, to: value.range.to }, today),
    };
  }
  const { from, to } = requireValidDateRange(value.range);
  return { endDate: isoDate(to), kind: "fixed", startDate: isoDate(from) };
};

export interface EventDatesPickerProps {
  fixedRangeLabel?: string;
  name: string;
  onChange: (value: EventDatesValue) => void;
  value: EventDatesValue;
  fixedRangeProps?: Pick<
    DateRangePickerProps,
    "disabled" | "modifiers" | "modifiersClassNames"
  >;
}

export function EventDatesPicker({
  fixedRangeLabel = "Choose a date range",
  fixedRangeProps,
  name,
  onChange,
  value,
}: EventDatesPickerProps) {
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
      </CheckboxField>
    </div>
  );
}
