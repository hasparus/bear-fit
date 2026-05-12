import { type RollingWindow } from "../schemas";

export interface RollingPreset {
  label: string;
  value: RollingWindow;
}

export const ROLLING_PRESETS: readonly RollingPreset[] = [
  { label: "Next week", value: { end: { days: 7 }, start: { days: 0 } } },
  { label: "Next 2 weeks", value: { end: { days: 14 }, start: { days: 0 } } },
  { label: "Next month", value: { end: { months: 1 }, start: { days: 0 } } },
  { label: "Next 2 months", value: { end: { months: 2 }, start: { days: 0 } } },
  { label: "Next 3 months", value: { end: { months: 3 }, start: { days: 0 } } },
  { label: "Next 6 months", value: { end: { months: 6 }, start: { days: 0 } } },
];

export const DEFAULT_ROLLING_PRESET = ROLLING_PRESETS[3];

export const rollingPresetIndex = (window: RollingWindow): number => {
  const i = ROLLING_PRESETS.findIndex(
    (p) =>
      p.value.start.days === window.start.days &&
      p.value.start.months === window.start.months &&
      p.value.end.days === window.end.days &&
      p.value.end.months === window.end.months,
  );
  return i === -1 ? 3 : i;
};

export function formatRollingWindow(window: RollingWindow): string {
  return ROLLING_PRESETS[rollingPresetIndex(window)].label;
}

export function RollingWindowControls({
  onChange,
  value,
}: {
  onChange: (window: RollingWindow) => void;
  value: RollingWindow;
}) {
  const currentIndex = rollingPresetIndex(value);

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
        value={currentIndex}
        onChange={(e) => {
          const next = ROLLING_PRESETS[Number(e.target.value)];
          if (next) onChange(next.value);
        }}
      >
        {ROLLING_PRESETS.map((preset, i) => (
          <option key={preset.label} value={i}>
            {preset.label}
          </option>
        ))}
      </select>
    </div>
  );
}
