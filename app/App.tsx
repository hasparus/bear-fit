import { Suspense } from "react";
import useYProvider from "y-partyserver/react";
import { Doc, encodeStateAsUpdate } from "yjs";

import { postCalendar } from "./api/postCalendar";
import { serverUrl, socketProtocol } from "./api/serverUrl";
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

  return (
    <PreferencesProvider>
      <DialogsProvider>
        <AppHeader />
        <div className="min-h-[89vh] flex items-center mt-2">
          <Routes params={params} />
        </div>
        <AppFooter className="mt-8" currentCalendarId={params.get("id")} />
        <CursorPartyScript />
      </DialogsProvider>
    </PreferencesProvider>
  );
}

/** One doc per calendar, so a calendar's data never syncs into another room. */
const docs = new Map<string, Doc>();
function getCalendarDoc(calendarId: string) {
  let doc = docs.get(calendarId);
  if (!doc) docs.set(calendarId, (doc = new Doc()));
  return doc;
}

function Routes({ params }: { params: ReturnType<typeof useSearchParams> }) {
  const calendarId = params.get("id");

  return calendarId ? (
    <Suspense fallback={<Loading />}>
      <YProvider
        key={calendarId}
        room={calendarId}
        yDoc={getCalendarDoc(calendarId)}
      >
        <CalendarDetails />
      </YProvider>
    </Suspense>
  ) : (
    <CreateCalendarForm
      onSubmit={(calendarEvent) => {
        const doc = getCalendarDoc(calendarEvent.id);
        initializeCalendarMap(doc, calendarEvent);
        params.set("id", calendarEvent.id);
        postCalendar(calendarEvent.id, encodeStateAsUpdate(doc)).catch(
          (error) => {
            console.error("creating calendar failed", error);
          },
        );
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
    options: { connect: true, protocol: socketProtocol },
    room,
  });

  return (
    <YDocContext.Provider value={yDoc}>
      <YProviderContext.Provider value={yProvider}>
        {children}
      </YProviderContext.Provider>
    </YDocContext.Provider>
  );
}
