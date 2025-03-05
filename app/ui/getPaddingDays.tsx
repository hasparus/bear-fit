export function getPaddingDays(firstDay: Date, weekStartsOn: number): number {
  const day = firstDay.getDay();
  return (day - weekStartsOn + 7) % 7;
}
