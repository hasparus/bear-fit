import { nanoid } from "nanoid";
import { useState } from "react";
import { type DateRange } from "react-day-picker";
import { DayPicker } from "react-day-picker/utc";
import {
  adjectives,
  animals,
  colors,
  uniqueNamesGenerator,
} from "unique-names-generator";

import { CalendarEvent, IsoDate } from "../schemas";
import { Container } from "./Container";
import "./react-day-picker.css";

export function CreateEventForm({
  onSubmit,
}: {
  onSubmit: (event: CalendarEvent) => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  return (
    <Container>
      <form
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            const parent =
              e.target instanceof HTMLElement && e.target.parentElement;
            const inNavigation = parent && parent.tagName === "NAV";

            if (inNavigation) {
              let button: HTMLButtonElement | null = null;

              if (e.key === "ArrowLeft")
                button = parent.querySelector(
                  ".rdp-button_previous"
                ) as HTMLButtonElement;

              if (e.key === "ArrowRight")
                button = parent.querySelector(
                  ".rdp-button_next"
                ) as HTMLButtonElement;

              if (button) {
                button.focus();
                button.click();
              }
            }
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const eventName = event.currentTarget.elements.namedItem(
            "eventName"
          ) as HTMLInputElement;

          const { from, to } = dateRange;
          if (!from || !to) {
            throw new Error("full date range is required");
          }

          setIsSubmitting(true);
          onSubmit({
            endDate: IsoDate(to),
            id: nanoid(),
            name:
              eventName.value ||
              uniqueNamesGenerator({
                dictionaries: [adjectives, animals, colors],
                length: 3,
                separator: " ",
                style: "capital",
              }),
            startDate: IsoDate(from),
          }).finally(() => {
            setIsSubmitting(false);
          });
        }}
      >
        <h1 className="mb-4 text-2xl font-bold">Create a Calendar</h1>
        <div className="mb-4">
          <label className="mb-2 block" htmlFor="eventName">
            <span>Name your event</span>
            <small className="block text-neutral-500">
              or leave blank to generate a random name
            </small>
          </label>
          <input
            autoComplete="off"
            className="w-full border p-2"
            id="eventName"
            type="text"
          />
        </div>
        <div className="mb-4">
          <label className="mb-2 block">
            <span>Choose a date range</span>
            <small className="block text-neutral-500">
              what times should the guests consider?
            </small>
          </label>
          <DayPicker
            disabled={{ before: new Date() }}
            mode="range"
            onSelect={(range) =>
              setDateRange(range || { from: undefined, to: undefined })
            }
            selected={dateRange}
            weekStartsOn={tryGetFirstDayOfTheWeek()}
          />
        </div>
        <button
          // eslint-disable-next-line tailwindcss/no-custom-classname
          className="btn btn-default w-full hover:bg-neutral-100 "
          disabled={
            !dateRange.from || !dateRange.to || dateRange.from >= dateRange.to
          }
          onClick={(event) => {
            event.currentTarget.textContent = "Creating...";
          }}
          style={{ borderWidth: "0.5em" }}
          type="submit"
        >
          {isSubmitting ? "Creating..." : "Create Event"}
        </button>
      </form>
    </Container>
  );
}

function tryGetFirstDayOfTheWeek() {
  const language = getNavigatorLanguage();
  const locale = new Intl.Locale(language);

  type WeekInfo = { firstDay: number } | undefined;

  const weekInfo: WeekInfo =
    "getWeekInfo" in locale
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((locale as any).getWeekInfo() as WeekInfo)
      : (locale as unknown as { weekInfo: WeekInfo }).weekInfo;

  return weekInfo?.firstDay
    ? // react-day-picker is American and treats Sunday as 0 not 7
      ((weekInfo.firstDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
    : undefined;
}

function getNavigatorLanguage() {
  if (navigator.languages && navigator.languages.length) {
    return navigator.languages[0];
  } else {
    return ((navigator as { userLanguage?: string }).userLanguage ||
      navigator.language ||
      (navigator as { browserLanguage?: string }).browserLanguage ||
      "en") as string;
  }
}
