import type { Doc } from "yjs";
import * as v from "valibot";

import { CalendarEvent } from "./schemas";
import { useY } from "react-yjs";
import { useYDoc } from "./useYDoc";

export const getEventMap = (doc: Doc) => {
  return doc.getMap("event");
};

export const hasCalendarEvent = (doc: Doc) => {
  return getEventMap(doc).has("id");
};

export const initializeEventMap = (doc: Doc, event: CalendarEvent) => {
  console.log("initialize event map");
  const eventMap = getEventMap(doc);

  eventMap.set("id", event.id);
  eventMap.set("name", event.name);
  eventMap.set("startDate", event.startDate);
  eventMap.set("endDate", event.endDate);
};

export function useCalendarEvent() {
  const doc = useYDoc();
  const data = useY(getEventMap(doc));

  return v.parse(CalendarEvent, data);
}

export function yDocToJson(doc: Doc) {
  return {
    event: doc.getMap("event").toJSON(),
    names: doc.getMap("names").toJSON(),
    availability: doc.getMap("availability").toJSON(),
  };
}
