/** A small stable number from a string, so that each event keeps its own look. */
export function hashOf(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * The background of an event flyer: a red and a blue glow at positions that depend on the event.
 * Red and blue together is the brand moment the design system reserves for this kind of thing.
 */
export function posterLayers(eventId: string): string {
  const hash = hashOf(eventId)
  const redX = 10 + (hash % 50)
  const redY = 10 + ((hash >>> 6) % 60)
  const blueX = 50 + ((hash >>> 12) % 45)
  const blueY = 30 + ((hash >>> 18) % 65)
  const size = 55 + ((hash >>> 24) % 30)
  return [
    `radial-gradient(circle at ${redX}% ${redY}%, color-mix(in srgb, var(--gst-red) 55%, transparent), transparent ${size}%)`,
    `radial-gradient(circle at ${blueX}% ${blueY}%, color-mix(in srgb, var(--gst-blue) 60%, transparent), transparent ${size}%)`,
    'linear-gradient(to top, color-mix(in srgb, var(--gst-bg) 70%, transparent), transparent 70%)',
  ].join(', ')
}
