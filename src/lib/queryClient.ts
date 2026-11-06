import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { offlineDb } from './offlineDb'

const WEEK = 7 * 24 * 60 * 60 * 1000

export const PERSIST_MAX_AGE = WEEK

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: WEEK,
      retry: 1,
      networkMode: 'offlineFirst', // serve the cache first: reception at raves is unreliable
    },
  },
})

/** Queries with `meta: { persist: true }` survive a restart without reception. */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => (await offlineDb.kv.get(key))?.value ?? null,
    setItem: async (key, value) => {
      await offlineDb.kv.put({ key, value })
    },
    removeItem: async (key) => {
      await offlineDb.kv.delete(key)
    },
  },
})
