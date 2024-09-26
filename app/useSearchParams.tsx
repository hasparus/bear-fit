import { useState, useEffect } from "react";

// async function createEvent(event: CalendarEvent) {
//   const url = new URL(window.location.href);
//   url.pathname = `parties/main/${event.id}`;
//   const res = await fetch(url, { method: "POST", body: JSON.stringify(event) });
//   return res.json();
// }
export function useSearchParams() {
  const [searchParams, setSearchParams] = useState(
    new URLSearchParams(window.location.search)
  );

  useEffect(() => {
    const listener = () => {
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  const setParam = (key: string, value: string) => {
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set(key, value);
    window.history.pushState({}, "", `?${newSearchParams.toString()}`);
    setSearchParams(newSearchParams);
  };

  return {
    get(key: string) {
      return searchParams.get(key);
    },
    set(key: string, value: string) {
      setParam(key, value);
    },
  };
}
