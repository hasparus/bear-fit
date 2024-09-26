import React, { createContext, useContext } from "react";
import { Doc } from "yjs";

export const YDocContext = createContext<Doc | null>(null);

export const useYDoc = (): Doc => {
  const context = useContext(YDocContext);
  if (context === null) {
    throw new Error("useYDoc must be used within a YDocProvider");
  }
  return context;
};
