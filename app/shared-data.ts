import type { Doc } from "yjs";
import type { Map as YMap } from "yjs";

import { type } from "arktype";

import {
  CalendarEvent,
  type EventDatesPatch,
  UserId,
} from "./schemas";

export const getEventMap = (doc: Doc) => {
  return doc.getMap("event");
};

export const hasCalendarEvent = (doc: Doc) => {
  return getEventMap(doc).has("id");
};

export const applyEventDates = (
  eventMap: YMap<unknown>,
  patch: EventDatesPatch,
) => {
  if ("rolling" in patch) {
    eventMap.set("rolling", patch.rolling);
    eventMap.delete("startDate");
    eventMap.delete("endDate");
  } else {
    eventMap.set("startDate", patch.startDate);
    eventMap.set("endDate", patch.endDate);
    eventMap.delete("rolling");
  }
};

export const initializeEventMap = (doc: Doc, event: CalendarEvent) => {
  const eventMap = getEventMap(doc);

  eventMap.set("id", event.id);
  eventMap.set("name", event.name);
  eventMap.set("creator", event.creator);
  if (event.rolling) {
    applyEventDates(eventMap, { rolling: event.rolling });
  } else {
    applyEventDates(eventMap, {
      endDate: event.endDate!,
      startDate: event.startDate!,
    });
  }
};

export function yDocToJson(doc: Doc) {
  return {
    availability: doc.getMap("availability").toJSON(),
    event: doc.getMap("event").toJSON(),
    names: doc.getMap("names").toJSON(),
  };
}

export const YDocJsonSchema = type({
  availability: type.Record("string", "boolean"),
  event: CalendarEvent,
  names: type.Record(UserId, "string"),
});

export type YDocJson = typeof YDocJsonSchema.infer;

export type { EventDatesPatch };
