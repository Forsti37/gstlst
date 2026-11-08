import Dexie, { type EntityTable } from 'dexie'
import type { QueuedAction } from '../features/offline/actions'

export interface QueuedOp {
  seq?: number
  batchId: string
  userId: string
  action: QueuedAction
  status: 'queued' | 'failed'
  error?: string
  /** Server errors so far. A few in a row mean it is not the reception, so the op stops retrying. */
  serverErrors?: number
  createdAt: number
}

export interface KeyValue {
  key: string
  value: string
}

/** Writes waiting to be sent, and the cached reads that let the app open at a rave without reception. */
export const offlineDb = new Dexie('gstlst') as Dexie & {
  ops: EntityTable<QueuedOp, 'seq'>
  kv: EntityTable<KeyValue, 'key'>
}

offlineDb.version(1).stores({
  ops: '++seq, batchId, userId, status',
  kv: 'key',
})
