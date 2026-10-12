import * as Y from "yjs";

import { appendHistory, createHistoryTable, readHistory } from "./history";

/**
 * Folds the earlier layout into `history`: a `documents (id, state)` snapshot
 * and a `document_updates (doc_id, clock, update_data)` log. Existing history
 * is replayed first, then the log in order, then the snapshot, and only what's
 * new to the document is appended, so reruns add nothing and edits written by
 * an older deployment are picked up. The old tables are left in place.
 *
 * Undecodable rows are skipped. Updates still missing their dependencies after
 * the snapshot is applied were never visible in the snapshot either, so they're
 * left behind. It throws, rolling back, when there's a gap and no snapshot
 * decoded, or when there's no history and no legacy row is usable.
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

    createHistoryTable(sql);
    const doc = new Y.Doc();
    const history = readHistory(sql);
    for (const { update } of history) Y.applyUpdate(doc, update);

    const newUpdates: Uint8Array[] = [];
    doc.on("update", (update: Uint8Array) => newUpdates.push(update));

    const read = (table: string, query: string) =>
      legacyTables.includes(table)
        ? sql.exec<{ data: ArrayBuffer }>(query).toArray()
        : [];
    const apply = (rows: { data: ArrayBuffer }[]) => {
      let applied = 0;
      for (const row of rows) {
        try {
          Y.applyUpdate(doc, new Uint8Array(row.data));
          applied += 1;
        } catch (error) {
          console.warn("skipping undecodable legacy row", error);
        }
      }
      return applied;
    };

    const log = read(
      "document_updates",
      "SELECT update_data AS data FROM document_updates ORDER BY clock",
    );
    const snapshot = read("documents", "SELECT state AS data FROM documents");
    const appliedLog = apply(log);
    const appliedSnapshot = apply(snapshot);

    if (doc.store.pendingStructs || doc.store.pendingDs) {
      if (appliedSnapshot === 0) {
        throw new Error("legacy data has gaps the snapshot can't fill");
      }
      console.warn(
        "legacy data has updates missing their dependencies; the snapshot never showed them either, so they stay only in the legacy tables",
      );
    }
    if (
      history.length === 0 &&
      log.length + snapshot.length > 0 &&
      appliedLog + appliedSnapshot === 0
    ) {
      throw new Error("no usable legacy log or snapshot");
    }

    for (const update of newUpdates) appendHistory(sql, update);
  });
}
