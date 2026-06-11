import type YPartyKitProvider from "y-partykit/provider";

import { createContext, useContext } from "react";
import { Doc } from "yjs";

export const YDocContext = createContext<Doc | null>(null);

export const useYDoc = (): Doc => {
  const context = useContext(YDocContext);
  if (context === null) {
    throw new Error("useYDoc must be used within a YDocProvider");
  }
  return context;
};

/**
 * The room's live Yjs provider (the websocket connection, not the doc).
 * Unlike YDocContext, this is never re-provided — EventHistory swaps in
 * historical snapshot docs, but there is only ever one live connection.
 */
export const YProviderContext = createContext<YPartyKitProvider | null>(null);
