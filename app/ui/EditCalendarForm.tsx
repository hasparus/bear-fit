import Clarity from "@microsoft/clarity";
import { useState } from "react";

import {
  type CalendarEvent,
  resolveCalendarDates,
  startOfTodayUtc,
} from "../schemas";
import { type CalendarDatesPatch } from "../shared-data";
import {
  CalendarDatesPicker,
  type CalendarDatesValue,
  calendarDatesValueToPatch,
  defaultCalendarDatesValue,
  isCalendarDatesValueValid,
} from "./CalendarDatesPicker";
import { handleCalendarArrowKeys } from "./DateRangePicker";
import { eachDayOfInterval } from "./eachDayOfInterval";

export interface EditCalendarFormProps {
  event: CalendarEvent;
  onSubmit: (patch: CalendarDatesPatch) => Promise<void>;
}

export function EditCalendarForm({ event, onSubmit }: EditCalendarFormProps) {
  const { endDate, startDate } = resolveCalendarDates(event);
  const seedStart = startDate ? new Date(startDate) : undefined;
  const seedEnd = endDate ? new Date(endDate) : undefined;

  const [dates, setDates] = useState<CalendarDatesValue>(() =>
    defaultCalendarDatesValue({
      isRolling: !!event.rolling,
      range: { from: seedStart, to: seedEnd },
    }),
  );

  const today = startOfTodayUtc();
  const earliestDate = seedStart && seedStart < today ? seedStart : today;

  return (
    <form
      className="flex flex-col gap-4 min-h-0 flex-1"
      onKeyDown={handleCalendarArrowKeys}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(calendarDatesValueToPatch(dates)).finally(() => {
          Clarity.event("event-dates-edited");
        });
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CalendarDatesPicker
          fixedRangeLabel="Choose new range"
          name="edit-calendar-mode"
          onChange={setDates}
          value={dates}
          fixedRangeProps={{
            disabled: { before: earliestDate },
            modifiersClassNames: { initial: "*:bg-neutral-100" },
            modifiers: {
              initial:
                seedStart && seedEnd
                  ? eachDayOfInterval(seedStart, seedEnd)
                  : [],
            },
          }}
        />
      </div>
      <button
        type="submit"
        className="btn btn-default w-full shrink-0"
        disabled={!isCalendarDatesValueValid(dates)}
        style={{ borderWidth: "0.5em" }}
      >
        Save Changes
      </button>
    </form>
  );
}

