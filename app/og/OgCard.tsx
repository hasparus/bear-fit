import { cn } from "../ui/cn";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export interface OgCardProps {
  dark?: boolean;
  dates: string;
  /** Days of a range that fits in one month; shown as the app's grid. */
  days?: Date[];
  layout?: "bare" | "card";
  name: string;
}

/**
 * The link-preview image, drawn with the app's styles at 3× the app's sizes.
 * Light by design; dark mode is the app's own `invert(0.9)`.
 */
export function OgCard({
  dark = true,
  dates,
  days,
  layout = "card",
  name,
}: OgCardProps) {
  return (
    <div
      className="og-dots relative flex shrink-0 overflow-hidden font-sans text-black"
      data-og
      style={{
        width: OG_WIDTH,
        filter: dark ? "invert(0.9)" : undefined,
        height: OG_HEIGHT,
      }}
    >
      {layout === "card" ? (
        <div className="flex w-full flex-col">
          <Header />
          <div className="standard-dialog m-auto flex w-[1080px] gap-[42px] rounded-[6px] border-[6px]! bg-white p-[30px]! shadow-[6px_6px_0_0_#000]!">
            <Details dates={dates} days={days} name={name} />
            {days && (
              <>
                <div className="w-[3px] shrink-0 bg-neutral-200" />
                <MonthGrid days={days} />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex w-full flex-col justify-between p-[72px]">
          <div className="text-[42px] font-bold">bear fit</div>
          <div className="flex flex-col gap-[24px] bg-white">
            <div className="line-clamp-3 text-[96px] leading-[1.15]">
              {name}
            </div>
            <div className="text-[48px]">{dates}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Details({
  dates,
  days,
  name,
}: Pick<OgCardProps, "dates" | "days" | "name">) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <p className="text-[33px]">Calendar</p>
      <h1
        className={cn(
          "mb-[36px] leading-[1.15]",
          days ? "line-clamp-3 text-[66px]!" : "line-clamp-2 text-[84px]!",
        )}
      >
        {name}
      </h1>
      <p className="text-[33px]">Dates</p>
      <p
        className={cn("leading-[1.3333]", days ? "text-[45px]" : "text-[54px]")}
      >
        {dates}
      </p>
    </div>
  );
}

function MonthGrid({ days }: { days: Date[] }) {
  const padding = (days[0].getUTCDay() + 6) % 7;
  return (
    <div className="flex shrink-0 flex-col">
      <div className="mb-[6px] text-[39px]">
        {days[0].toLocaleDateString("en-US", {
          month: "long",
          timeZone: "UTC",
        })}
      </div>
      <div className="grid grid-cols-7 gap-[6px]">
        {WEEKDAYS.map((day) => (
          <div
            className="flex h-[39px] w-[52px] items-center justify-center text-[24px] opacity-75"
            key={day}
          >
            {day}
          </div>
        ))}
        {Array.from({ length: padding }, (_, i) => (
          <div key={`padding-${i}`} />
        ))}
        {days.map((day) => (
          <div
            className="flex size-[52px] items-center justify-center rounded-[12px] bg-neutral-100 text-[27px]"
            key={day.toISOString()}
          >
            {day.getUTCDate()}
          </div>
        ))}
      </div>
    </div>
  );
}

/** The app's header bar, at 2×. */
function Header() {
  return (
    <div className="flex shrink-0 items-center justify-between border-b-2 border-neutral-300 bg-white px-[24px] py-[8px]">
      <span className="text-[28px] font-bold">bear fit</span>
      <span className="text-[24px] text-neutral-500">
        find a time that works for everybody
      </span>
    </div>
  );
}
