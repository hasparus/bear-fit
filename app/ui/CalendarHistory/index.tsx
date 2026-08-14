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
import { CalendarDetails } from "../CalendarDetails";
import { CheckboxField } from "../CheckboxField";
import { ClockIcon } from "../ClockIcon";
import { cn } from "../cn";
import { Dialog, useDialogs } from "../Dialog";
import { useUserState } from "../UserStateContext";
import { decodeHistoryUpdates } from "../../decodeHistoryUpdates";

declare module "../Dialog" {
  export interface DialogIds {
    "event-history": true;
  }
}

const CalendarHistoryContext = createContext<boolean>(false);

export interface CalendarHistoryProps {
  calendarIsWide: boolean;
  calendarId: string | undefined;
  canRestore: boolean;
  onRestoreVersion?: (doc: Y.Doc) => void;
}

export function CalendarHistory({
  calendarIsWide,
  calendarId,
  canRestore,
  onRestoreVersion,
}: CalendarHistoryProps) {
  const isHistoricalAlready = useContext(CalendarHistoryContext);
  const dialogs = useDialogs();

  const closeButtonRef = useRef<HTMLButtonElement>(null);

  if (isHistoricalAlready) {
    return null;
  }

  return (
    <Dialog.Root id="event-history">
      <Dialog.Trigger
        aria-label="Open version history"
        className="p-1 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-sm active:bg-black active:text-white"
      >
        <ClockIcon className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 dark:bg-white/80 animate-overlay-show" />
        <Dialog.Popup
          className={cn(
            "grid fixed max-w-[var(--max-width-for-real)] left-[calc(50vw-var(--max-width-for-real)/2)] max-h-screen inset-0 sm:[place-items:center_end] pointer-events-none",
            !calendarIsWide &&
              "[@media(width>=1120px)]:[grid-template-columns:1fr_var(--container-width)_1fr] [@media(width>=1120px)]:[place-items:center_start]",
          )}
        >
          <section className="window max-sm:m-0 animate-content-show -col-end-1 pointer-events-auto">
            <CalendarHistoryContext.Provider value={true}>
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
              <CalendarHistoryContent
                calendarId={calendarId}
                canRestore={canRestore}
                closeButtonRef={closeButtonRef}
                onRestoreVersion={onRestoreVersion}
                open={dialogs.isOpen("event-history")}
              />
            </CalendarHistoryContext.Provider>
          </section>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface CalendarHistoryContentProps extends React.HTMLAttributes<HTMLElement> {
  calendarId: string | undefined;
  canRestore: boolean;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  onRestoreVersion?: (doc: Y.Doc) => void;
  open: boolean;
}

function CalendarHistoryContent({
  calendarId,
  canRestore,
  closeButtonRef,
  onRestoreVersion,
  open,
  ...rest
}: CalendarHistoryContentProps) {
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

  useEffect(() => {
    if (calendarId) {
      void getHistory(calendarId)
        .then((updates) => {
          const parsedUpdates = decodeHistoryUpdates(new Uint8Array(updates));
          setUpdates(parsedUpdates);
        })
        .catch((error) => {
          console.error("error fetching history", error);
          setError(error);
        });
    }
  }, [calendarId]);

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
    if (!historicalDoc || !onRestoreVersion || !canRestore) return;

    onRestoreVersion(historicalDoc);
    closeButtonRef.current?.click();
  };

  useEffect(() => {
    if (open) {
      const eventHistoryContent = document.getElementById(
        "event-history-content",
      );
      if (eventHistoryContent) {
        eventHistoryContent.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    }
  }, [open]);

  return (
    <div
      id="event-history-content"
      className="p-1 sm:p-2 flex flex-col gap-4 max-h-[calc(100dvh-32px)]"
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

            {}
            <input
              type="range"
              className="w-full"
              disabled={!updates}
              max={updates ? updates.length - 1 : 1}
              min={5}
              onChange={(e) => setIndex(parseInt(e.target.value))}
              value={index}
            />
          </div>

          {showData ? (
            <>
              {historicalDoc && (
                <pre className="text-xs">
                  {JSON.stringify(yDocToJson(historicalDoc), null, 2)}
                </pre>
              )}
            </>
          ) : updates ? (
            <YDocContext.Provider value={historicalDoc}>
              <CalendarDetails
                className="shadow-none shrink max-sm:m-0 max-sm:w-full overflow-y-scroll [scrollbar-gutter:stable] -mx-1 sm:-mx-2 border-x-0 rounded-none"
                disabled
              />
            </YDocContext.Provider>
          ) : (
            <CalendarDetails
              className="shadow-none shrink max-sm:m-0 max-sm:w-full overflow-y-scroll [scrollbar-gutter:stable] -mx-1 sm:-mx-2 border-x-0 rounded-none"
              disabled
            />
          )}

          {canRestore && (
            <button
              className="btn btn-default h-[45px] shrink-0"
              disabled={!updates || index === latestVersionRef.current}
              onClick={handleRestore}
            >
              Restore This Version
            </button>
          )}
        </>
      )}
    </div>
  );
}
