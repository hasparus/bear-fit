import { UploadIcon } from "@radix-ui/react-icons";
import React, { useRef, useState } from "react";

import { useYDoc } from "../useYDoc";
import { cn } from "./cn";
import { TooltipContent } from "./TooltipContent";

interface ImportEventJsonProps extends React.HTMLAttributes<HTMLLabelElement> {}

export function ImportEventJson({ className, ...rest }: ImportEventJsonProps) {
  const yDoc = useYDoc();
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);

        // Validate the JSON structure
        if (!jsonData.event || !jsonData.availability || !jsonData.names) {
          throw new Error("Invalid JSON format");
        }

        // Import event data
        const eventMap = yDoc.getMap("event");
        Object.entries(jsonData.event).forEach(([key, value]) => {
          eventMap.set(key, value);
        });

        // Import availability data
        const availabilityMap = yDoc.getMap("availability");
        Object.entries(jsonData.availability).forEach(([key, value]) => {
          availabilityMap.set(key, value);
        });

        // Import names data
        const namesMap = yDoc.getMap("names");
        Object.entries(jsonData.names).forEach(([key, value]) => {
          namesMap.set(key, value as string);
        });

        setTooltipMessage("JSON imported successfully!");
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
      } catch (error) {
        setTooltipMessage("Error importing JSON");
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 2000);
        console.error("Error importing JSON:", error);
      }
    };

    reader.readAsText(file);
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        accept=".json"
        className="hidden"
        id="import-json"
        onChange={handleImport}
        ref={fileInputRef}
        type="file"
      />
      <label
        className={cn(
          "relative flex p-2 bg-neu-tral-100 hover:bg-neutral-200 cursor-pointer items-center justify-center rounded-md active:bg-black active:text-white group-hover:bg-neutral-200",
          className,
        )}
        htmlFor="import-json"
        title="Import from JSON"
        {...rest}
      >
        <UploadIcon />
        {showTooltip && <TooltipContent>{tooltipMessage}</TooltipContent>}
      </label>
    </>
  );
}
