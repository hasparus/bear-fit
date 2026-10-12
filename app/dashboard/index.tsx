import type {} from "react/canary";

import usePartySocket from "partysocket/react";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  AUTH_CHALLENGE_PREFIX,
  type ClientMessage,
  OCCUPANCY_SERVER_SINGLETON_ROOM_ID,
  type PublicRoomInfo,
  type ServerMessage,
} from "../../party/rooms";
import { serverUrl, socketProtocol } from "../api/serverUrl";
import "../styles.css";

createRoot(document.getElementById("app")!).render(<Dashboard />);

type AdminInfo = Omit<Extract<ServerMessage, { type: "admin" }>, "type">;

function Dashboard() {
  const [connectionState, setConnectionState] = useState<
    "connected" | "connecting" | "disconnected"
  >("connecting");
  const [error, setError] = useState<string | null>(null);
  const [publicInfo, setPublicInfo] = useState<PublicRoomInfo | null>(null);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);

  const ws = usePartySocket({
    host: serverUrl,
    party: "rooms",
    protocol: socketProtocol,
    room: OCCUPANCY_SERVER_SINGLETON_ROOM_ID,
    onClose() {
      setConnectionState("disconnected");
      setAdmin(null);
    },
    onError(event) {
      setError(JSON.stringify(event));
    },
    onMessage(event) {
      const data = JSON.parse(event.data) as ServerMessage;
      if (data.type === "challenge") {
        setChallenge(data.challenge);
        setAdmin(null);
      } else if (data.type === "admin") {
        setAdmin({ calendars: data.calendars, rooms: data.rooms });
      } else if (data.type === "rooms") {
        setAdmin((admin) => admin && { ...admin, rooms: data.rooms });
      } else if (data.type === "calendar") {
        setAdmin(
          (admin) =>
            admin && {
              ...admin,
              calendars:
                data.calendar.createdAt === null
                  ? [...admin.calendars, data.calendar]
                  : [data.calendar, ...admin.calendars],
            },
        );
      } else {
        setPublicInfo(data.info);
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
        {admin ? (
          <>
            <div className="my-2 bg-neutral-100 p-2">
              <ul>
                {Object.entries(admin.rooms).map(([roomId, count]) => (
                  <li key={roomId}>
                    {roomId}: {count} connections
                  </li>
                ))}
              </ul>
            </div>
            <table aria-label="Calendars" className="w-full text-left">
              <thead>
                <tr>
                  <th>Calendar</th>
                  <th>Created</th>
                  <th>Connections</th>
                </tr>
              </thead>
              <tbody>
                {admin.calendars.map(({ id, createdAt }) => (
                  <tr key={id}>
                    <td>
                      <a href={`/?id=${encodeURIComponent(id)}`}>{id}</a>
                    </td>
                    <td>
                      {createdAt === null
                        ? "unknown"
                        : new Date(createdAt).toLocaleString()}
                    </td>
                    <td>{admin.rooms[id] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            {publicInfo && (
              <div className="my-2 bg-neutral-100 p-2">
                <dl className="grid grid-cols-2 gap-2">
                  <dt>Rooms:</dt>
                  <dd>{publicInfo.rooms}</dd>
                  <dt>Active connections:</dt>
                  <dd>{publicInfo.activeConnections}</dd>
                </dl>
              </div>
            )}
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
          </>
        )}
      </div>
    </div>
  );
}
