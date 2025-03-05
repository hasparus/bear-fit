import { getNavigatorLanguage } from "./getNavigatorLanguage";

export function tryGetFirstDayOfTheWeek() {
  console.error("tryGetFirstDayOfTheWeek");
  const language = getNavigatorLanguage();
  console.error(language);
  const locale = new Intl.Locale(language);
  console.error(locale);

  type WeekInfo = { firstDay: number } | undefined;

  const weekInfo: WeekInfo =
    "getWeekInfo" in locale
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((locale as any).getWeekInfo() as WeekInfo)
      : (locale as unknown as { weekInfo: WeekInfo }).weekInfo;

  return weekInfo?.firstDay
    ? // react-day-picker is American and treats Sunday as 0 not 7
      ((weekInfo.firstDay % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6)
    : undefined;
}
