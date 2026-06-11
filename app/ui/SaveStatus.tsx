import type YPartyKitProvider from "y-partykit/provider";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { cn } from "./cn";

type SyncStatus = "offline" | "saved" | "saving";

function getStatus(provider: YPartyKitProvider): SyncStatus {
  const online =
    provider.wsconnected &&
    (typeof navigator === "undefined" || navigator.onLine);

  if (online) return provider.synced ? "saved" : "saving";
  if (provider.wsconnecting && navigator.onLine) return "saving";
  return "offline";
}

function useSyncStatus(provider: YPartyKitProvider): SyncStatus {
  return useSyncExternalStore(
    (onChange) => {
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
    () => getStatus(provider),
  );
}

const SyncStatusContext = createContext<SyncStatus | null>(null);

/** Publishes the provider's live sync status to the event subtree. */
export function SyncStatusProvider({
  provider,
  children,
}: {
  provider: YPartyKitProvider;
  children: ReactNode;
}) {
  const status = useSyncStatus(provider);

  return (
    <SyncStatusContext.Provider value={status}>
      {children}
    </SyncStatusContext.Provider>
  );
}

const LABEL = {
  offline: "offline",
  saved: "saved",
  saving: "saving…",
} as const;

/** Dispatched globally on Cmd/Ctrl+S; the indicator pops its toast in response. */
const SAVE_HINT_EVENT = "bearfit:save-hint";

export function SyncIndicator({ className }: { className?: string }) {
  const status = useContext(SyncStatusContext);
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
 * App-wide keyboard concerns, mounted once at the root (renders nothing):
 * - Cmd/Ctrl+S never opens the browser's Save dialog; it hints that we autosave.
 * - "/" is handed to cursor-party's chat instead of Firefox's Quick Find.
 */
export function GlobalKeyHandler() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        window.dispatchEvent(new Event(SAVE_HINT_EVENT));
        return;
      }

      if (event.key === "/") {
        if (isTyping(event.target)) {
          event.stopImmediatePropagation();
        } else {
          event.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  return null;
}
