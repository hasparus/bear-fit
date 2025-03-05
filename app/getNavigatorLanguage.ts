export function getNavigatorLanguage() {
  let res: string | undefined;

  if (navigator.languages && navigator.languages.length) {
    res = navigator.languages[0];
  } else {
    res = ((navigator as { userLanguage?: string }).userLanguage ||
      navigator.language ||
      (navigator as { browserLanguage?: string }).browserLanguage ||
      "en") as string;
  }

  if (res.endsWith("@posix")) {
    res = res.slice(0, -6);
  }

  return res;
}
