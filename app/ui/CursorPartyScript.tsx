import { useEffect, useState } from "react";

import "./cursors.css";

export function CursorPartyScript() {
  const [isMounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <script async src="https://cursor-party.hasparus.partykit.dev/cursors.js" />
  );
}
