import type { SupabaseClient } from '@supabase/supabase-js'
import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDb, type QueuedOp } from '../../lib/offlineDb'
import { queryClient } from '../../lib/queryClient'
import { getSupabase } from '../../lib/supabase'
import type { QueuedAction } from './actions'

export const MEDIA_BUCKET = 'media'

/** Stop for now and try again later, as opposed to a rejection that won't change on a retry. */
class TemporaryError extends Error {
  constructor(message: string, readonly fromServer = false) {
    super(message)
  }
}

/** A server error that keeps coming back is a bug, not bad reception, and must not block the queue forever. */
const MAX_SERVER_ERRORS = 3

function check(result: { error: { message: string } | null; status?: number }) {
  if (!result.error) return
  const status = result.status ?? 0
  if (navigator.onLine && status >= 500) throw new TemporaryError(result.error.message, true)
  const looksOffline = !navigator.onLine || status === 0 || status === 401 || status === 408 || status === 429
  if (looksOffline || /fetch|network/i.test(result.error.message)) throw new TemporaryError(result.error.message)
  throw new Error(result.error.message)
}

async function send(action: QueuedAction) {
  const client = getSupabase() as unknown as SupabaseClient
  switch (action.kind) {
    case 'insert':
      check(await client.from(action.table).upsert(action.row, { onConflict: action.onConflict, ignoreDuplicates: true }))
      return
    case 'replace':
      check(await client.from(action.table).upsert(action.row, { onConflict: action.onConflict }))
      return
    case 'update':
      check(await client.from(action.table).update(action.changes).match(action.match))
      return
    case 'delete':
      check(await client.from(action.table).delete().match(action.match))
      return
    case 'upload': {
      const { error } = await client.storage.from(MEDIA_BUCKET).upload(action.path, action.blob, { contentType: 'image/webp' })
      if (!error) return
      // Already there: an earlier attempt got through, but its answer didn't.
      if ('statusCode' in error && String(error.statusCode) === '409') return
      if (/already exists|duplicate/i.test(error.message)) return
      check({ error, status: 'statusCode' in error ? Number(error.statusCode) : 0 })
      return
    }
    case 'removeFile': {
      const { error } = await client.storage.from(MEDIA_BUCKET).remove([action.path])
      if (error) check({ error, status: 'statusCode' in error ? Number(error.statusCode) : 0 })
      return
    }
    case 'rpc': {
      const result = await client.rpc(action.fn, action.args)
      if (!action.optional) check(result)
      return
    }
    case 'gps': {
      // A check-in without verification is still a check-in, so only connection problems count.
      // The coordinates leave this device only here and disappear with the op afterwards.
      const result = await client.rpc('verify_checkin_gps', {
        checkin_id: action.checkinId,
        lat: action.lat,
        lng: action.lng,
        captured_at: action.capturedAt,
      })
      if (result.error) {
        try {
          check(result)
        } catch (error) {
          if (error instanceof TemporaryError) throw error
        }
      }
    }
  }
}

let running: Promise<void> | null = null

async function drain() {
  const { data } = await getSupabase().auth.getSession()
  const userId = data.session?.user.id
  if (!userId) return

  let sent = 0
  const blockedBatches = new Set<string>()
  try {
    const ops = await offlineDb.ops.where('userId').equals(userId).sortBy('seq')
    for (const op of ops) {
      if (op.status === 'failed') blockedBatches.add(op.batchId)
      if (blockedBatches.has(op.batchId)) continue
      try {
        await send(op.action)
        await offlineDb.ops.delete(op.seq!)
        sent += 1
      } catch (error) {
        if (error instanceof TemporaryError) {
          const serverErrors = (op.serverErrors ?? 0) + (error.fromServer ? 1 : 0)
          if (serverErrors < MAX_SERVER_ERRORS) {
            if (error.fromServer) await offlineDb.ops.update(op.seq!, { serverErrors })
            return
          }
        }
        // The rest of a batch builds on this op, so it has to wait for a decision too.
        blockedBatches.add(op.batchId)
        await offlineDb.ops.where('batchId').equals(op.batchId).modify({ status: 'failed' })
        await offlineDb.ops.update(op.seq!, { error: (error as Error).message })
      }
    }
  } finally {
    if (sent > 0) void queryClient.invalidateQueries()
  }
}

/** Safe to call at any time. Runs overlap into one pass. */
export function syncQueue(): Promise<void> {
  running ??= drain().finally(() => {
    running = null
  })
  return running
}

const CHECKIN_TABLES = new Set(['event_checkins', 'set_checkins', 'set_checkin_genres', 'set_checkin_tags'])

/** Writes always go through here, online too, so that there is only one way to save. */
export async function enqueue(userId: string, actions: QueuedAction[]) {
  const batchId = crypto.randomUUID()
  const createdAt = Date.now()
  // Last in the batch, so that new badges and fun facts are ready when it has gone through.
  const changesCheckins = actions.some((action) => 'table' in action && CHECKIN_TABLES.has(action.table))
  const all: QueuedAction[] = changesCheckins ? [...actions, { kind: 'rpc', fn: 'evaluate_my_badges', args: {}, optional: true }] : actions
  const ops: QueuedOp[] = all.map((action) => ({ batchId, userId, action, status: 'queued', createdAt }))
  await offlineDb.ops.bulkAdd(ops)
  void syncQueue()
  return batchId
}

export async function retryFailed(userId: string) {
  await offlineDb.ops.where({ userId, status: 'failed' }).modify({ status: 'queued', error: undefined })
  await syncQueue()
}

export async function discardFailed(userId: string) {
  await offlineDb.ops.where({ userId, status: 'failed' }).delete()
}

export async function clearQueue(userId: string) {
  await offlineDb.ops.where('userId').equals(userId).delete()
}

export function useQueueStatus(userId: string | undefined) {
  return useLiveQuery(async () => {
    if (!userId) return { waiting: 0, failed: 0, error: undefined }
    const ops = await offlineDb.ops.where('userId').equals(userId).toArray()
    return {
      waiting: new Set(ops.filter((op) => op.status === 'queued').map((op) => op.batchId)).size,
      failed: new Set(ops.filter((op) => op.status === 'failed').map((op) => op.batchId)).size,
      error: ops.find((op) => op.error)?.error,
    }
  }, [userId]) ?? { waiting: 0, failed: 0, error: undefined }
}

/** A check-in still in the queue, for finding it again before it has reached the server. */
export async function queuedCheckinFor(userId: string, eventId: string): Promise<string | null> {
  const ops = await offlineDb.ops.where('userId').equals(userId).toArray()
  for (const { action } of ops) {
    if (action.kind === 'insert' && action.table === 'event_checkins' && action.row.event_id === eventId) {
      return action.row.id as string
    }
  }
  return null
}

let started = false

/** Syncs on app start and whenever the connection returns. iOS has no Background Sync. */
export function startQueueSync() {
  if (started) return
  started = true
  window.addEventListener('online', () => void syncQueue())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncQueue()
  })
  void syncQueue()
}
