import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";

import { getHistory } from "../api/getHistory";
import { ClockIcon } from "./ClockIcon";

export interface EventHistoryProps {
  eventId: string | undefined;
}

export function EventHistory({ eventId }: EventHistoryProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="p-1 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-md active:bg-black active:text-white">
        <ClockIcon className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/10 dark:bg-white/10 animate-overlay-show" />
        <Dialog.Content className="window fixed animate-content-show inset-8">
          <div className="title-bar">
            <Dialog.Title className="title">Version History</Dialog.Title>
            <Dialog.Description className="sr-only">
              Inspect the history of the event.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button aria-label="Close" className="close"></button>
            </Dialog.Close>
          </div>
          <EventHistoryContent eventId={eventId} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface EventHistoryContentProps extends React.HTMLAttributes<HTMLElement> {
  eventId: string | undefined;
}

function EventHistoryContent({ eventId, ...rest }: EventHistoryContentProps) {
  const [error, setError] = useState<Error | undefined>(undefined);
  const [updates, setUpdates] = useState<
    { clock: string; value: Uint8Array }[] | undefined
  >();

  // we fetch on render because we want to show the latest events
  // todo: consider opening an ancillary room to have a websocket connection for this
  useEffect(() => {
    if (eventId) {
      void getHistory(eventId)
        .then((updates) => {
          setUpdates(getUpdatesFromUint8Array(new Uint8Array(updates)));
        })
        .catch((error) => {
          console.error("error fetching history", error);
          setError(error);
        });
    }
  }, [eventId]);

  console.log({ updates });

  return (
    <div {...rest}>
      {error ? (
        <div>Error: {error.message}</div>
      ) : updates ? (
        <pre>{JSON.stringify(updates, null, 2)}</pre>
      ) : (
        <div>Loading...</div>
      )}
    </div>
  );
}

function getUpdatesFromUint8Array(body: Uint8Array) {
  const textDecoder = new TextDecoder();
  const parts: Uint8Array[] = [];
  let start = 0;

  for (let i = 0; i < body.length - 1; i++) {
    if (body[i] === 10 && body[i + 1] === 10) {
      parts.push(body.slice(start, i));
      start = i + 2;
      i++;
    }
  }

  if (start < body.length) {
    parts.push(body.slice(start));
  }

  const updates: { clock: string; value: Uint8Array }[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const clockOrSv = textDecoder.decode(parts[i]);
    const value = parts[i + 1];
    updates.push({ clock: clockOrSv, value });
  }

  return updates;
}
