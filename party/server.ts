import type * as Party from "partykit/server";
import type { Doc } from "yjs";

import * as v from "valibot";
import { onConnect, type YPartyKitOptions } from "y-partykit";

import { CalendarEvent } from "../app/schemas";
import {
  hasCalendarEvent,
  initializeEventMap,
  yDocToJson,
} from "../app/shared-data";
import { SINGLETON_ROOM_ID } from "./rooms";

const VERBOSE = process.env.NODE_ENV === "development";

export default class EditorServer implements Party.Server {
  doc: Doc | null = null;

  event: CalendarEvent | null = null;
  yjsOptions: YPartyKitOptions = {
    persist: { mode: "history" },
  };

  constructor(public room: Party.Room) {}

  getOpts() {
    // options must match when calling unstable_getYDoc and onConnect
    const opts: YPartyKitOptions = {
      callback: { handler: (doc) => this.handleYDocChange(doc) },
    };
    return opts;
  }

  handleYDocChange(doc: Doc) {
    if (VERBOSE) {
      console.log("↠ handleYDocChange", yDocToJson(doc));
    }

    if (!this.doc) {
      this.doc = doc;
      if (this.event && !hasCalendarEvent(doc)) {
        initializeEventMap(doc, this.event);
      }
    }
  }

  async onClose(_: Party.Connection) {
    void this.updateCount();
  }

  async onConnect(conn: Party.Connection) {
    void this.updateCount();

    if (VERBOSE) {
      console.log("↠ onConnect", this.room.id);
    }

    return onConnect(conn, this.room, this.getOpts());
  }

  async onRequest(req: Party.Request) {
    const url = new URL(req.url);

    if (req.method === "POST" && url.pathname.startsWith("/parties/main/")) {
      const json = await req.json();
      if (VERBOSE) {
        console.log("↠ onRequest", json);
      }

      try {
        const event = v.parse(CalendarEvent, json);
        if (this.event) {
          return Response.json(
            { error: "event already created" },
            { status: 403 }
          );
        } else {
          this.event = event;
          if (this.doc) {
            initializeEventMap(this.doc, event);
          }
          return Response.json({ message: "created" });
        }
      } catch (error) {
        console.error(error);
        return Response.json({ error: "invalid event" }, { status: 400 });
      }
    }

    if (req.method === "GET") {
      return Response.json({
        doc: this.doc ? yDocToJson(this.doc) : null,
        event: this.event,
      });
    }

    return Response.json({ message: "not found" }, { status: 404 });
  }

  async updateCount() {
    // Count the number of live connections
    const count = [...this.room.getConnections()].length;
    // Send the count to the 'rooms' party using HTTP POST
    await this.room.context.parties.rooms
      .get(SINGLETON_ROOM_ID)
      .fetch({
        body: JSON.stringify({ count, room: this.room.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      .catch((error) => {
        console.error("updateCount", error);
      });
  }
}
