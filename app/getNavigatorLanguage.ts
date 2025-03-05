export function getNavigatorLanguage() {
  console.error("getNavigatorLanguage");
  if (navigator.languages && navigator.languages.length) {
    console.error("navigator.languages", navigator.languages);
    return navigator.languages[0];
  } else {
    console.error("navigator.languages is empty");
    console.error("navigator", navigator);
    return ((navigator as { userLanguage?: string }).userLanguage ||
      navigator.language ||
      (navigator as { browserLanguage?: string }).browserLanguage ||
      "en") as string;
  }
}
