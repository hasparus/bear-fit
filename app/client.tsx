import type {} from "react/canary";

import { Suspense, useRef } from "react";
import { createRoot } from "react-dom/client";
import useYProvider from "y-partykit/react";
import { Doc } from "yjs";

import type { CalendarEvent } from "./schemas";

import { initializeEventMap } from "./shared-data";
import "./styles.css";
import { CreateEventForm } from "./ui/CreateEventForm";
import { EventDetails } from "./ui/EventDetails";
import { Loading } from "./ui/Loading";
import { useSearchParams } from "./useSearchParams";
import { YDocContext } from "./useYDoc";

function App() {
  const params = useSearchParams();
  const eventId = params.get("id");

  const yDoc = useRef<Doc>();
  if (!yDoc.current) {
    yDoc.current = new Doc();
  }

  return eventId ? (
    <Suspense fallback={<Loading />}>
      <YProvider room={eventId} yDoc={yDoc.current}>
        <EventDetails />
      </YProvider>
    </Suspense>
  ) : (
    <CreateEventForm
      onSubmit={(calendarEvent) => {
        initializeEventMap(yDoc.current!, calendarEvent);

        postEvent(calendarEvent)
          .catch((error) => {
            console.error("creating event failed", error);
          })
          .then(() => {
            params.set("id", calendarEvent.id);
          });
      }}
    />
  );
}

createRoot(document.getElementById("app")!).render(<App />);

async function postEvent(calendarEvent: CalendarEvent): Promise<unknown> {
  const res = await fetch(
    `${window.location.protocol}//${window.location.host}/parties/main/${calendarEvent.id}`,
    {
      body: JSON.stringify(calendarEvent),
      method: "POST",
    }
  );

  const json = await res.json();

  return json;
}

function YProvider({
  children,
  room,
  yDoc,
}: {
  children: React.ReactNode;
  room: string;
  yDoc: Doc;
}) {
  // This needs to be a separate component, because the `.room` option is immutable in
  // `useYProvider`, and we don't know the room until we create the event.
  const _yProvider = useYProvider({
    doc: yDoc,
    host: window.location.host,
    options: {
      connect: true,
      protocol: process.env.NODE_ENV === "development" ? "ws" : "wss",
    },
    room,
  });

  return <YDocContext.Provider value={yDoc}>{children}</YDocContext.Provider>;
}
