import Clarity from "@microsoft/clarity";
import { nanoid } from "nanoid";
import { useState } from "react";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { getUserId } from "../getUserId";
import { type CalendarEvent } from "../schemas";
import { Container } from "./Container";
import { handleCalendarArrowKeys } from "./DateRangePicker";
import {
  defaultEventDatesValue,
  EventDatesPicker,
  type EventDatesValue,
  eventDatesValueToPayload,
  isEventDatesValueValid,
} from "./EventDatesPicker";

export function CreateEventForm({
  onSubmit,
}: {
  onSubmit: (event: CalendarEvent) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dates, setDates] = useState<EventDatesValue>(() =>
    defaultEventDatesValue(),
  );

  return (
    <Container>
      <form
        onKeyDown={handleCalendarArrowKeys}
        onSubmit={(event) => {
          event.preventDefault();
          const eventName = event.currentTarget.elements.namedItem(
            "eventName",
          ) as HTMLInputElement;

          const name =
            eventName.value ||
            uniqueNamesGenerator({
              dictionaries: [adjectives, animals, colors],
              length: 3,
              separator: " ",
              style: "capital",
            });

          const payload = eventDatesValueToPayload(dates);
          const base = { id: nanoid(), creator: getUserId(), name };
          const calendarEvent: CalendarEvent =
            payload.kind === "rolling"
              ? { ...base, rolling: payload.rolling }
              : {
                  ...base,
                  endDate: payload.endDate,
                  startDate: payload.startDate,
                };

          setIsSubmitting(true);
          onSubmit(calendarEvent).finally(() => {
            Clarity.event("event-created");
            setIsSubmitting(false);
          });
        }}
      >
        <h1 className="mb-4 font-bold leading-[1.3333]">Create a Calendar</h1>
        <div className="mb-4">
          <label className="mb-2 block" htmlFor="eventName">
            <span>Name your event</span>
            <small className="block text-neutral-500">
              or leave blank to generate a random name
            </small>
          </label>
          <input
            id="eventName"
            type="text"
            autoComplete="off"
            className="w-full border pt-2 pr-2 pb-2 pl-[5px]"
          />
        </div>
        <EventDatesPicker
          name="calendar-mode"
          fixedRangeProps={{ disabled: { before: new Date() } }}
          onChange={setDates}
          value={dates}
        />
        <button
          type="submit"
          className="btn btn-default w-full"
          disabled={!isEventDatesValueValid(dates)}
          style={{ borderWidth: "0.5em" }}
          onClick={(event) => {
            event.currentTarget.textContent = "Creating...";
          }}
        >
          {isSubmitting ? "Creating..." : "Create Event"}
        </button>
      </form>
    </Container>
  );
}
