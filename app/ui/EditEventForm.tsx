import Clarity from "@microsoft/clarity";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import { type CalendarEvent, resolveEventDates } from "../schemas";
import { handleCalendarArrowKeys } from "./DateRangePicker";
import {
  defaultEventDatesValue,
  type EventDatesPayload,
  EventDatesPicker,
  type EventDatesValue,
  eventDatesValueToPayload,
  isEventDatesValueValid,
} from "./EventDatesPicker";

export interface EditEventFormProps {
  event: CalendarEvent;
  onSubmit: (payload: EventDatesPayload) => Promise<void>;
}

export function EditEventForm({ event, onSubmit }: EditEventFormProps) {
  // For a rolling event, seed the fixed-date controls with the currently
  // resolved window so toggling off rolling mode gives a sensible default.
  const { endDate, startDate } = resolveEventDates(event);
  const seedStart = startDate ? new Date(startDate) : undefined;
  const seedEnd = endDate ? new Date(endDate) : undefined;

  const [dates, setDates] = useState<EventDatesValue>(() =>
    defaultEventDatesValue({
      isRolling: !!event.rolling,
      range: { from: seedStart, to: seedEnd },
      ...(event.rolling && { rolling: event.rolling }),
    }),
  );

  const today = new Date();
  const earliestDate = seedStart && seedStart < today ? seedStart : today;
  const initialRange: DateRange | undefined =
    seedStart && seedEnd ? { from: seedStart, to: seedEnd } : undefined;

  return (
    <form
      className="flex flex-col gap-4 min-h-0 flex-1"
      onKeyDown={handleCalendarArrowKeys}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(eventDatesValueToPayload(dates)).finally(() => {
          Clarity.event("event-dates-edited");
        });
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EventDatesPicker
          name="edit-calendar-mode"
          fixedRangeLabel="Choose new range"
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
  for (
    let date = new Date(from);
    date <= to;
    date.setDate(date.getDate() + 1)
  ) {
    dates.push(new Date(date));
  }
  return dates;
}
