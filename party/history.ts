import * as Y from "yjs";

/**
 * Past this many rows, the older half of the history is merged pairwise, so
 * old versions get coarser while recent edits stay individually restorable.
 */
export const HISTORY_LIMIT = 500;

/** Durable Object SQLite rows top out at 2 MB; history rows stay under 1 MiB. */
const MAX_ROW_BYTES = 1024 * 1024;

/**
 * Caps incoming messages and the server's pending structs. A stored update is
 * at most one message plus the pending structs it unblocks, so each gets half.
 */
export const MAX_UPDATE_BYTES = MAX_ROW_BYTES / 2;

export interface HistoryRow {
  clock: number;
  update: Uint8Array;
}

/** A calendar's Yjs updates, appended as they happen and compacted as it grows. */
export class History {
  readonly #storage: DurableObjectStorage;
  #length = 0;

  constructor(storage: DurableObjectStorage) {
    this.#storage = storage;
  }

  /**
   * Creates the table if needed, drops the unused `documents` and
   * `document_updates` tables, and returns every row, oldest first.
   */
  load(): HistoryRow[] {
    this.#storage.sql.exec(
      `DROP TABLE IF EXISTS documents;
       DROP TABLE IF EXISTS document_updates;
       CREATE TABLE IF NOT EXISTS history (clock INTEGER PRIMARY KEY, data BLOB NOT NULL)`,
    );
    const rows = this.rows();
    this.#length = rows.length;
    return rows;
  }

  /** Oldest first; `limit` of -1 reads everything. */
  rows(limit = -1): HistoryRow[] {
    return this.#storage.sql
      .exec<{ clock: number; data: ArrayBuffer }>(
        "SELECT clock, data FROM history ORDER BY clock LIMIT ?",
        limit,
      )
      .toArray()
      .map(({ clock, data }) => ({ clock, update: new Uint8Array(data) }));
  }

  /** Throws only if the update wasn't stored; compaction failures are logged. */
  append(update: Uint8Array) {
    this.#storage.sql.exec("INSERT INTO history (data) VALUES (?)", update);
    this.#length += 1;
    if (this.#length > HISTORY_LIMIT) this.#compact();
  }

  /** Merges the older half pairwise, skipping merges too large to store. */
  #compact() {
    const { sql } = this.#storage;
    try {
      this.#length -= this.#storage.transactionSync(() => {
        const older = this.rows(Math.floor(this.#length / 2));
        let merged = 0;
        for (let i = 0; i + 1 < older.length; i += 2) {
          const [first, second] = [older[i], older[i + 1]];
          const data = Y.mergeUpdates([first.update, second.update]);
          if (data.byteLength > MAX_ROW_BYTES) continue;
          sql.exec(
            "UPDATE history SET data = ? WHERE clock = ?",
            data,
            second.clock,
          );
          sql.exec("DELETE FROM history WHERE clock = ?", first.clock);
          merged += 1;
        }
        return merged;
      });
    } catch (error) {
      console.error("failed to compact history", error);
    }
  }
}
