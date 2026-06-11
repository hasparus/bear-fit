import { useEffect, useState } from "react";

import "./cursors.css";

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

/**
 * cursor-party opens its chat on "/". Capture the key before its own listener
 * to tame two browser quirks: keep "/" typable inside form fields (don't let
 * the chat eat it), and suppress Firefox's Quick Find so the chat wins.
 */
function useCursorChatKey() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      if (isTyping(event.target)) {
        event.stopImmediatePropagation();
      } else {
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}

export function CursorPartyScript() {
  const [isMounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useCursorChatKey();

  if (!isMounted) return null;

  return (
    <script async src="https://cursor-party.hasparus.partykit.dev/cursors.js" />
  );
}
