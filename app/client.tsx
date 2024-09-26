import type {} from "react/canary";

import { Suspense, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import useYProvider from "y-partykit/react";
import { Doc } from "yjs";

import type { CalendarEvent } from "./schemas";

import { initializeEventMap, yDocToJson } from "./shared-data";
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

  const yProvider = useYProvider({
    doc: yDoc.current,
    host: window.location.host,
    options: {
      connect: false,
      protocol: process.env.NODE_ENV === "development" ? "ws" : "wss",
    },
    room: eventId || "empty",
  });

  useEffect(() => {
    if (eventId && !yProvider.wsconnected && !yProvider.wsconnecting) {
      yProvider.connect();
      yProvider.on("synced", () => {
        console.group("synced");
        console.dir(yDoc.current && yDocToJson(yDoc.current), { depth: 9 });
        console.groupEnd();
      });
    }
  }, [eventId]);

  return (
    <YDocContext.Provider value={yDoc.current}>
      {eventId ? (
        <Suspense fallback={<Loading />}>
          <EventDetails />
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

            yProvider.roomname = calendarEvent.id;
          }}
        />
      )}
    </YDocContext.Provider>
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
