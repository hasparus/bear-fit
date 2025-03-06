import { UploadIcon } from "@radix-ui/react-icons";
import React, { useRef, useState } from "react";
import * as v from "valibot";

import { getUserId } from "../getUserId";
import { AvailabilityKey, type UserId } from "../schemas";
import { YDocJsonSchema } from "../shared-data";
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
    reader.onload = () => {
      try {
        if (typeof reader.result !== "string") {
          throw new Error("Failed to read file");
        }

        const parsedJson = JSON.parse(reader.result);
        const jsonData = v.parse(YDocJsonSchema, parsedJson);

        const currentUserId = getUserId();

        const namesMap = yDoc.getMap("names");

        const currentUserName =
          namesMap.get(currentUserId) || localStorage.getItem("userName");

        const sameNameUserIds: UserId[] = [];
        Object.entries(jsonData.names).forEach(([id, name]) => {
          if (name === currentUserName && id !== currentUserId) {
            sameNameUserIds.push(id as UserId);
          }
        });

        const availabilityMap = yDoc.getMap("availability");

        const keysToDelete: string[] = [];
        availabilityMap.forEach((_value, key) => {
          if (key.startsWith(currentUserId)) {
            keysToDelete.push(key);
          }

          for (const sameNameId of sameNameUserIds) {
            if (key.startsWith(sameNameId)) {
              keysToDelete.push(key);
              break;
            }
          }
        });

        keysToDelete.forEach((key) => {
          availabilityMap.delete(key);
        });

        Object.entries(jsonData.availability).forEach(([key, value]) => {
          try {
            const belongsToSameNameUser = sameNameUserIds.some((userId) =>
              key.startsWith(userId),
            );

            if (belongsToSameNameUser) {
              const { date } = AvailabilityKey.parseToObject(key);
              const newKey = AvailabilityKey(currentUserId, date);
              availabilityMap.set(newKey, value);
            } else {
              availabilityMap.set(key, value);
            }
          } catch (e) {
            availabilityMap.set(key, value);
          }
        });

        const eventMap = yDoc.getMap("event");
        Object.entries(jsonData.event).forEach(([key, value]) => {
          if (key === "creator") {
            return;
          }
          eventMap.set(key, value);
        });

        Object.entries(jsonData.names).forEach(([key, value]) => {
          if (!sameNameUserIds.includes(key as UserId)) {
            namesMap.set(key, value);
          }
        });

        namesMap.set(currentUserId, currentUserName);

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
