import { DownloadIcon } from "@radix-ui/react-icons";
import React, { useState } from "react";

import { yDocToJson } from "../shared-data";
import { useYDoc } from "../useYDoc";
import { cn } from "./cn";
import { TooltipContent } from "./TooltipContent";

interface ExportEventJsonProps extends React.HTMLAttributes<HTMLButtonElement> {
  eventName: string;
}

export function ExportEventJson({
  className,
  eventName,
  ...rest
}: ExportEventJsonProps) {
  const yDoc = useYDoc();
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <button
      className={cn(
        "relative flex p-2 bg-neu-tral-100 hover:bg-neutral-200 cursor-pointer items-center justify-center rounded-md active:bg-black active:text-white group-hover:bg-neutral-200",
        className
      )}
      onClick={() => {
        setShowTooltip(true);

        const data = yDocToJson(yDoc);
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

        setTimeout(() => setShowTooltip(false), 2000);
      }}
      title="Export to JSON"
      type="button"
      {...rest}
    >
      <DownloadIcon />
      {showTooltip && <TooltipContent>JSON exported!</TooltipContent>}
    </button>
  );
}
