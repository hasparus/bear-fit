import type YPartyKitProvider from "y-partykit/provider";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { cn } from "./cn";

type SyncStatus = "offline" | "saved" | "saving";

function getStatus(provider: YPartyKitProvider): SyncStatus {
  if (!navigator.onLine) return "offline";
  if (provider.wsconnected) return provider.synced ? "saved" : "saving";
  if (provider.wsconnecting) return "saving";
  return "offline";
}

function useSyncStatus(provider: YPartyKitProvider | null): SyncStatus | null {
  return useSyncExternalStore(
    (onChange) => {
      if (!provider) return () => {};
      provider.on("status", onChange);
      provider.on("sync", onChange);
      window.addEventListener("online", onChange);
      window.addEventListener("offline", onChange);
      return () => {
        provider.off("status", onChange);
        provider.off("sync", onChange);
        window.removeEventListener("online", onChange);
        window.removeEventListener("offline", onChange);
      };
    },
    () => (provider ? getStatus(provider) : null),
  );
}

/** The room's Yjs provider, shared down to the one component that shows sync state. */
export const SyncProviderContext = createContext<YPartyKitProvider | null>(null);

const LABEL = {
  offline: "offline",
  saved: "saved",
  saving: "saving…",
} as const;

/** Dispatched globally on Cmd/Ctrl+S; the indicator pops its toast in response. */
const SAVE_HINT_EVENT = "bearfit:save-hint";

/** True for ~2.5s after each Cmd/Ctrl+S, to flash the autosave toast. */
function useSaveHint() {
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const onHint = () => setHint(true);
    window.addEventListener(SAVE_HINT_EVENT, onHint);
    return () => window.removeEventListener(SAVE_HINT_EVENT, onHint);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const timeout = setTimeout(() => setHint(false), 2500);
    return () => clearTimeout(timeout);
  }, [hint]);

  return hint;
}

export function SyncIndicator({ className }: { className?: string }) {
  const status = useSyncStatus(useContext(SyncProviderContext));
  const hint = useSaveHint();

  if (!status) return null;

  return (
    <span
      data-sync-status={status}
      className={cn(
        "group relative font-mono text-xs select-none",
        status === "offline" ? "text-danger" : "text-neutral-500",
        className,
      )}
    >
      <span
        aria-live="polite"
        data-show={hint}
        role="status"
        className={cn(
          "pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 origin-[16px_100%]",
          "whitespace-nowrap rounded-sm bg-black px-2 py-1 text-white",
          "translate-y-[3px] scale-90 opacity-0 transition duration-300 ease-overshoot",
          "group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100",
          "data-[show=true]:translate-y-0 data-[show=true]:scale-100 data-[show=true]:opacity-100",
        )}
      >
        {status === "offline"
          ? "will sync when you're back online"
          : "bear fit saves automatically"}
      </span>
      {LABEL[status]}
    </span>
  );
}

/**
 * Mounted once at the root (renders nothing). Cmd/Ctrl+S never opens the
 * browser's Save dialog — instead it flashes the autosave toast. Capture phase
 * so we run before the external cursor-party script, which otherwise swallows
 * Cmd+S in Firefox.
 */
export function SaveHotkey() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        window.dispatchEvent(new Event(SAVE_HINT_EVENT));
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  return null;
}
