import Clarity from "@microsoft/clarity";
import { useState } from "react";

import {
  type CalendarEvent,
  resolveEventDates,
  startOfTodayUtc,
} from "../schemas";
import { type EventDatesPatch } from "../shared-data";
import { handleCalendarArrowKeys } from "./DateRangePicker";
import { eachDayOfInterval } from "./eachDayOfInterval";
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
        disabled={!isEventDatesValueValid(dates)}
        style={{ borderWidth: "0.5em" }}
      >
        Save Changes
      </button>
    </form>
  );
}

