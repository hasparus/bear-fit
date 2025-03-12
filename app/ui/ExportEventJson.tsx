import type { Doc } from "yjs";

import React, { useState } from "react";

import { getEventMap, yDocToJson } from "../shared-data";
import { cn } from "./cn";
import { DownloadIcon } from "./DownloadIcon";
import { TooltipContent } from "./TooltipContent";

export function exportEventJson(yDoc: Doc) {
  const data = yDocToJson(yDoc);
  const eventMap = getEventMap(yDoc);
  const eventName = eventMap.get("name");

  if (!eventName) {
    throw new Error("No event name provided");
  }

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${eventName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ExportEventJsonProps extends React.HTMLAttributes<HTMLButtonElement> {
  yDoc: Doc;
}

export function ExportEventJson({
  className,
  yDoc,
  ...rest
}: ExportEventJsonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <button
      className={cn(
        "relative flex p-1 bg-neu-tral-100 hover:bg-neutral-200 cursor-pointer items-center justify-center rounded-md active:bg-black active:text-white group-hover:bg-neutral-200",
        className,
      )}
      onClick={() => {
        setShowTooltip(true);
        exportEventJson(yDoc);
        setTimeout(() => setShowTooltip(false), 2000);
      }}
      title="Export to JSON"
      type="button"
      {...rest}
    >
      <DownloadIcon className="size-5" />
      {showTooltip && <TooltipContent>JSON exported!</TooltipContent>}
    </button>
  );
}
