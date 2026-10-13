import type { Doc } from "yjs";

import { type } from "arktype";

import { type CalendarDatesPatch, CalendarEvent, UserId } from "./schemas";

export const getCalendarMap = (doc: Doc) => {
  return doc.getMap("event");
};

export const hasCalendarEvent = (doc: Doc) => {
  return getCalendarMap(doc).has("id");
};

export const applyCalendarDates = (doc: Doc, patch: CalendarDatesPatch) => {
  const calendarMap = getCalendarMap(doc);
  doc.transact(() => {
    if ("rolling" in patch) {
      calendarMap.set("rolling", patch.rolling);
      calendarMap.delete("startDate");
      calendarMap.delete("endDate");
    } else {
      calendarMap.set("startDate", patch.startDate);
      calendarMap.set("endDate", patch.endDate);
      calendarMap.delete("rolling");
    }
  });
};

export const initializeCalendarMap = (doc: Doc, event: CalendarEvent) => {
  const calendarMap = getCalendarMap(doc);

  calendarMap.set("id", event.id);
  calendarMap.set("name", event.name);
  calendarMap.set("creator", event.creator);
  if (event.rolling) {
    applyCalendarDates(doc, { rolling: event.rolling });
  } else {
    applyCalendarDates(doc, {
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

export type { CalendarDatesPatch };
