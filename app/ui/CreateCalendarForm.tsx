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
import { type CalendarEvent, startOfTodayUtc } from "../schemas";
import {
  CalendarDatesPicker,
  type CalendarDatesValue,
  calendarDatesValueToPatch,
  defaultCalendarDatesValue,
  isCalendarDatesValueValid,
} from "./CalendarDatesPicker";
import { Container } from "./Container";
import { handleCalendarArrowKeys } from "./DateRangePicker";

export function CreateCalendarForm({
  onSubmit,
}: {
  onSubmit: (event: CalendarEvent) => void;
}) {
  const [dates, setDates] = useState<CalendarDatesValue>(() =>
    defaultCalendarDatesValue(),
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

          const patch = calendarDatesValueToPatch(dates);
          const base = { id: nanoid(), creator: getUserId(), name };
          const calendarEvent: CalendarEvent = { ...base, ...patch };

          onSubmit(calendarEvent);
          Clarity.event("event-created");
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
        <CalendarDatesPicker
          fixedRangeProps={{ disabled: { before: startOfTodayUtc() } }}
          name="calendar-mode"
          onChange={setDates}
          value={dates}
        />
        <button
          type="submit"
          className="btn btn-default w-full"
          disabled={!isCalendarDatesValueValid(dates)}
          style={{ borderWidth: "0.5em" }}
        >
          Create Calendar
        </button>
      </form>
    </Container>
  );
}
