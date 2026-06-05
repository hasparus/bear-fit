import { type RollingOffset, type RollingWindow } from "../schemas";

const offset = (days: number, months: number): RollingOffset => ({
  days,
  months,
});

const TODAY = offset(0, 0);

export interface RollingPreset {
  label: string;
  value: RollingWindow;
}

export const ROLLING_PRESETS: readonly RollingPreset[] = [
  { label: "Next week", value: { end: offset(7, 0), start: TODAY } },
  { label: "Next 2 weeks", value: { end: offset(14, 0), start: TODAY } },
  { label: "Next month", value: { end: offset(0, 1), start: TODAY } },
  { label: "Next 2 months", value: { end: offset(0, 2), start: TODAY } },
  { label: "Next 3 months", value: { end: offset(0, 3), start: TODAY } },
  { label: "Next 6 months", value: { end: offset(0, 6), start: TODAY } },
];

export const DEFAULT_ROLLING_PRESET = ROLLING_PRESETS[3];

const offsetsEqual = (a: RollingOffset, b: RollingOffset): boolean =>
  a.days === b.days && a.months === b.months;

const matchingPresetLabel = (window: RollingWindow): string | undefined =>
  ROLLING_PRESETS.find(
    (p) =>
      offsetsEqual(p.value.start, window.start) &&
      offsetsEqual(p.value.end, window.end),
  )?.label;

const formatOffset = (o: RollingOffset): string => {
  const parts: string[] = [];
  if (o.months) parts.push(`${o.months} month${o.months === 1 ? "" : "s"}`);
  if (o.days) parts.push(`${o.days} day${o.days === 1 ? "" : "s"}`);
  return parts.join(" ") || "today";
};

export function formatRollingWindow(window: RollingWindow): string {
  const preset = matchingPresetLabel(window);
  if (preset) return preset;
  const startIsToday = offsetsEqual(window.start, TODAY);
  return startIsToday
    ? `today through +${formatOffset(window.end)}`
    : `+${formatOffset(window.start)} through +${formatOffset(window.end)}`;
}

export function RollingWindowControls({
  onChange,
  value,
}: {
  onChange: (window: RollingWindow) => void;
  value: RollingWindow;
}) {
  const currentLabel = matchingPresetLabel(value) ?? "";

  return (
    <div className="mb-4">
      <label className="mb-2 block" htmlFor="rolling-window-preset">
        <span>Rolling window</span>
        <small className="block text-neutral-500">
          dates always start at today and extend by this amount
        </small>
      </label>
      <select
        id="rolling-window-preset"
        className="w-full border pt-2 pr-2 pb-2 pl-[5px] rounded-sm"
        value={currentLabel}
        onChange={(e) => {
          const next = ROLLING_PRESETS.find((p) => p.label === e.target.value);
          if (next) onChange(next.value);
        }}
      >
        {!currentLabel && (
          <option disabled value="">
            Custom ({formatRollingWindow(value)})
          </option>
        )}
        {ROLLING_PRESETS.map((preset) => (
          <option key={preset.label} value={preset.label}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}
