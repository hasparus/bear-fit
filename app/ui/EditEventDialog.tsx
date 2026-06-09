import Clarity from "@microsoft/clarity";
import { useEffect } from "react";
import { useY } from "react-yjs";

import { CalendarEvent } from "../schemas";
import { getEventMap } from "../shared-data";
import { useYDoc } from "../useYDoc";
import { Dialog, useDialogs } from "./Dialog";
import { EditEventForm } from "./EditEventForm";
import { EditIcon } from "./EditIcon";
import { type EventDatesPayload } from "./EventDatesPicker";

declare module "./Dialog" {
  export interface DialogIds {
    "edit-event": true;
  }
}

export function EditEventDialog() {
  const yDoc = useYDoc();
  const eventMap = getEventMap(yDoc);
  const event = useY(eventMap) as Partial<CalendarEvent>;
  const dialogs = useDialogs();

  const isEditOpen = dialogs.isOpen("edit-event");
  useEffect(() => {
    if (isEditOpen) {
      Clarity.event("event-dates-edit-opened");
    }
  }, [isEditOpen]);

  const handleSubmit = async (payload: EventDatesPayload) => {
    if (payload.kind === "rolling") {
      eventMap.set("rolling", payload.rolling);
      eventMap.delete("startDate");
      eventMap.delete("endDate");
    } else {
      eventMap.set("startDate", payload.startDate);
      eventMap.set("endDate", payload.endDate);
      eventMap.delete("rolling");
    }
    dialogs.set("edit-event", false);
  };

  const hasFixedDates = !!event.startDate && !!event.endDate;
  if (!event.id || (!event.rolling && !hasFixedDates)) {
    return null;
  }

  return (
    <Dialog.Root id="edit-event">
      <Dialog.Trigger className="p-1 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-sm active:bg-black active:text-white">
        <EditIcon className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 dark:bg-white/80 animate-overlay-show" />
        <Dialog.Popup className="grid fixed max-w-[var(--max-width-for-real)] left-[calc(50vw-var(--max-width-for-real)/2)] max-h-[100dvh] inset-0 max-sm:[place-items:center] sm:[place-items:center_end] pointer-events-none">
          <section className="window max-sm:m-0 animate-content-show -col-end-1 pointer-events-auto max-h-full flex flex-col">
            <div className="title-bar">
              <Dialog.Close aria-label="Close" className="close" />
              <Dialog.Title className="title">Edit Event</Dialog.Title>
              <Dialog.Description className="sr-only">
                Change the date range for this event.
              </Dialog.Description>
            </div>
            <div className="p-1 sm:p-2 flex min-h-0 flex-1 flex-col">
              <EditEventForm
                event={event as CalendarEvent}
                onSubmit={handleSubmit}
              />
            </div>
          </section>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
