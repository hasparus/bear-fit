import type {} from "react/canary";
import useYProvider from "y-partykit/react";
import { Suspense, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import { CreateEventForm } from "./ui/CreateEventForm";
import { EventDetails } from "./ui/EventDetails";

import "./styles.css";
import { YDocContext } from "./useYDoc";
import { Doc } from "yjs";
import { initializeEventMap, yDocToJson } from "./shared-data";
import { useSearchParams } from "./useSearchParams";
import type { CalendarEvent } from "./schemas";
import { useY } from "react-yjs";
import { Loading } from "./ui/Loading";

function App() {
  const params = useSearchParams();
  const eventId = params.get("id");

  const yDoc = useRef<Doc>();
  if (!yDoc.current) {
    yDoc.current = new Doc();
  }

  const yProvider = useYProvider({
    room: eventId || "empty",
    doc: yDoc.current,
    host: window.location.host,
    options: {
      connect: false,
      protocol: process.env.NODE_ENV === "development" ? "ws" : "wss",
    },
  });

  useEffect(() => {
    console.log(
      "should connect",
      eventId && !yProvider.wsconnected && !yProvider.wsconnecting
    );
    if (eventId && !yProvider.wsconnected && !yProvider.wsconnecting) {
      yProvider.connect();
      yProvider.on("synced", () => {
        console.dir(yDocToJson(yDoc.current!), { depth: 9 });
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
      method: "POST",
      body: JSON.stringify(calendarEvent),
    }
  );

  const json = await res.json();

  return json;
}
