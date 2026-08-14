import type { Doc } from "yjs";

import React, { useState } from "react";

import { getCalendarMap, yDocToJson } from "../shared-data";
import { cn } from "./cn";
import { DownloadIcon } from "./DownloadIcon";
import { TooltipContent } from "./TooltipContent";

export function exportCalendarJson(yDoc: Doc) {
  const data = yDocToJson(yDoc);
  const calendarMap = getCalendarMap(yDoc);
  const calendarName = calendarMap.get("name");

  if (!calendarName) {
    throw new Error("No calendar name provided");
  }

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${calendarName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ExportCalendarJsonProps extends React.HTMLAttributes<HTMLButtonElement> {
  yDoc: Doc;
}

export function ExportCalendarJson({
  className,
  yDoc,
  ...rest
}: ExportCalendarJsonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <button
      type="button"
      title="Export to JSON"
      className={cn(
        "relative flex p-1 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-sm active:bg-black active:text-white",
        className,
      )}
      onClick={() => {
        setShowTooltip(true);
        exportCalendarJson(yDoc);
        setTimeout(() => setShowTooltip(false), 2000);
      }}
      {...rest}
    >
      <DownloadIcon className="size-5" />
      {showTooltip && <TooltipContent>JSON exported!</TooltipContent>}
    </button>
  );
}
