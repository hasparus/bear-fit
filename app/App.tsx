import { Suspense, useRef } from "react";
import useYProvider from "y-partyserver/react";
import { Doc } from "yjs";

import { postEvent } from "./api/postEvent";
import { serverUrl } from "./api/serverUrl";
import { AppFooter } from "./AppFooter";
import { initializeEventMap } from "./shared-data";
import { CreateEventForm } from "./ui/CreateEventForm";
import { CursorPartyScript } from "./ui/CursorPartyScript";
import { DialogsProvider } from "./ui/Dialog";
import { EventDetails } from "./ui/EventDetails";
import { Loading } from "./ui/Loading";
import { PreferencesProvider } from "./ui/UserStateContext";
import { useSearchParams } from "./useSearchParams";
import { YDocContext } from "./useYDoc";
import "./styles.css";

export function App() {
  const params = useSearchParams();

  const yDoc = useRef<Doc>(undefined as unknown as Doc);
  if (!yDoc.current) {
    yDoc.current = new Doc();
  }

  return (
    <PreferencesProvider>
      <DialogsProvider>
        <div className="min-h-[89vh] flex items-center">
          <Routes params={params} yDoc={yDoc.current} />
        </div>
        <AppFooter className="!mt-8" currentEventId={params.get("id")} />
        <CursorPartyScript />
      </DialogsProvider>
    </PreferencesProvider>
  );
}

function Routes({
  params,
  yDoc,
}: {
  params: ReturnType<typeof useSearchParams>;
  yDoc: Doc;
}) {
  const eventId = params.get("id");

  return eventId ? (
    <Suspense fallback={<Loading />}>
      <YProvider room={eventId} yDoc={yDoc}>
        <EventDetails />
      </YProvider>
    </Suspense>
  ) : (
    <CreateEventForm
      onSubmit={(calendarEvent) => {
        initializeEventMap(yDoc, calendarEvent);

        return postEvent(calendarEvent)
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
    host: serverUrl,
    room,
    options: {
      connect: true,
      protocol: process.env.NODE_ENV !== "production" ? "ws" : "wss",
    },
  });

  return <YDocContext.Provider value={yDoc}>{children}</YDocContext.Provider>;
}
