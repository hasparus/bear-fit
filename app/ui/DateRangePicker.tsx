import { type DateRange, type DayPickerProps } from "react-day-picker";
import { DayPicker } from "react-day-picker";

import { tryGetFirstDayOfTheWeek } from "../tryGetFirstDayOfTheWeek";
import "./react-day-picker.css";

export interface DateRangePickerProps
  extends Pick<
    DayPickerProps,
    "disabled" | "modifiers" | "modifiersClassNames" | "modifiersStyles"
  > {
  onSelect: (range: DateRange) => void;
  selected: DateRange;
}

export function DateRangePicker({
  onSelect,
  selected,
  ...rest
}: DateRangePickerProps) {
  return (
    <DayPicker
      showOutsideDays
      fixedWeeks // avoid layout shift when changing months
      mode="range"
      selected={selected}
      timeZone="UTC"
      weekStartsOn={tryGetFirstDayOfTheWeek()}
      onSelect={(range) =>
        onSelect(range || { from: undefined, to: undefined })
      }
      {...rest}
    />
  );
}

export function handleCalendarArrowKeys(
  event: React.KeyboardEvent<HTMLFormElement>,
) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    const parent =
      event.target instanceof HTMLElement && event.target.parentElement;
    const inNavigation = parent && parent.tagName === "NAV";

    if (inNavigation) {
      let button: HTMLButtonElement | null = null;

      if (event.key === "ArrowLeft")
        button = parent.querySelector(
          ".rdp-button_previous",
        ) as HTMLButtonElement;

      if (event.key === "ArrowRight")
        button = parent.querySelector(".rdp-button_next") as HTMLButtonElement;

      if (button) {
        button.focus();
        button.click();
      }
    }
  }
}
