import type { Doc } from "yjs";

import * as v from "valibot";

import { CalendarEvent } from "./schemas";

export const getEventMap = (doc: Doc) => {
  return doc.getMap("event");
};

export const hasCalendarEvent = (doc: Doc) => {
  return getEventMap(doc).has("id");
};

export const initializeEventMap = (doc: Doc, event: CalendarEvent) => {
  const eventMap = getEventMap(doc);

  eventMap.set("id", event.id);
  eventMap.set("name", event.name);
  eventMap.set("startDate", event.startDate);
  eventMap.set("endDate", event.endDate);
  eventMap.set("creator", event.creator);
};

export function yDocToJson(doc: Doc) {
  return {
    availability: doc.getMap("availability").toJSON(),
    event: doc.getMap("event").toJSON(),
    names: doc.getMap("names").toJSON(),
  };
}

export const YDocJsonSchema = v.object({
  availability: v.record(v.string() /* availability key */, v.boolean()),
  event: CalendarEvent,
  names: v.record(v.string(), v.string()),
});
