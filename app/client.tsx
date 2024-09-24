import {} from "react/canary";
import { use, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";

import { CreateEventForm } from "./components/CreateEventForm";
import { EventDetails } from "./components/EventDetails";
import { CalendarEvent } from "./schemas";

import "./styles.css";

function App() {
  const [eventId, setEventId] = useState(
    new URLSearchParams(window.location.search).get("id")
  );

  const [createdEvent, setCreatedEvent] = useState<CalendarEvent | null>(null);

  return (
    <main className="font-[Chicago]">
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
    </main>
  );
}

createRoot(document.getElementById("app")!).render(<App />);

function Details({
  event,
  eventId,
}: {
  event: CalendarEvent | null;
  eventId: string;
}) {
  event ||= use<CalendarEvent>(
    fetch(`/api/events/${eventId}`).then((res) => res.json())
  );

  return <EventDetails event={event} />;
}
