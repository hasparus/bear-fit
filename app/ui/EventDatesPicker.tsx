import { type DateRange } from "react-day-picker";

import { isoDate, type IsoDate, type RollingWindow } from "../schemas";
import { CheckboxField } from "./CheckboxField";
import { DateRangePicker, type DateRangePickerProps } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";
import {
  DEFAULT_ROLLING_PRESET,
  RollingWindowControls,
} from "./RollingWindowControls";

export interface EventDatesValue {
  isRolling: boolean;
  range: DateRange;
  rolling: RollingWindow;
}

export type EventDatesPayload =
  | { endDate: IsoDate; kind: "fixed"; startDate: IsoDate }
  | { kind: "rolling"; rolling: RollingWindow };

export const defaultEventDatesValue = (
  partial?: Partial<EventDatesValue>,
): EventDatesValue => ({
  isRolling: false,
  range: { from: undefined, to: undefined },
  rolling: DEFAULT_ROLLING_PRESET.value,
  ...partial,
});

export const isEventDatesValueValid = (value: EventDatesValue): boolean =>
  value.isRolling || isValidDateRange(value.range);

export const eventDatesValueToPayload = (
  value: EventDatesValue,
): EventDatesPayload => {
  if (value.isRolling) return { kind: "rolling", rolling: value.rolling };
  const { from, to } = requireValidDateRange(value.range);
  return { endDate: isoDate(to), kind: "fixed", startDate: isoDate(from) };
};

export interface EventDatesPickerProps {
  checkboxId: string;
  fixedRangeLabel?: string;
  onChange: (value: EventDatesValue) => void;
  value: EventDatesValue;
  fixedRangeProps?: Pick<
    DateRangePickerProps,
    "disabled" | "modifiers" | "modifiersClassNames"
  >;
}

export function EventDatesPicker({
  checkboxId,
  fixedRangeLabel = "Choose a date range",
  fixedRangeProps,
  onChange,
  value,
}: EventDatesPickerProps) {
  return (
    <>
      <div className="mb-4">
        <CheckboxField
          id={checkboxId}
          checked={value.isRolling}
          onChange={(e) => onChange({ ...value, isRolling: e.target.checked })}
        >
          Rolling window
        </CheckboxField>
        <small className="block text-neutral-500 mt-1">
          always show today through a fixed amount of time ahead
        </small>
      </div>
      {value.isRolling ? (
        <RollingWindowControls
          onChange={(rolling) => onChange({ ...value, rolling })}
          value={value.rolling}
        />
      ) : (
        <div className="mb-4">
          <label className="mb-2 block">
            <span>{fixedRangeLabel}</span>
            <small className="block text-neutral-500">
              what times should the guests consider?
            </small>
          </label>
          <DateRangePicker
            {...fixedRangeProps}
            onSelect={(range) => onChange({ ...value, range })}
            selected={value.range}
          />
        </div>
      )}
    </>
  );
}
