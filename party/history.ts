export interface HistoryRow {
  clock: number;
  update: Uint8Array;
}

export function createHistoryTable(sql: SqlStorage) {
  sql.exec(
    "CREATE TABLE IF NOT EXISTS history (clock INTEGER PRIMARY KEY, data BLOB NOT NULL)",
  );
}

/** Oldest first; `limit` of -1 reads everything. */
export function readHistory(sql: SqlStorage, limit = -1): HistoryRow[] {
  return sql
    .exec<{ clock: number; data: ArrayBuffer }>(
      "SELECT clock, data FROM history ORDER BY clock LIMIT ?",
      limit,
    )
    .toArray()
    .map(({ clock, data }) => ({ clock, update: new Uint8Array(data) }));
}

export function appendHistory(sql: SqlStorage, update: Uint8Array) {
  sql.exec("INSERT INTO history (data) VALUES (?)", update);
}
