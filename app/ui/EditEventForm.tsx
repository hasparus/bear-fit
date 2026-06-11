import Clarity from "@microsoft/clarity";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import {
  addDays,
  type CalendarEvent,
  resolveEventDates,
  startOfTodayUtc,
} from "../schemas";
import { type EventDatesPatch } from "../shared-data";
import { handleCalendarArrowKeys } from "./DateRangePicker";
import {
  defaultEventDatesValue,
  EventDatesPicker,
  type EventDatesValue,
  eventDatesValueToPatch,
  isEventDatesValueValid,
} from "./EventDatesPicker";

export interface EditEventFormProps {
  event: CalendarEvent;
  onSubmit: (patch: EventDatesPatch) => Promise<void>;
}

export function EditEventForm({ event, onSubmit }: EditEventFormProps) {
  const { endDate, startDate } = resolveEventDates(event);
  // UTC-midnight seeds; DateRangePicker pins react-day-picker to timeZone="UTC",
  // so every date it receives or emits is bucketed by its UTC day.
  const seedStart = startDate ? new Date(startDate) : undefined;
  const seedEnd = endDate ? new Date(endDate) : undefined;

  const [dates, setDates] = useState<EventDatesValue>(() =>
    defaultEventDatesValue({
      isRolling: !!event.rolling,
      range: { from: seedStart, to: seedEnd },
    }),
  );

  const today = startOfTodayUtc();
  const earliestDate = seedStart && seedStart < today ? seedStart : today;
  const initialRange: DateRange | undefined =
    seedStart && seedEnd ? { from: seedStart, to: seedEnd } : undefined;

  return (
    <form
      className="flex flex-col gap-4 min-h-0 flex-1"
      onKeyDown={handleCalendarArrowKeys}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(eventDatesValueToPatch(dates)).finally(() => {
          Clarity.event("event-dates-edited");
        });
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EventDatesPicker
          fixedRangeLabel="Choose new range"
          name="edit-calendar-mode"
          onChange={setDates}
          value={dates}
          fixedRangeProps={{
            disabled: { before: earliestDate },
            modifiersClassNames: { initial: "*:bg-neutral-100" },
            modifiers: {
              initial: initialRange ? unfoldDateRange(initialRange) : [],
            },
          }}
        />
      </div>
      <button
        type="submit"
        className="btn btn-default w-full shrink-0"
        disabled={!isEventDatesValueValid(dates)}
        style={{ borderWidth: "0.5em" }}
      >
        Save Changes
      </button>
    </form>
  );
}

function unfoldDateRange(range: DateRange): Date[] {
  const { from, to } = range;
  if (!from || !to) return [];
  const dates: Date[] = [];
  // inputs are UTC-midnight dates, so step in UTC days (immune to DST shifts)
  for (let date = new Date(from); date <= to; date = addDays(date, 1)) {
    dates.push(date);
  }
  return dates;
}
