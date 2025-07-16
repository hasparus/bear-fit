import { useY } from "react-yjs";

import { CalendarEvent, IsoDate } from "../schemas";
import { getEventMap } from "../shared-data";
import { useYDoc } from "../useYDoc";
import { Dialog, useDialogs } from "./Dialog";
import { EditEventForm } from "./EditEventForm";
import { EditIcon } from "./EditIcon";

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

  const handleSubmit = async (startDate: IsoDate, endDate: IsoDate) => {
    eventMap.set("startDate", startDate);
    eventMap.set("endDate", endDate);
    dialogs.set("edit-event", false);
  };

  if (!event.id || !event.startDate || !event.endDate) {
    return null;
  }

  return (
    <Dialog.Root id="edit-event">
      <Dialog.Trigger
        id="event-history"
        className="p-1 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-sm active:bg-black active:text-white"
      >
        <EditIcon className="size-5" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 dark:bg-white/80 animate-overlay-show" />
        <Dialog.Popup className="grid fixed max-w-[var(--max-width-for-real)] left-[calc(50vw-var(--max-width-for-real)/2)] max-h-screen inset-0 sm:[place-items:center_end]">
          <section className="window max-sm:!m-0 animate-content-show -col-end-1">
            <div className="title-bar">
              <Dialog.Close aria-label="Close" className="close" />
              <Dialog.Title className="title">Edit Event</Dialog.Title>
              <Dialog.Description className="sr-only">
                Change the date range for this event.
              </Dialog.Description>
            </div>
            <div className="p-1 sm:p-2">
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
