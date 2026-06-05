import Clarity from "@microsoft/clarity";
import { nanoid } from "nanoid";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { getUserId } from "../getUserId";
import { CalendarEvent, isoDate, type RollingWindow } from "../schemas";
import { CheckboxField } from "./CheckboxField";
import { Container } from "./Container";
import { DateRangePicker, handleCalendarArrowKeys } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";
import {
  DEFAULT_ROLLING_PRESET,
  RollingWindowControls,
} from "./RollingWindowControls";

export function CreateEventForm({
  onSubmit,
}: {
  onSubmit: (event: CalendarEvent) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rolling, setRolling] = useState<RollingWindow>(
    DEFAULT_ROLLING_PRESET.value,
  );
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  const canSubmit = isRolling || isValidDateRange(dateRange);

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

          const base = {
            id: nanoid(),
            creator: getUserId(),
            name,
          };
          let calendarEvent: CalendarEvent;
          if (isRolling) {
            calendarEvent = { ...base, rolling };
          } else {
            const { from, to } = requireValidDateRange(dateRange);
            calendarEvent = {
              ...base,
              endDate: isoDate(to),
              startDate: isoDate(from),
            };
          }

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
        <div className="mb-4">
          <CheckboxField
            id="is-rolling"
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
              <span>Choose a date range</span>
              <small className="block text-neutral-500">
                what times should the guests consider?
              </small>
            </label>
            <DateRangePicker
              disabled={{ before: new Date() }}
              onSelect={setDateRange}
              selected={dateRange}
            />
          </div>
        )}
        <button
          type="submit"
          className="btn btn-default w-full"
          disabled={!canSubmit}
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
