import { Suspense } from "react";
import PartyProvider from "y-partyserver/provider";
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
  const calendarId = params.get("id");

  return (
    <PreferencesProvider>
      <DialogsProvider>
        <AppHeader />
        <div className="min-h-[89vh] flex items-center mt-2">
          <Routes params={params} />
        </div>
        <AppFooter className="mt-8" currentCalendarId={calendarId} />
        <CursorPartyScript room={calendarId} />
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

const providers = new Map<string, PartyProvider>();
/** Connects to a calendar outside React, so the socket opens before render. */
export function getCalendarProvider(calendarId: string) {
  // ponytail: one calendar per tab, so the others' providers are destroyed
  for (const [id, provider] of providers) {
    if (id === calendarId) continue;
    provider.destroy();
    provider.awareness.destroy();
    providers.delete(id);
  }
  let provider = providers.get(calendarId);
  if (!provider) {
    provider = new PartyProvider(
      serverUrl,
      calendarId,
      getCalendarDoc(calendarId),
      { protocol: socketProtocol },
    );
    providers.set(calendarId, provider);
  }
  return provider;
}

function Routes({ params }: { params: ReturnType<typeof useSearchParams> }) {
  const calendarId = params.get("id");

  return calendarId ? (
    <Suspense fallback={<Loading />}>
      <YProvider calendarId={calendarId} key={calendarId}>
        <CalendarDetails />
      </YProvider>
    </Suspense>
  ) : (
    <CreateCalendarForm
      onSubmit={(calendarEvent) => {
        const doc = getCalendarDoc(calendarEvent.id);
        initializeCalendarMap(doc, calendarEvent);
        getCalendarProvider(calendarEvent.id);
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
  calendarId,
  children,
}: {
  calendarId: string;
  children: React.ReactNode;
}) {
  const yProvider = getCalendarProvider(calendarId);

  return (
    <YDocContext.Provider value={yProvider.doc}>
      <YProviderContext.Provider value={yProvider}>
        {children}
      </YProviderContext.Provider>
    </YDocContext.Provider>
  );
}
