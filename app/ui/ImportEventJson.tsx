import React, { type RefObject, useMemo, useRef, useState } from "react";

import { useYDoc } from "../useYDoc";
import { cn } from "./cn";
import { overwriteYDocWithJson } from "./overwriteYDocWithJson";
import { TooltipContent } from "./TooltipContent";
import { UploadIcon } from "./UploadIcon";

export interface ImportEventJsonProps
  extends Omit<React.HTMLAttributes<HTMLLabelElement>, "children"> {
  children?:
    | ((input: RefObject<HTMLInputElement | null>) => React.ReactNode)
    | React.ReactNode;
}

export function ImportEventJson({
  children,
  className,
  ...rest
}: ImportEventJsonProps) {
  const {
    hiddenInputElement: inputElement,
    fileInputRef,
    showTooltip,
    tooltipMessage,
  } = useImportEventJson();

  return (
    <>
      {inputElement}
      {typeof children === "function" ? (
        children(fileInputRef)
      ) : (
        <>
          <label
            htmlFor="import-json"
            title="Import from JSON"
            className={cn(
              "relative flex p-1 bg-neu-tral-100 hover:bg-neutral-100 cursor-pointer items-center justify-center rounded-sm active:bg-black active:text-white",
              className,
            )}
            {...rest}
          >
            <UploadIcon className="size-5" />
            {showTooltip && <TooltipContent>{tooltipMessage}</TooltipContent>}
          </label>
        </>
      )}
    </>
  );
}

export function useImportEventJson() {
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

        overwriteYDocWithJson(yDoc, parsedJson);

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

  return useMemo(() => {
    return {
      hiddenInputElement: (
        <input
          id="import-json"
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
          ref={fileInputRef}
        />
      ),
      fileInputRef,
      showTooltip,
      tooltipMessage,
      openFileDialog: () => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      },
    };
  }, [tooltipMessage]);
}
