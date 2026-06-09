import { resolveRollingWindow, type RollingWindow } from "../schemas";

const utcDay = (date: Date): number =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

export function formatRollingWindow(
  window: RollingWindow,
  today: Date = new Date(),
): string {
  const { endDate, startDate } = resolveRollingWindow(window, today);
  const days = (utcDay(new Date(endDate)) - utcDay(new Date(startDate))) / 86_400_000;
  return `${days} day${days === 1 ? "" : "s"}`;
}
