import { Suspense, useRef } from "react";
import useYProvider from "y-partykit/react";
import { Doc } from "yjs";

import { postCalendar } from "./api/postCalendar";
import { serverUrl } from "./api/serverUrl";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { initializeCalendarMap } from "./shared-data";
import { CalendarDetails } from "./ui/CalendarDetails";
import { CreateCalendarForm } from "./ui/CreateCalendarForm";
import { CursorPartyScript } from "./ui/CursorPartyScript";
import { DialogsProvider } from "./ui/Dialog";
import { Loading } from "./ui/Loading";
import { PreferencesProvider } from "./ui/UserStateContext";
import { useSearchParams } from "./useSearchParams";
import { YDocContext, YProviderContext } from "./useYDoc";
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
        <AppHeader />
        <div className="min-h-[89vh] flex items-center mt-2">
          <Routes params={params} yDoc={yDoc.current} />
        </div>
        <AppFooter className="mt-8" currentCalendarId={params.get("id")} />
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
  const calendarId = params.get("id");

  return calendarId ? (
    <Suspense fallback={<Loading />}>
      <YProvider room={calendarId} yDoc={yDoc}>
        <CalendarDetails />
      </YProvider>
    </Suspense>
  ) : (
    <CreateCalendarForm
      onSubmit={(calendarEvent) => {
        initializeCalendarMap(yDoc, calendarEvent);

        return postCalendar(calendarEvent)
          .catch((error) => {
            console.error("creating calendar failed", error);
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
  const yProvider = useYProvider({
    doc: yDoc,
    host: serverUrl,
    room,
    options: {
      connect: true,
      protocol: process.env.NODE_ENV !== "production" ? "ws" : "wss",
    },
  });

  return (
    <YDocContext.Provider value={yDoc}>
      <YProviderContext.Provider value={yProvider}>
        {children}
      </YProviderContext.Provider>
    </YDocContext.Provider>
  );
}
