import type {} from "react/experimental";
import type { Doc } from "yjs";

import React, {
  type RefObject,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useY } from "react-yjs";

import { getUserId } from "../getUserId";
import {
  type AvailabilitySet,
  type CalendarEvent,
  IsoDate,
  isoDate,
  type UserId,
} from "../schemas";
import { AvailabilityKey } from "../schemas";
import { getEventMap, yDocToJson } from "../shared-data";
import { tryGetFirstDayOfTheWeek } from "../tryGetFirstDayOfTheWeek";
import { useYDoc } from "../useYDoc";
import { AvailabilityGridCell } from "./AvailabilityGridCell";
import { cn } from "./cn";
import { Container } from "./Container";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ContextMenu";
import { CopyEventUrl } from "./CopyEventUrl";
import { eachDayOfInterval } from "./eachDayOfInterval";
import { exportEventJson, ExportEventJson } from "./ExportEventJson";
import { getPaddingDays } from "./getPaddingDays";
import { getWeekDayNames } from "./getWeekDayNames";
import { ImportEventJson, useImportEventJson } from "./ImportEventJson";
import { moveFocusWithArrowKeys } from "./moveFocusWithArrowKeys";
import { overwriteYDocWithJson } from "./overwriteYDocWithJson";
import { Skeleton } from "./Skeleton";
import { TooltipContent } from "./TooltipContent";
import { UserAvailabilitySummary } from "./UserAvailabilitySummary";
import { useUserDispatch, useUserState } from "./UserStateContext";

const userId = getUserId();

