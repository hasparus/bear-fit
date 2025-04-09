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
import { YDocContext } from "../../useYDoc";
import { ClockIcon } from "../ClockIcon";
import { cn } from "../cn";
import { EventDetails } from "../EventDetails";
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

  if (isHistoricalAlready) {
    return null;
  }

  return (
    <Dialog.Root>
      <Dialog.Trigger className="p-1 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-md active:bg-black active:text-white">
        <ClockIcon className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/20 dark:bg-white/80 animate-overlay-show" />
        <div
          className={cn(
            "grid fixed max-h-screen inset-0 [place-items:center_end]",
            !eventIsWide &&
              "[@media(width>=1120px)]:[grid-template-columns:1fr_var(--container-width)_1fr] [@media(width>=1120px)]:[place-items:center_start]",
          )}
        >
          <Dialog.Content className="window animate-content-show -col-end-1">
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
    <div className="p-4 flex flex-col gap-4" {...rest}>
      {error ? (
        <div className="text-red-500">Error: {error.message}</div>
      ) : !updates ? (
        <div>Loading history...</div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">
                {updates[index].clock}
              </span>
            </div>

            {/* todo: style the input */}
            <input
              type="range"
              className="w-full"
              max={updates.length - 1}
              min={0}
              onChange={(e) => setIndex(parseInt(e.target.value))}
              value={index}
            />
          </div>

          <YDocContext.Provider value={historicalDoc}>
            <EventDetails className="!shadow-none [&_form]:pointer-events-none" />
          </YDocContext.Provider>

          {index !== latestVersionRef.current && onRestoreVersion && (
            <button className="btn btn-default" onClick={handleRestore}>
              Restore This Version
            </button>
          )}
        </>
      )}
    </div>
  );
}
