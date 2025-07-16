import { useState } from "react";

import { cn } from "./cn";
import { CopyIcon } from "./CopyIcon";
import { Skeleton } from "./Skeleton";
import { TooltipContent } from "./TooltipContent";

interface CopyEventUrlProps
  extends Omit<React.HTMLAttributes<HTMLLabelElement>, "onClick"> {
  eventId: string | undefined;
}

export function CopyEventUrl({ eventId, ...rest }: CopyEventUrlProps) {
  const eventUrl = `${window.location.origin}${window.location.pathname}?id=${eventId}`;
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = () => {
    if (!eventId) {
      throw new Error("No event ID provided");
    }

    const eventUrl = `${window.location.origin}${window.location.pathname}?id=${eventId}`;
    navigator.clipboard.writeText(eventUrl);

    if (!navigator.clipboard) {
      alert("Clipboard not supported");
    }

    navigator.clipboard.writeText(eventUrl);

    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <label
      {...rest}
      className={cn("group relative mt-4 block cursor-copy", rest.className)}
      onClick={handleCopy}
    >
      <span className="block">Event URL</span>

      {eventId ? (
        <>
          <input
            id="eventUrl"
            className="block h-[46px] w-full cursor-copy rounded-sm p-2 pr-10 text-neutral-700 [direction:rtl] group-hover:text-neutral-900"
            readOnly
            value={eventUrl}
          />
          <button
            type="button"
            className="active:bg-black! absolute bottom-[9px] right-2 flex p-1 cursor-copy items-center justify-center rounded-sm active:text-white group-hover:bg-neutral-200"
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            <CopyIcon className="size-5" />
            {showTooltip && (
              <TooltipContent>Copied to clipboard!</TooltipContent>
            )}
          </button>
        </>
      ) : (
        <Skeleton className="h-[46px]" />
      )}
    </label>
  );
}
