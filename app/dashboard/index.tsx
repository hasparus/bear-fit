import type {} from "react/canary";

import usePartySocket from "partysocket/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import type { PublicRoomInfo, Rooms } from "../../party/rooms";

import { OCCUPANCY_SERVER_SINGLETON_ROOM_ID } from "../../party/shared";

createRoot(document.getElementById("app")!).render(<Dashboard />);

function Dashboard() {
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<PublicRoomInfo | Rooms | null>(null);

  const _ws = usePartySocket({
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
      setRooms(data);
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
      <div className="px-1 pb-1 text-sm">
        <div>Connection state: {connectionState}</div>
        {error && <div>Error: {error}</div>}
        <hr className="my-2" />
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
    </div>
  );
}
