import Clarity from "@microsoft/clarity";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import { CalendarEvent, isoDate, IsoDate } from "../schemas";
import { DateRangePicker, handleCalendarArrowKeys } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";

export interface EditEventFormProps {
  event: CalendarEvent;
  onSubmit: (startDate: IsoDate, endDate: IsoDate) => Promise<void>;
}

export function EditEventForm({ event, onSubmit }: EditEventFormProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(event.startDate),
    to: new Date(event.endDate),
  });

  const initialStartDate = new Date(event.startDate);
  const today = new Date();
  const earliestDate = initialStartDate < today ? initialStartDate : today;

  return (
    <form
      onKeyDown={handleCalendarArrowKeys}
      onSubmit={(event) => {
        event.preventDefault();

        const { from, to } = requireValidDateRange(dateRange);

        onSubmit(isoDate(from), isoDate(to)).finally(() => {
          Clarity.event("event-dates-edited");
        });
      }}
    >
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
            initial: "*:!bg-neutral-100",
          }}
        />
      </div>
      <button
        type="submit"
        className="btn btn-default w-full"
        disabled={!isValidDateRange(dateRange)}
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
    date < to;
    date.setDate(date.getDate() + 1)
  ) {
    dates.push(new Date(date));
  }
  return dates;
}
