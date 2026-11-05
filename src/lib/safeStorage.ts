// Storage can throw or come back empty in private windows. Everything kept here is a
// convenience that the app can live without.
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Nothing to do: see above.
  }
}

export function removeStored(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing to do: see above.
  }
}
