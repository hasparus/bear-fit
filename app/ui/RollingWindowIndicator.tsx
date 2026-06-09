export function RollingWindowIndicator({ days }: { days: number }) {
  return (
    <small aria-label="Rolling window" className="block text-neutral-500">
      Rolling: {days} day{days === 1 ? "" : "s"}
    </small>
  );
}
