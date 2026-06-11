import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import useYProvider from "y-partyserver/react";
import * as Y from "yjs";
import { Doc } from "yjs";

import type { EventResponse } from "./api/getEvent";

import { getEvent } from "./api/getEvent";
import { postEvent } from "./api/postEvent";
import { serverUrl } from "./api/serverUrl";
import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { getEventMap, initializeEventMap } from "./shared-data";
import { Container } from "./ui/Container";
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
        <AppHeader />
        <div className="min-h-[89vh] flex items-center mt-2">
          <Routes params={params} yDoc={yDoc.current} />
        </div>
        <AppFooter className="mt-8" currentEventId={params.get("id")} />
        <CursorPartyScript />
      </DialogsProvider>
    </PreferencesProvider>
  );
}

type PreflightState =
  | { json: EventResponse; status: "expired" }
  | { status: "live" }
  | { status: "loading" }
  | { status: "not-found" };

function Routes({
  params,
  yDoc,
}: {
  params: ReturnType<typeof useSearchParams>;
  yDoc: Doc;
}) {
  const eventId = params.get("id");

  const [preflight, setPreflight] = useState<PreflightState>({ status: "loading" });

  useEffect(() => {
    if (!eventId) return;
    if (getEventMap(yDoc).get("id") === eventId) {
      setPreflight({ status: "live" });
      return;
    }
    setPreflight({ status: "loading" });
    getEvent(eventId)
      .then((json) => {
        if (!json.event?.id) {
          setPreflight({ status: "not-found" });
        } else if (json.expiredAt != null) {
          setPreflight({ json, status: "expired" });
        } else {
          setPreflight({ status: "live" });
        }
      })
      .catch(() => {
        setPreflight({ status: "not-found" });
      });
  }, [eventId, yDoc]);

  const hydratedDoc = useMemo(
    () =>
      preflight.status === "expired" ? hydrateDocFromJson(preflight.json) : null,
    [preflight],
  );

  if (!eventId) {
    return (
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

  if (preflight.status === "loading") {
    return <Loading />;
  }

  if (preflight.status === "not-found") {
    return <NotFoundBox />;
  }

  if (preflight.status === "expired" && hydratedDoc) {
    const expiredDate = new Date(preflight.json.expiredAt!).toLocaleDateString(
      undefined,
      { day: "numeric", month: "long", timeZone: "UTC", year: "numeric" },
    );
    return (
      <div className="w-(--container-width) mx-auto">
        <div className="mb-2 px-[10px] py-2 bg-neutral-100 border border-neutral-300 rounded-sm font-mono text-sm text-neutral-700">
          This event expired on {expiredDate} and is now read-only.
        </div>
        <YDocContext.Provider value={hydratedDoc}>
          <EventDetails disabled />
        </YDocContext.Provider>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <YProvider room={eventId} yDoc={yDoc}>
        <EventDetails />
      </YProvider>
    </Suspense>
  );
}

function NotFoundBox() {
  return (
    <Container>
      <h1 className="mb-4 font-bold leading-[1.3333]">Event not found</h1>
      <p className="mb-4 font-mono text-sm text-neutral-500">
        This link doesn&apos;t point to an existing event &mdash; it may have
        expired after 60 days of inactivity.
      </p>
      <a className="btn btn-default" href="/">
        Create a new event
      </a>
    </Container>
  );
}

function hydrateDocFromJson(json: EventResponse): Doc {
  const doc = new Y.Doc();
  const eventMap = doc.getMap("event");
  const namesMap = doc.getMap("names");
  const availabilityMap = doc.getMap("availability");

  Object.entries(json.event).forEach(([k, v]) => {
    eventMap.set(k, v);
  });
  Object.entries(json.names).forEach(([k, v]) => {
    namesMap.set(k, v);
  });
  Object.entries(json.availability).forEach(([k, v]) => {
    availabilityMap.set(k, v);
  });

  return doc;
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
  const _yProvider = useYProvider({
    doc: yDoc,
    host: serverUrl,
    room,
    options: {
      connect: true,
      protocol:
        typeof window !== "undefined" && window.location.protocol === "https:"
          ? "wss"
          : "ws",
    },
  });

  return <YDocContext.Provider value={yDoc}>{children}</YDocContext.Provider>;
}
