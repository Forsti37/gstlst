import imageCompression from 'browser-image-compression'

/**
 * Re-encoding through a canvas drops EXIF and GPS data. No web worker, because the library
 * would load its worker script from a CDN.
 */
export function compressPhoto(file: File, maxWidthOrHeight: number, maxSizeMB: number): Promise<Blob> {
  return imageCompression(file, {
    maxSizeMB,
    maxWidthOrHeight,
    fileType: 'image/webp',
    useWebWorker: false,
    preserveExif: false,
  })
}
