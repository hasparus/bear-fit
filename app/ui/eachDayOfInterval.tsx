export function eachDayOfInterval(from: Date, to: Date) {
  const days = [];
  const end = new Date(to);
  for (let d = new Date(from); d <= end; d = new Date(d.getTime() + 86400000)) {
    days.push(new Date(d));
  }
  return days;
}