export function EventDetails() {
  const yDoc = useYDoc();

  const eventMap = getEventMap(yDoc);
  const event = useY(eventMap) as Partial<CalendarEvent>;

  useRememberEvent(event);

  const namesMap = yDoc.getMap("names");
  const names = useY(namesMap) as Record<UserId, string>;

  const availabilityMap = yDoc.getMap("availability");
  const availability = useY(availabilityMap) as AvailabilitySet;

  const [hoveredUser, setHoveredUser] = useState<UserId | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Record<UserId, boolean>>(
    {},
  );

  const [_tooltipTransition, startTooltipTransition] = useTransition();
  const [hoveredCell, setHoveredCell] = useState<HoveredCellData | undefined>();
  const hoveredCellRef = useRef<HoveredCellData | undefined>(undefined);
  hoveredCellRef.current = hoveredCell;
  const previousHoveredCell = useRef<HoveredCellData | undefined>(undefined);

  const isCreator = userId === event.creator || !event.creator;

  const setAvailability = (userId: UserId, date: IsoDate, value: boolean) => {
    const key = AvailabilityKey(userId, date);

    if (value) {
      availabilityMap.set(key, true);
    } else {
      availabilityMap.delete(key);
    }
  };

  const availabilityForUsers = Object.keys(availability).reduce(
    (acc, key) => {
      const { date, userId } = AvailabilityKey.parseToObject(key);
      if (!acc[userId]) {
        acc[userId] = [];
      }
      acc[userId].push(date);
      return acc;
    },
    {} as Record<UserId, IsoDate[]>,
  );

  const groupedDays = eachDayOfInterval(
    event.startDate ? new Date(event.startDate) : new Date(),
    event.endDate ? new Date(event.endDate) : new Date(),
  ).reduce(
    (acc, day) => {
      const monthKey = `${day.getFullYear()}-${day.getMonth()}`;
      if (!acc[monthKey]) {
        acc[monthKey] = [];
      }
      acc[monthKey].push(day);
      return acc;
    },
    {} as Record<string, Date[]>,
  );

  const availabilityForDates = new Map<IsoDate, UserId[]>();
  for (const [key, available] of Object.entries(availability)) {
    if (!available) continue;

    const { date, userId } = AvailabilityKey.parseToObject(key);
    if (!availabilityForDates.has(date)) {
      availabilityForDates.set(date, []);
    }
    availabilityForDates.get(date)!.push(userId);
  }

  const allUsers = new Set<string>();
  for (const users of Object.keys(availability)) {
    const user = AvailabilityKey.parseToObject(users).userId;
    allUsers.add(user);
  }

  const totalUsers = allUsers.size;

  const [userName, setUserName] = useState<string | undefined>(() => {
    const nameFromYDoc = userId && namesMap.get(userId);
    if (nameFromYDoc && typeof nameFromYDoc === "string") return nameFromYDoc;

    const nameFromLocalStorage = localStorage.getItem("userName");
    if (nameFromLocalStorage && typeof nameFromLocalStorage === "string") {
      if (userId) {
        namesMap.set(userId, nameFromLocalStorage);
      }
      return nameFromLocalStorage;
    }

    return undefined;
  });

  // If we have a name for the user in the YJs doc, we use it.
  if (
    userId &&
    names[userId] &&
    typeof names[userId] === "string" &&
    userName === undefined
  ) {
    setUserName(names[userId]);
  }

  const [dragMode, setDragMode] = useState<"clearing" | "none" | "painting">(
    "none",
  );
  const [lastToggled, setLastToggled] = useState<string | null>(null);

  const handlePointerDown = (date: IsoDate, currentUserAvailable: boolean) => {
    setDragMode(currentUserAvailable ? "clearing" : "painting");
    setAvailability(userId!, date, !currentUserAvailable);
    setLastToggled(date);
  };

  const lastToggledByDrag = useRef<HTMLButtonElement | null>(null);

  const handlePointerEnter = (
    date: IsoDate,
    availableUsers: UserId[],
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (userId && dragMode !== "none" && lastToggled !== date) {
      setAvailability(userId, date, dragMode === "painting");
      setLastToggled(date);
      lastToggledByDrag.current = event.currentTarget;
    } else if (!hoveredCell || hoveredCell.date !== date) {
      startTooltipTransition(() => {
        previousHoveredCell.current = hoveredCell;
        setHoveredCell({
          availableUsers,
          date,
        });
      });
    }
  };

  useEffect(() => {
    const handleMouseUp = () => {
      setDragMode("none");
      setLastToggled(null);
      if (lastToggledByDrag.current) {
        lastToggledByDrag.current.focus();
        lastToggledByDrag.current = null;
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // I need SSR for this to affect social cards.
  // Left for a migration to PartyServer.
  useEffect(() => {
    if (event.name) {
      const oldTitle = document.title;
      document.title = `bear-fit: ${event.name}`;

      // This won't do anything. Need to move it to render to SSR.
      const metaTitle = document.querySelector("meta[name='title']");
      const metaTitleName = metaTitle?.getAttribute("content");
      if (metaTitle) {
        metaTitle.setAttribute("content", `bear-fit: ${event.name}`);
      }

      return () => {
        document.title = oldTitle;
        if (metaTitleName && metaTitle) {
          metaTitle.setAttribute("content", metaTitleName);
        }
      };
    }
  }, [event.name]);

  const monthCount = Object.keys(groupedDays).length;

  const importEventJson = useImportEventJson();

  return (
    <ContextMenu>
      <Container wide={monthCount > 1}>
        <ContextMenuTrigger>
          <form
            onSubmit={(e) => e.preventDefault()}
            className={cn(
              "font-[inherit] text-base",
              monthCount > 1 &&
                "lg:grid lg:grid-areas-[details_calendar] lg:grid-cols-[1fr_auto_1fr] lg:gap-4",
            )}
          >
            <div>
              <p className="block font-mono text-sm">Calendar</p>
              <h1 className="mb-4 text-2xl">
                {event.name || <Skeleton className="h-[32px]" />}
              </h1>
              <p className="block font-mono text-sm">Event dates</p>
              <p aria-busy={!event.startDate} className="mb-4">
                {event.startDate && event.endDate ? (
                  <>
                    <time dateTime={event.startDate}>
                      {new Date(event.startDate).toLocaleDateString()}
                    </time>
                    {" - "}
                    <time dateTime={event.endDate}>
                      {new Date(event.endDate).toLocaleDateString()}
                    </time>
                  </>
                ) : (
                  <Skeleton className="w-[206px]" />
                )}
              </p>
              <div className="mb-4">
                <label className="block" htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  type="text"
                  className="w-full border p-2 rounded-sm"
                  value={userName || ""}
                  onChange={(e) => {
                    if (!userId) {
                      throw new Error("user id is missing");
                    }

                    const value = e.target.value;
                    setUserName(value);
                    namesMap.set(userId, value);
                    setTimeout(() => {
                      localStorage.setItem("userName", value);
                    });
                  }}
                />
              </div>
              <div className="mb-4 font-mono text-sm text-neutral-500">
                {!event.id ? (
                  <>&nbsp;</>
                ) : (
                  <UserAvailabilitySummary
                    availabilityForUsers={availabilityForUsers}
                    creatorId={event.creator}
                    names={names}
                    onHover={(userId) => setHoveredUser(userId)}
                    selectedUsers={selectedUsers}
                    userId={userId}
                    onSelect={(userId) => {
                      if (!userId) return;
                      setSelectedUsers((prev) => ({
                        ...prev,
                        [userId]: !prev[userId],
                      }));
                    }}
                  />
                )}
              </div>
              <CopyEventUrl className="max-lg:hidden" eventId={event.id} />
            </div>
            <div className="w-px bg-neutral-200 max-lg:hidden" />
            <div className="mb-6 mt-2 min-h-[72px]" role="grid">
              {event.startDate &&
                Object.entries(groupedDays).map(([monthKey, monthDays]) => (
                  <React.Fragment key={monthKey}>
                    <div className="mb-2 mt-4 first:mt-2">
                      {monthDays[0].toLocaleDateString("en-US", {
                        month: "long",
                      })}
                    </div>
                    <div className="grid grid-cols-7 gap-1 relative">
                      <GridCellTooltip
                        hoveredCell={hoveredCell}
                        names={names}
                        previousHoveredCell={previousHoveredCell}
                      />
                      {getWeekDayNames(tryGetFirstDayOfTheWeek() ?? 0).map(
                        (name) => (
                          <div
                            className="flex h-10 items-center justify-center text-[11.6667px] font-medium opacity-75"
                            key={name}
                          >
                            {name}
                          </div>
                        ),
                      )}

                      {[
                        ...Array(
                          getPaddingDays(
                            monthDays[0],
                            tryGetFirstDayOfTheWeek() ?? 0,
                          ),
                        ),
                      ].map((_, i) => (
                        <div className="h-10" key={`padding-${i}`} />
                      ))}

                      {monthDays.map((day, i) => {
                        const dateStr = isoDate(day);
                        const availableUsers =
                          availabilityForDates.get(dateStr) || [];

                        const currentUserAvailable =
                          !!userId && availableUsers.includes(userId);

                        let atLeastOneSelectedUserIsUnavailable = false;
                        for (const [userId, selected] of Object.entries(
                          selectedUsers,
                        )) {
                          const unavailable = !availableUsers.includes(
                            userId as UserId,
                          );

                          if (selected && unavailable) {
                            atLeastOneSelectedUserIsUnavailable = true;
                            break;
                          }
                        }

                        const hoveredUserIsAvailable =
                          hoveredUser && availableUsers.includes(hoveredUser);

                        const hoveredUserIsUnavailable =
                          hoveredUser && !availableUsers.includes(hoveredUser);

                        return (
                          <AvailabilityGridCell
                            availableUsers={availableUsers}
                            day={day}
                            key={`${day}-${i}`}
                            tabIndex={i === 0 ? 0 : -1}
                            totalUsers={totalUsers}
                            className={cn(
                              !hoveredUser &&
                                currentUserAvailable &&
                                "border-neutral-200 border-[6px] hover:border-[6px]",
                              hoveredUserIsAvailable &&
                                "border-neutral-200 border-4",
                              atLeastOneSelectedUserIsUnavailable &&
                                "opacity-80 saturate-25",
                              hoveredUserIsUnavailable &&
                                "opacity-60 saturate-25",
                              "hover:[anchor-name:--tooltip-anchor]",
                              "touch-pan-y touch-pinch-zoom",
                            )}
                            onKeyDown={(event) =>
                              moveFocusWithArrowKeys(event, () =>
                                setAvailability(
                                  userId!,
                                  dateStr,
                                  !currentUserAvailable,
                                ),
                              )
                            }
                            onPointerDown={(event) => {
                              if (
                                event.pointerType === "mouse" &&
                                event.button === 2
                              ) {
                                // right clicks open context menu
                                return;
                              }

                              console.log("pointer down", dateStr);
                              handlePointerDown(
                                dateStr,
                                !!currentUserAvailable,
                              );

                              // This is needed for drag-painting to work on mobiles.
                              event.currentTarget.releasePointerCapture(
                                event.pointerId,
                              );
                            }}
                            onPointerEnter={(event) => {
                              handlePointerEnter(
                                dateStr,
                                availableUsers,
                                event,
                              );
                            }}
                            onPointerLeave={(event) => {
                              if (event.target === event.currentTarget) {
                                setTimeout(() => {
                                  if (hoveredCellRef.current === hoveredCell) {
                                    previousHoveredCell.current = hoveredCell;
                                    setHoveredCell(undefined);
                                  }
                                }, 150);
                              }
                            }}
                            onPointerOver={(event) => {
                              console.log("pointer over", dateStr);
                            }}
                          />
                        );
                      })}
                    </div>
                  </React.Fragment>
                ))}
            </div>
            <CopyEventUrl className="lg:hidden" eventId={event.id} />
            {importEventJson.hiddenInputElement}
          </form>

          {event.name && (
            <EventDetailsFooter isCreator={isCreator} yDoc={yDoc} />
          )}
        </ContextMenuTrigger>
      </Container>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => exportEventJson(yDoc)}>
          Export to JSON file
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            const json = yDocToJson(yDoc);
            navigator.clipboard.writeText(JSON.stringify(json, null, 2));
          }}
        >
          Copy event JSON
        </ContextMenuItem>
        {isCreator && (
          <>
            <ContextMenuItem
              onClick={() => {
                importEventJson.openFileDialog();
              }}
            >
              Import from JSON file
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                navigator.clipboard
                  .readText()
                  .then((text) => {
                    overwriteYDocWithJson(yDoc, JSON.parse(text));
                  })
                  .catch((error) => {
                    console.error("Error importing JSON:", error);
                  });
              }}
            >
              Import from clipboard
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function GridCellTooltip({
  hoveredCell,
  names,
  previousHoveredCell,
}: {
  hoveredCell: HoveredCellData | undefined;
  names: Record<UserId, string>;
  previousHoveredCell: RefObject<HoveredCellData | undefined>;
}) {
  const tooltipRef = useRef<HTMLSpanElement | null>(null);

  const users =
    hoveredCell?.availableUsers || previousHoveredCell.current?.availableUsers;

  // Track mouse position
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // Effect to update the tooltip position based on mouse position
  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", updateMousePosition);

    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
    };
  }, []);

  // Effect to position the tooltip
  useEffect(() => {
    if (tooltipRef.current && hoveredCell) {
      const grid = tooltipRef.current.closest(".grid");

      if (grid) {
        const gridRect = grid.getBoundingClientRect();

        let x = mousePosition.x - gridRect.left;
        const y = mousePosition.y - gridRect.top;

        const paddingX = 16;

        x = Math.min(Math.max(x, paddingX), gridRect.width - paddingX);

        tooltipRef.current.style.transform = `translate3d(calc(${x}px - 50%), ${y - 8}px, 0)`;
      }
    }
  }, [hoveredCell, mousePosition, tooltipRef]);

  // TODO: We can't use view transitions together with system.css, because the `filter: invert(0.9)`
  // isn't applied to transition layer, and the colors blink jarringly. If we migrated out of system.css,
  // to our own stylesheet with proper dark mode support, we could add `<unstable_ViewTransition>` here.
  return (
    <TooltipContent
      className="whitespace-pre text-left left-0 z-10 translate-none motion-reduce:!transition-none"
      ref={tooltipRef}
      style={{
        opacity: hoveredCell && hoveredCell.availableUsers.length > 0 ? 1 : 0,
        transform: "translate3d(-9999px, -9999px, 0)",
        transition:
          hoveredCell && previousHoveredCell.current
            ? "opacity 150ms, transform 75ms"
            : "opacity 150ms",
      }}
    >
      {users && (
        <ul className="flex flex-col">
          {users.map((userId) => (
            <li key={userId}>{names[userId]}</li>
          ))}
        </ul>
      )}
    </TooltipContent>
  );
}

interface HoveredCellData {
  availableUsers: UserId[];
  date: IsoDate;
}

interface EventDetailsFooterProps {
  isCreator: boolean;
  yDoc: Doc;
}

function EventDetailsFooter({ isCreator, yDoc }: EventDetailsFooterProps) {
  const { nerdMode } = useUserState();

  if (!nerdMode) return null;

  return (
    <footer className="flex justify-end gap-2 border-t border-neutral-200 pt-3">
      <>
        {isCreator && <ImportEventJson />}
        <ExportEventJson yDoc={yDoc} />
      </>
    </footer>
  );
}

function useRememberEvent(event: Partial<CalendarEvent>) {
  const dispatch = useUserDispatch();

  useEffect(() => {
    if (event.id) {
      dispatch({ type: "remember-event", payload: event as CalendarEvent });
    }
  }, [event]);
}
