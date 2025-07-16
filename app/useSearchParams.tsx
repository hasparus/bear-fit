import { useEffect, useState } from "react";

export function useSearchParams() {
  const [searchParams, setSearchParams] = useState<URLSearchParams>(
    new URLSearchParams(window.location.search),
  );

  useEffect(() => {
    const listener = () => {
      setSearchParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  return {
    append(key: string, value: string) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.append(key, value);
      window.history.pushState({}, "", `?${newSearchParams.toString()}`);
      setSearchParams(newSearchParams);
    },
    delete(key: string, value: string) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete(key, value);
      window.history.pushState({}, "", `?${newSearchParams.toString()}`);
      setSearchParams(newSearchParams);
    },
    get(key: string) {
      return searchParams.get(key);
    },
    getAll(key: string) {
      return searchParams.getAll(key);
    },
    set(key: string, value: string) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set(key, value);
      window.history.pushState({}, "", `?${newSearchParams.toString()}`);
      setSearchParams(newSearchParams);
    },
  };
}
