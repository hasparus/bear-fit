import { useEffect } from "react";

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
 *
 * Beating cursor-party relies on registration order: capture listeners fire
 * in the order they were added, and ours wins only because the external
 * script loads async, after mount.
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

/**
 * One cursor room per calendar, so a fresh calendar never shows strangers.
 * Injected by hand: React 19 hoists `<script async>` and never removes it.
 * Removing the script tears cursor-party down; it reads its room from `data-room`.
 */
export function CursorPartyScript({ room }: { room: string }) {
  useCursorChatKey();

  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://cursor-party.hasparus.workers.dev/cursors.js";
    script.dataset.room = room;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [room]);

  return null;
}
