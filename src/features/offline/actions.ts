import type { Database } from '../../lib/database.types'

export type TableName = keyof Database['public']['Tables']
type Row = Record<string, unknown>

/** One write for the queue. All of them can safely be sent twice. */
export type QueuedAction =
  | { kind: 'insert'; table: TableName; row: Row; onConflict: string }
  | { kind: 'replace'; table: TableName; row: Row; onConflict: string }
  | { kind: 'update'; table: TableName; match: Row; changes: Row }
  | { kind: 'delete'; table: TableName; match: Row }
  | { kind: 'upload'; path: string; blob: Blob }
  | { kind: 'removeFile'; path: string }
  | { kind: 'gps'; checkinId: string; lat: number; lng: number; capturedAt: string }

export const insert = (table: TableName, row: Row, onConflict = 'id'): QueuedAction => ({ kind: 'insert', table, row, onConflict })
