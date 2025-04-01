import type * as Party from "partykit/server";

import * as v from "valibot";
import { onConnect, unstable_getYDoc, type YPartyKitOptions } from "y-partykit";
import { Doc } from "yjs";

import { CalendarEvent } from "../app/schemas";
import {
  hasCalendarEvent,
  initializeEventMap,
  yDocToJson,
} from "../app/shared-data";
import { CORS, OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "./shared";

const VERBOSE = process.env.NODE_ENV === "development";

export default class EditorServer implements Party.Server {
  doc: Doc | null = null;

  event: CalendarEvent | null = null;

  // TODO: Test how it affects the server. May cause problems with Yjs.
  // options = {
  //   hibernate: true,
  // };

  constructor(public room: Party.Room) {
    unstable_getYDoc(this.room, this.yPartyKitOptions).then((doc) => {
      this.doc = doc;
      if (this.event && !hasCalendarEvent(doc)) {
        initializeEventMap(doc, this.event);
      }
    });
  }

  /**
   * Must be the same when calling unstable_getYDoc and onConnect.
   */
  yPartyKitOptions: YPartyKitOptions = {
    callback: { handler: (doc) => this.handleYDocChange(doc) },
    persist: { mode: "history" },
  };

  private handleYDocChange(doc: Doc) {
    if (VERBOSE) {
      console.log("↠ handleYDocChange", yDocToJson(doc));
    }
  }

  private async updateCount() {
    // Count the number of live connections
    const count = [...this.room.getConnections()].length;
    // Send the count to the 'rooms' party using HTTP POST
    await this.room.context.parties.rooms
      .get(OCCUPANCY_SERVER_SINGLETON_ROOM_ID)
      .fetch({
        body: JSON.stringify({ count, room: this.room.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      })
      .catch((error) => {
        console.error("updateCount", error);
      });
  }

  async onClose(_: Party.Connection) {
    void this.updateCount();
  }

  async onConnect(conn: Party.Connection) {
    void this.updateCount();

    if (VERBOSE) {
      console.log("↠ onConnect", this.room.id);
    }

    return onConnect(conn, this.room, this.yPartyKitOptions);
  }

  async onRequest(req: Party.Request) {
    const url = new URL(req.url);

    // We only allow CORS requests in development and tests.
    // In prod, the server is deployed together with the client.
    const headers = process.env.NODE_ENV !== "production" ? CORS : undefined;

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers });
    }

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
            { headers, status: 403 },
          );
        } else {
          this.event = event;
          if (this.doc) {
            initializeEventMap(this.doc, event);
          }
          return Response.json({ message: "created" }, { headers });
        }
      } catch (error) {
        console.error(error);
        return Response.json(
          { error: "invalid event" },
          { headers, status: 400 },
        );
      }
    }

    if (req.method === "GET") {
      if (url.pathname === "/parties/main/status") {
        return new Response("ok", { headers });
      }

      return Response.json({
        doc: this.doc ? yDocToJson(this.doc) : null,
        event: this.event,
      });
    }

    return Response.json({ message: "not found" }, { headers, status: 404 });
  }
}
