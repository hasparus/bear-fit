import Clarity from "@microsoft/clarity";
import { useState } from "react";
import { type DateRange } from "react-day-picker";

import { CalendarEvent, isoDate, IsoDate } from "../schemas";
import { DateRangePicker, handleCalendarArrowKeys } from "./DateRangePicker";
import { isValidDateRange, requireValidDateRange } from "./dateRangeValidation";
import "./react-day-picker.css";

export interface EditEventFormProps {
  event: CalendarEvent;
  onCancel: () => void;
  onSubmit: (startDate: IsoDate, endDate: IsoDate) => Promise<void>;
}

export function EditEventForm({
  event,
  onCancel,
  onSubmit,
}: EditEventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
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

        setIsSubmitting(true);
        onSubmit(isoDate(from), isoDate(to)).finally(() => {
          Clarity.event("event-dates-edited");
          setIsSubmitting(false);
        });
      }}
    >
      <h2 className="mb-4 text-xl font-bold">Edit Event Dates</h2>
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
            initial: [initialStartDate, new Date(event.endDate)],
          }}
          modifiersClassNames={{
            initial: "bg-neutral-100",
          }}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-outline flex-1"
          disabled={isSubmitting}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-default flex-1"
          disabled={!isValidDateRange(dateRange) || isSubmitting}
          style={{ borderWidth: "0.5em" }}
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
