export function getWeekDayNames(weekStartsOn: number): string[] {
  const days = Array.from(Array(7)).map((_, i) => {
    const date = new Date(2024, 0, 7 + i);
    return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
  });
  return [...days.slice(weekStartsOn), ...days.slice(0, weekStartsOn)];
}
