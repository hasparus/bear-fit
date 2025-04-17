import type {} from "react/canary";

import usePartySocket from "partysocket/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import type { ClientMessage, PublicRoomInfo, Rooms } from "../../party/rooms";

import { OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "../../party/shared";

createRoot(document.getElementById("app")!).render(<Dashboard />);

function Dashboard() {
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<PublicRoomInfo | Rooms | null>(null);

  const ws = usePartySocket({
    host: PARTYKIT_HOST,
    party: "rooms",
    room: OCCUPANCY_SERVER_SINGLETON_ROOM_ID,
    onClose() {
      setConnectionState("disconnected");
    },
    onError(event) {
      setError(JSON.stringify(event));
    },
    onMessage(event) {
      const data = JSON.parse(event.data);
      if ("rooms" in data && rooms && !("rooms" in rooms)) {
        // Don't accept PublicRoomInfo if we already have Rooms
      } else {
        setRooms(data);
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
