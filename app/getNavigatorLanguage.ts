export function getNavigatorLanguage() {
  if (navigator.languages && navigator.languages.length) {
    return navigator.languages[0];
  } else {
    return ((navigator as { userLanguage?: string }).userLanguage ||
      navigator.language ||
      (navigator as { browserLanguage?: string }).browserLanguage ||
      "en") as string;
  }
}
