import Clarity from "@microsoft/clarity";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import {
  CalendarEvent,
  isoDate,
  IsoDate,
  resolveCalendarEvent,
  type RollingWindow,
} from "../schemas";
import { CheckboxField } from "./CheckboxField";
import { DateRangePicker, handleCalendarArrowKeys } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";
import {
  DEFAULT_ROLLING_PRESET,
  RollingWindowControls,
} from "./RollingWindowControls";

export type EditEventPayload =
  | { endDate: IsoDate; kind: "fixed"; startDate: IsoDate }
  | { kind: "rolling"; rolling: RollingWindow };

export interface EditEventFormProps {
  event: CalendarEvent;
  onSubmit: (payload: EditEventPayload) => Promise<void>;
}

export function EditEventForm({ event, onSubmit }: EditEventFormProps) {
  const [isRolling, setIsRolling] = useState(!!event.rolling);
  const [rolling, setRolling] = useState<RollingWindow>(
    event.rolling ?? DEFAULT_ROLLING_PRESET.value,
  );

  // For a rolling event, seed the fixed-date controls with the currently
  // resolved window so toggling off rolling mode gives a sensible default.
  const resolved = resolveCalendarEvent(event);
  const seedStart = resolved.startDate
    ? new Date(resolved.startDate)
    : undefined;
  const seedEnd = resolved.endDate ? new Date(resolved.endDate) : undefined;

  const [dateRange, setDateRange] = useState<DateRange>({
    from: seedStart,
    to: seedEnd,
  });

  const today = new Date();
  const earliestDate = seedStart && seedStart < today ? seedStart : today;

  const canSubmit = isRolling || isValidDateRange(dateRange);

  return (
    <form
      onKeyDown={handleCalendarArrowKeys}
      onSubmit={(e) => {
        e.preventDefault();

        const payload: EditEventPayload = isRolling
          ? { kind: "rolling", rolling }
          : (() => {
              const { from, to } = requireValidDateRange(dateRange);
              return {
                endDate: isoDate(to),
                kind: "fixed",
                startDate: isoDate(from),
              };
            })();

        onSubmit(payload).finally(() => {
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
              initial:
                seedStart && seedEnd
                  ? unfoldDateRange({ from: seedStart, to: seedEnd })
                  : [],
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
