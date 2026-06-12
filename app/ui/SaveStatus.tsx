import type YPartyKitProvider from "y-partykit/provider";

import {
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

import { YProviderContext } from "../useYDoc";
import { cn } from "./cn";

type SyncStatus = "connecting" | "offline" | "saved" | "saving";

function getStatus(provider: YPartyKitProvider): SyncStatus {
  if (!navigator.onLine) return "offline";
  if (provider.wsconnected) return provider.synced ? "saved" : "saving";
  return "connecting";
}

function useSyncStatus(provider: YPartyKitProvider | null): SyncStatus | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!provider) return () => undefined;
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
    [provider],
  );

  return useSyncExternalStore(subscribe, () =>
    provider ? getStatus(provider) : null,
  );
}

const LABEL = {
  connecting: "connecting…",
  offline: "offline",
  saved: "saved",
  saving: "saving…",
} as const;

/**
 * True for ~2.5s after the last Cmd/Ctrl+S, to flash the autosave toast.
 * Swallows the browser's Save dialog. Capture phase so we run before the
 * external cursor-party script, which otherwise eats Cmd+S in Firefox.
 */
function useSaveHint() {
  const [hintAt, setHintAt] = useState(0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setHintAt(Date.now());
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);

  useEffect(() => {
    if (!hintAt) return;
    const timeout = setTimeout(() => setHintAt(0), 2500);
    return () => clearTimeout(timeout);
  }, [hintAt]);

  return hintAt !== 0;
}

export function SyncIndicator({ className }: { className?: string }) {
  const status = useSyncStatus(useContext(YProviderContext));
  const hint = useSaveHint();

  if (!status) return null;

  return (
    <span
      data-sync-status={status}
      className={cn(
        "group relative font-mono text-xs select-none",
        status === "offline" || status === "connecting"
          ? "text-danger"
          : "text-neutral-500",
        className,
      )}
    >
      <span
        data-show={hint}
        role="status"
        className={cn(
          "pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 origin-[16px_100%]",
          "whitespace-nowrap rounded-sm bg-black px-2 py-1 text-white",
          "invisible translate-y-[3px] scale-90 opacity-0 transition-all duration-300 ease-overshoot",
          "group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100",
          "data-[show=true]:visible data-[show=true]:translate-y-0 data-[show=true]:scale-100 data-[show=true]:opacity-100",
        )}
      >
        {status === "offline"
          ? "will sync when you're back online"
          : status === "connecting"
            ? "saved on this device, connecting to sync"
            : "bear fit saves automatically"}
      </span>
      {LABEL[status]}
    </span>
  );
}
