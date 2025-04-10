import { Dialog } from "radix-ui";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Y from "yjs";

import { getHistory } from "../../api/getHistory";
import { yDocToJson } from "../../shared-data";
import { YDocContext } from "../../useYDoc";
import { CheckboxField } from "../CheckboxField";
import { ClockIcon } from "../ClockIcon";
import { cn } from "../cn";
import { EventDetails } from "../EventDetails";
import { useUserState } from "../UserStateContext";
import { getUpdatesFromUint8Array } from "./getUpdatesFromUint8Array";

const EventHistoryContext = createContext<boolean>(false);

export interface EventHistoryProps {
  eventIsWide: boolean;
  eventId: string | undefined;
  onRestoreVersion: (doc: Y.Doc) => void;
}

export function EventHistory({
  eventIsWide,
  eventId,
  onRestoreVersion,
}: EventHistoryProps) {
  const isHistoricalAlready = useContext(EventHistoryContext);

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const onOpenChange = (open: boolean) => {
    const url = new URL(window.location.href);
    if (open) {
      url.searchParams.set("history", "1");
    } else {
      url.searchParams.delete("history");
    }
    setOpen(open);
    window.history.pushState({}, "", url.toString());
  };
  useEffect(() => {
    const url = new URL(window.location.href);
    setOpen(url.searchParams.get("history") === "1");
  }, []);

  if (isHistoricalAlready) {
    return null;
  }

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Trigger className="p-1 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-md active:bg-black active:text-white">
        <ClockIcon className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 dark:bg-white/80 animate-overlay-show" />
        <div
          className={cn(
            "grid fixed max-h-screen inset-0 sm:[place-items:center_end]",
            !eventIsWide &&
              "[@media(width>=1120px)]:[grid-template-columns:1fr_var(--container-width)_1fr] [@media(width>=1120px)]:[place-items:center_start]",
          )}
        >
          <Dialog.Content className="window max-sm:!m-0 animate-content-show -col-end-1">
            <EventHistoryContext.Provider value={true}>
              <div className="title-bar">
                <Dialog.Close
                  aria-label="Close"
                  className="close"
                  ref={closeButtonRef}
                />
                <Dialog.Title className="title">Version History</Dialog.Title>
                <Dialog.Description className="sr-only">
                  Inspect the history of the event.
                </Dialog.Description>
              </div>
              <EventHistoryContent
                closeButtonRef={closeButtonRef}
                eventId={eventId}
                onRestoreVersion={onRestoreVersion}
              />
            </EventHistoryContext.Provider>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface EventHistoryContentProps extends React.HTMLAttributes<HTMLElement> {
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  eventId: string | undefined;
  onRestoreVersion?: (doc: Y.Doc) => void;
}

function EventHistoryContent({
  closeButtonRef,
  eventId,
  onRestoreVersion,
  ...rest
}: EventHistoryContentProps) {
  const [error, setError] = useState<Error | undefined>(undefined);
  const [updates, setUpdates] = useState<
    { clock: string; value: Uint8Array }[] | undefined
  >();
  // eslint-disable-next-line prefer-const
  let [index, setIndex] = useState<number | undefined>(undefined);

  const [showData, setShowData] = useState(false);
  const { nerdMode } = useUserState();

  const latestVersionRef = useRef(0);

  const latestVersion = updates ? updates.length - 1 : 0;
  if (index === undefined) {
    index = latestVersion;
  }

  // We fetch history on render, because it's not exposed in a websocket
  // and we'd have to rebuild the document model a bit to make it so.
  // (Maybe even go for event sourcing.)
  // Fortunately, YPartyKit allows us to access the history of the document,
  // event if we don't design it that way.
  useEffect(() => {
    if (eventId) {
      void getHistory(eventId)
        .then((updates) => {
          const parsedUpdates = getUpdatesFromUint8Array(
            new Uint8Array(updates),
          );
          setUpdates(parsedUpdates);
        })
        .catch((error) => {
          console.error("error fetching history", error);
          setError(error);
        });
    }
  }, [eventId]);

  // TODO: We don't have to build a new Y.Doc when we scroll to the right.
  const historicalDoc = useMemo(() => {
    if (!updates || updates.length === 0) return null;

    try {
      const doc = new Y.Doc();

      for (let i = 0; i <= index; i++) {
        if (i < updates.length && updates[i].value) {
          Y.applyUpdate(doc, updates[i].value);
        }
      }

      return doc;
    } catch (err) {
      console.error("Error rebuilding document:", err);
      setError(
        err instanceof Error ? err : new Error("Failed to rebuild document"),
      );
      return null;
    }
  }, [index, updates]);

  const handleRestore = () => {
    if (!historicalDoc || !onRestoreVersion) return;

    onRestoreVersion(historicalDoc);
    closeButtonRef.current?.click();
  };

  return (
    <div
      className="p-1 sm:p-4 flex flex-col gap-4 max-h-[calc(100dvh-32px)]"
      {...rest}
    >
      {error ? (
        <div className="text-red-500">Error: {error.message}</div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 h-5">
                {updates && updates[index].clock}
              </span>
              {nerdMode && (
                <CheckboxField
                  id="show-data"
                  checked={showData}
                  onChange={(e) => {
                    setShowData(e.target.checked);
                  }}
                >
                  Show JSON
                </CheckboxField>
              )}
            </div>

            {/* todo: style the input */}
            <input
              type="range"
              className="w-full"
              disabled={!updates}
              max={updates ? updates.length - 1 : 1}
              min={0}
              onChange={(e) => setIndex(parseInt(e.target.value))}
              value={index}
            />
          </div>

          {showData ? (
            <>
              {historicalDoc && (
                <pre>{JSON.stringify(yDocToJson(historicalDoc), null, 2)}</pre>
              )}
            </>
          ) : updates ? (
            <YDocContext.Provider value={historicalDoc}>
              <EventDetails
                className="!shadow-none shrink max-sm:!m-0 max-sm:!w-full overflow-y-auto"
                disabled
              />
            </YDocContext.Provider>
          ) : (
            <EventDetails
              className="!shadow-none shrink max-sm:!m-0 max-sm:!w-full overflow-y-auto"
              disabled
            />
          )}

          <button
            className="btn btn-default h-[45px] shrink-0"
            disabled={!updates || index === latestVersionRef.current}
            onClick={handleRestore}
          >
            Restore This Version
          </button>
        </>
      )}
    </div>
  );
}
