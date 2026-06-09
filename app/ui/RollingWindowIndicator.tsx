import { type RollingWindow } from "../schemas";
import { formatRollingWindow } from "./formatRollingWindow";

export function RollingWindowIndicator({ window }: { window: RollingWindow }) {
  return (
    <small aria-label="Rolling window" className="block text-neutral-500">
      Rolling: {formatRollingWindow(window)}
    </small>
  );
}
