import * as Y from "yjs";

import { appendHistory, readHistory } from "./history";

/**
 * Folds the earlier layout into `history`: a `documents (id, state)` snapshot
 * and a `document_updates (doc_id, clock, update_data)` log. Existing history
 * is replayed first, then the log in order, then the snapshot, and only what's
 * new to the document is appended, so reruns add nothing and edits written by
 * an older deployment are picked up. The old tables are left in place.
 *
 * Undecodable rows are skipped. It throws, rolling back, when the result would
 * have gaps (part of the log is unreadable and the snapshot can't fill it) or
 * when there's no history and no legacy row is usable.
 */
export function migrateLegacyStorage(storage: DurableObjectStorage) {
  storage.transactionSync(() => {
    const { sql } = storage;
    const legacyTables = sql
      .exec<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('document_updates', 'documents')",
      )
      .toArray()
      .map((row) => row.name);
    if (legacyTables.length === 0) return;

    const doc = new Y.Doc();
    const history = readHistory(sql);
    for (const { update } of history) Y.applyUpdate(doc, update);

    const newUpdates: Uint8Array[] = [];
    doc.on("update", (update: Uint8Array) => newUpdates.push(update));

    const legacyRows = [
      ...(legacyTables.includes("document_updates")
        ? sql
            .exec<{
              data: ArrayBuffer;
            }>(
              "SELECT update_data AS data FROM document_updates ORDER BY clock",
            )
            .toArray()
        : []),
      ...(legacyTables.includes("documents")
        ? sql
            .exec<{ data: ArrayBuffer }>("SELECT state AS data FROM documents")
            .toArray()
        : []),
    ];

    let applied = 0;
    for (const row of legacyRows) {
      try {
        Y.applyUpdate(doc, new Uint8Array(row.data));
        applied += 1;
      } catch (error) {
        console.warn("skipping undecodable legacy row", error);
      }
    }

    if (doc.store.pendingStructs || doc.store.pendingDs) {
      throw new Error("legacy data has gaps the snapshot can't fill");
    }
    if (history.length === 0 && legacyRows.length > 0 && applied === 0) {
      throw new Error("no usable legacy log or snapshot");
    }

    for (const update of newUpdates) appendHistory(sql, update);
  });
}
