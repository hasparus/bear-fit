import { useEffect, useState } from "react";

import { getHistory } from "../api/getHistory";

export interface EventHistoryProps extends React.HTMLAttributes<HTMLElement> {
  eventId: string | undefined;
}

export function EventHistory({ eventId, ...rest }: EventHistoryProps) {
  const [updates, setUpdates] = useState<
    { clock: string; value: Uint8Array }[] | undefined
  >();

  // we fetch on render because we want to show the latest events
  // todo: consider opening an ancillary room to have a websocket connection for this
  useEffect(() => {
    void getHistory(eventId).then((updates) => {
      setUpdates(getUpdatesFromUint8Array(updates));
    });
  }, []);

  return (
    <div {...rest}>
      {updates ? (
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

  const updates: { clock: string; value: Uint8Array }[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const clockOrSv = textDecoder.decode(parts[i]);
    const value = parts[i + 1];
    updates.push({ clock: clockOrSv, value });
  }

  return updates;
}
