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
 * A window capture listener runs before cursor-party's document listener.
 */
function useCursorChatKey(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled]);
}

let script: HTMLScriptElement | undefined;

/**
 * One cursor room per calendar, so a fresh calendar never shows strangers.
 * The script loads with the first calendar and stays: cursor-party follows
 * `data-room`, and "" leaves the room, so navigating never re-runs it.
 */
export function CursorPartyScript({ room }: { room: string | null }) {
  useCursorChatKey(Boolean(room));

  useEffect(() => {
    if (!room && !script) return; // no cursors until a calendar opens
    // by hand: React 19 hoists `<script async>` and won't update it
    script ??= document.createElement("script");
    script.dataset.room = room ?? "";
    if (!script.isConnected) {
      script.async = true;
      script.src = "https://cursor-party.hasparus.workers.dev/cursors.js";
      document.body.appendChild(script);
    }
  }, [room]);

  return null;
}
