export const SLIDE_WIDTH = 360
export const SLIDE_HEIGHT = 640

/** 1080 x 1920, the size of a story. */
export async function slideToFile(node: HTMLElement, name: string): Promise<File> {
  // Only needed when someone actually exports, so it stays out of the main bundle.
  const { toBlob } = await import('html-to-image')
  const blob = await toBlob(node, { pixelRatio: 3, width: SLIDE_WIDTH, height: SLIDE_HEIGHT, backgroundColor: '#000000' })
  if (!blob) throw new Error('The slide could not be exported')
  return new File([blob], name, { type: 'image/png' })
}

/** The share sheet where there is one, otherwise a download. True unless the user backed out. */
export async function shareFile(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return true
    } catch (error) {
      if ((error as Error).name === 'AbortError') return false
      // Some browsers refuse files after all, so a download still helps.
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

export function wrappedUrl(username: string, period: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}wrapped/${username}/${period}`
}
