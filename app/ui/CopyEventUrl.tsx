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
            className="block h-[46px] w-full cursor-copy rounded-sm p-2 pr-10 text-neutral-700 [direction:rtl] group-hover:text-neutral-900"
            id="eventUrl"
            readOnly
            value={eventUrl}
          />
          <button
            className="active:bg-black! absolute bottom-[7.4px] right-[7px] flex size-7 cursor-copy items-center justify-center  rounded-md active:text-white group-hover:bg-neutral-200"
            onClick={handleCopy}
            title="Copy to clipboard"
            type="button"
          >
            <CopyIcon />
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
