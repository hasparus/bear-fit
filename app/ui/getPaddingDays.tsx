export function getPaddingDays(firstDay: Date, weekStartsOn: number): number {
  const day = firstDay.getUTCDay();
  return (day - weekStartsOn + 7) % 7;
}
