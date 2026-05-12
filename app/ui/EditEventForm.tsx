import Clarity from "@microsoft/clarity";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import {
  CalendarEvent,
  isoDate,
  IsoDate,
  resolveRollingWindow,
  type RollingWindow,
} from "../schemas";
import { CheckboxField } from "./CheckboxField";
import { DateRangePicker, handleCalendarArrowKeys } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";
import {
  DEFAULT_ROLLING_PRESET,
  RollingWindowControls,
} from "./RollingWindowControls";

export interface EditEventFormProps {
  event: CalendarEvent;
  onSubmit: (
    startDate: IsoDate,
    endDate: IsoDate,
    rolling: RollingWindow | undefined,
  ) => Promise<void>;
}

export function EditEventForm({ event, onSubmit }: EditEventFormProps) {
  const [isRolling, setIsRolling] = useState(!!event.rolling);
  const [rolling, setRolling] = useState<RollingWindow>(
    event.rolling ?? DEFAULT_ROLLING_PRESET.value,
  );
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(event.startDate),
    to: new Date(event.endDate),
  });

  const initialStartDate = new Date(event.startDate);
  const today = new Date();
  const earliestDate = initialStartDate < today ? initialStartDate : today;

  const canSubmit = isRolling || isValidDateRange(dateRange);

  return (
    <form
      onKeyDown={handleCalendarArrowKeys}
      onSubmit={(e) => {
        e.preventDefault();

        const dates = isRolling
          ? resolveRollingWindow(rolling)
          : (() => {
              const { from, to } = requireValidDateRange(dateRange);
              return { endDate: isoDate(to), startDate: isoDate(from) };
            })();

        onSubmit(
          dates.startDate,
          dates.endDate,
          isRolling ? rolling : undefined,
        ).finally(() => {
          Clarity.event("event-dates-edited");
        });
      }}
    >
      <div className="mb-4">
        <CheckboxField
          id="edit-is-rolling"
          checked={isRolling}
          onChange={(e) => setIsRolling(e.target.checked)}
        >
          Rolling window
        </CheckboxField>
        <small className="block text-neutral-500 mt-1">
          always show today through a fixed amount of time ahead
        </small>
      </div>
      {isRolling ? (
        <RollingWindowControls onChange={setRolling} value={rolling} />
      ) : (
        <div className="mb-4">
          <label className="mb-2 block">
            <span>Choose new range</span>
            <small className="block text-neutral-500">
              what times should the guests consider?
            </small>
          </label>
          <DateRangePicker
            disabled={{ before: earliestDate }}
            onSelect={setDateRange}
            selected={dateRange}
            modifiers={{
              initial: unfoldDateRange({
                from: initialStartDate,
                to: new Date(event.endDate),
              }),
            }}
            modifiersClassNames={{
              initial: "*:bg-neutral-100",
            }}
          />
        </div>
      )}
      <button
        type="submit"
        className="btn btn-default w-full"
        disabled={!canSubmit}
        style={{ borderWidth: "0.5em" }}
      >
        Save Changes
      </button>
    </form>
  );
}

function unfoldDateRange(dateRange: Required<DateRange>): Date[] {
  const { from, to } = dateRange;
  const dates = [];
  for (
    let date = new Date(from!);
    date <= to;
    date.setDate(date.getDate() + 1)
  ) {
    dates.push(new Date(date));
  }
  return dates;
}
