import type {} from "react/canary";
import useYProvider from "y-partykit/react";
import { use, Suspense, useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useY } from "react-yjs";

import { CreateEventForm } from "./ui/CreateEventForm";
import { EventDetails } from "./ui/EventDetails";
import { CalendarEvent } from "./schemas";

import "./styles.css";
import { YDocContext } from "./useYDoc";
import { Doc } from "yjs";

function App() {
  const [eventId, setEventId] = useState(
    new URLSearchParams(window.location.search).get("id")
  );

  const [createdEvent, setCreatedEvent] = useState<CalendarEvent | null>(null);

  return (
    <>
      {eventId ? (
        <Suspense fallback={<div>Loading...</div>}>
          <Details eventId={eventId} event={createdEvent} />
        </Suspense>
      ) : (
        <CreateEventForm
          createEvent={(calendarEvent) => {
            setEventId(calendarEvent.id);
            setCreatedEvent(calendarEvent);
            window.history.pushState({}, "", `?id=${calendarEvent.id}`);

            fetch(`/api/events/${calendarEvent.id}`, {
              method: "POST",
              body: JSON.stringify(calendarEvent),
            });
          }}
        />
      )}
    </>
  );
}

function Details({
  event: initialEvent,
  eventId,
}: {
  event: CalendarEvent | null;
  eventId: string;
}) {
  const yDoc = useRef<Doc>();
  if (!yDoc.current) {
    yDoc.current = new Doc();
  }

  const _yProvider = useYProvider({
    room: eventId,
    doc: yDoc.current,
  });

  const eventMap = yDoc.current.getMap("event");

  useEffect(() => {
    if (initialEvent && !eventMap.get("name")) {
      eventMap.set("id", initialEvent.id);
      eventMap.set("name", initialEvent.name);
      eventMap.set("startDate", initialEvent.startDate);
      eventMap.set("endDate", initialEvent.endDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEvent?.id]);

  const event = useY(eventMap) as CalendarEvent;

  return (
    <YDocContext.Provider value={yDoc.current}>
      <EventDetails event={initialEvent || event} />
    </YDocContext.Provider>
  );
}

createRoot(document.getElementById("app")!).render(<App />);
