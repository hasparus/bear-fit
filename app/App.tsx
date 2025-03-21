import { Suspense, useRef } from "react";
import useYProvider from "y-partykit/react";
import { Doc } from "yjs";

import type { CalendarEvent } from "./schemas";

import { initializeEventMap } from "./shared-data";
import "./styles.css";
import { CreateEventForm } from "./ui/CreateEventForm";
import { CursorPartyScript } from "./ui/CursorPartyScript";
import { EventDetails } from "./ui/EventDetails";
import { Loading } from "./ui/Loading";
import { useUserState, useUserDispatch } from "./ui/UserStateContext";
import { PreferencesProvider } from "./ui/UserStateContext";
import { useSearchParams } from "./useSearchParams";
import { YDocContext } from "./useYDoc";
import { Container } from "./ui/Container";
import { cn } from "./ui/cn";
import { CheckboxField } from "./ui/CheckboxField";

export function App({ serverUrl }: { serverUrl: string }) {
  const params = useSearchParams();
  const eventId = params.get("id");

  const yDoc = useRef<Doc>(undefined as unknown as Doc);
  if (!yDoc.current) {
    yDoc.current = new Doc();
  }

  return (
    <PreferencesProvider>
      <div className="flex-1 flex items-center">
        {eventId ? (
          <Suspense fallback={<Loading />}>
            <YProvider host={serverUrl} room={eventId} yDoc={yDoc.current}>
              <EventDetails />
            </YProvider>
          </Suspense>
        ) : (
          <CreateEventForm
            onSubmit={(calendarEvent) => {
              initializeEventMap(yDoc.current!, calendarEvent);

              return postEvent(calendarEvent, serverUrl)
                .catch((error) => {
                  console.error("creating event failed", error);
                })
                .then(() => {
                  params.set("id", calendarEvent.id);
                });
            }}
          />
        )}
      </div>
      {eventId && <AppFooter />}
      <CursorPartyScript />
    </PreferencesProvider>
  );
}

async function postEvent(
  calendarEvent: CalendarEvent,
  serverUrl: string,
): Promise<unknown> {
  const res = await fetch(`${serverUrl}/parties/main/${calendarEvent.id}`, {
    body: JSON.stringify(calendarEvent),
    method: "POST",
  });

  if (res.status === 404) {
    throw new Error("server not found");
  }

  const json = await res.json();
  // TODO: If the status was not 200, we should show an error message and retry.
  //       We can test this with a test that passes a wrong server URL.

  return json;
}

function YProvider({
  children,
  host,
  room,
  yDoc,
}: {
  children: React.ReactNode;
  host: string;
  room: string;
  yDoc: Doc;
}) {
  // This needs to be a separate component, because the `.room` option is immutable in
  // `useYProvider`, and we don't know the room until we create the event.
  const _yProvider = useYProvider({
    doc: yDoc,
    host,
    room,
    options: {
      connect: true,
      protocol: process.env.NODE_ENV !== "production" ? "ws" : "wss",
    },
  });

  return <YDocContext.Provider value={yDoc}>{children}</YDocContext.Provider>;
}

function AppFooter() {
  const { nerdMode } = useUserState();
  const dispatch = useUserDispatch();

  // todo: the footer should only show on hover or drag from the bottom on mobile
  // actually, let's ditch the footer and add menu icon that opens a modal
  return (
    <footer className="overflow-hidden px-2 pt-1">
      <Container className="translate-y-1 ![box-shadow:2px_1px]">
        {/* TODO: Your last events open in a modal. */}
        <form>
          <CheckboxField
            checked={nerdMode}
            id="nerd-mode"
            onChange={(e) => {
              dispatch({ type: "set-nerd-mode", payload: e.target.checked });
            }}
          >
            Nerd Mode
          </CheckboxField>
        </form>
      </Container>
    </footer>
  );
}
