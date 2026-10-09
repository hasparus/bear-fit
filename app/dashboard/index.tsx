import type {} from "react/canary";

import usePartySocket from "partysocket/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  AUTH_CHALLENGE_PREFIX,
  type ClientMessage,
  type PublicRoomInfo,
  type Rooms,
  type ServerMessage,
} from "../../party/rooms";
import { OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "../../party/shared";
import { serverUrl } from "../api/serverUrl";
import "../styles.css";

createRoot(document.getElementById("app")!).render(<Dashboard />);

function Dashboard() {
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<PublicRoomInfo | Rooms | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);

  const ws = usePartySocket({
    host: serverUrl,
    party: "rooms",
    room: OCCUPANCY_SERVER_SINGLETON_ROOM_ID,
    onClose() {
      setConnectionState("disconnected");
    },
    onError(event) {
      setError(JSON.stringify(event));
    },
    onMessage(event) {
      const data = JSON.parse(event.data) as ServerMessage;
      if (data.type === "challenge") {
        setChallenge(data.challenge);
      } else if (data.type === "rooms") {
        setRooms(data.rooms);
      } else {
        // Don't accept PublicRoomInfo if we already have Rooms
        setRooms((prev) =>
          prev && !("activeConnections" in prev) ? prev : data.info,
        );
      }
    },
    onOpen() {
      setConnectionState("connected");
    },
  });

  return (
    <div className="window">
      <header className="title-bar">
        <h1 className="title">Dashboard</h1>
      </header>
      <div className="p-2 text-sm">
        <div>Connection state: {connectionState}</div>
        {error && <div>Error: {error}</div>}
        <div className="my-2 bg-neutral-100 p-2">
          {(() => {
            if (!rooms) {
              return null;
            }

            if ("activeConnections" in rooms) {
              return (
                <dl className="grid grid-cols-2 gap-2">
                  <dt>Rooms:</dt>
                  <dd>{rooms.rooms}</dd>
                  <dt>Active connections:</dt>
                  <dd>{rooms.activeConnections}</dd>
                </dl>
              );
            } else {
              return (
                <ul>
                  {Object.entries(rooms).map(([roomId, count]) => (
                    <li key={roomId}>
                      {roomId}: {count} connections
                    </li>
                  ))}
                </ul>
              );
            }
          })()}
        </div>
        {challenge && (
          <p className="mb-2">
            Sign{" "}
            <code>
              {AUTH_CHALLENGE_PREFIX}
              {challenge}
            </code>{" "}
            with the admin key.
          </p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const signature = formData.get("signature")?.toString();
            if (signature) {
              ws.send(
                JSON.stringify({
                  type: "auth",
                  payload: { signature },
                } satisfies ClientMessage),
              );
            }
          }}
        >
          <input
            type="text"
            className="w-full"
            name="signature"
            placeholder="admin access key"
          />
          <button type="submit" className="btn shrink-0">
            Authorize
          </button>
        </form>
      </div>
    </div>
  );
}
