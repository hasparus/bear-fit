import { type DateRange } from "react-day-picker";

import { isoDate, type IsoDate, type RollingWindow } from "../schemas";
import { DateRangePicker, type DateRangePickerProps } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";
import { RadioField } from "./RadioField";
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
  /** Radio group name; must be unique per picker instance on the page. */
  name: string;
  fixedRangeLabel?: string;
  onChange: (value: EventDatesValue) => void;
  value: EventDatesValue;
  fixedRangeProps?: Pick<
    DateRangePickerProps,
    "disabled" | "modifiers" | "modifiersClassNames"
  >;
}

export function EventDatesPicker({
  name,
  fixedRangeLabel = "Choose a date range",
  fixedRangeProps,
  onChange,
  value,
}: EventDatesPickerProps) {
  return (
    <>
      <div role="radiogroup" aria-label="Calendar mode" className="mb-4">
        <RadioField
          id={`${name}-finite`}
          name={name}
          checked={!value.isRolling}
          onChange={() => onChange({ ...value, isRolling: false })}
        >
          Finite
        </RadioField>
        <RadioField
          id={`${name}-rolling`}
          name={name}
          checked={value.isRolling}
          onChange={() => onChange({ ...value, isRolling: true })}
        >
          Rolling window
        </RadioField>
        <small className="block text-neutral-500 mt-1">
          rolling always shows today through a fixed amount of time ahead
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
