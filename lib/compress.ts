/**
 * Client-side image compression using Canvas API.
 * Resizes to max 1920px on longest side, compresses to JPEG ~200KB.
 */

const MAX_DIMENSION = 1920
const MAX_SIZE_BYTES = 200 * 1024 // 200KB target
const INITIAL_QUALITY = 0.7

export async function compressImage(file: File): Promise<File> {
  // Skip non-image files
  if (!file.type.startsWith('image/')) return file

  // Skip already small files
  if (file.size <= MAX_SIZE_BYTES) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img
      // Scale down if larger than max dimension
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      // Try compressing with decreasing quality until under target size
      function tryQuality(quality: number) {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return }

            if (blob.size <= MAX_SIZE_BYTES || quality <= 0.3) {
              const compressed = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now(),
              })
              resolve(compressed)
            } else {
              tryQuality(quality - 0.1)
            }
          },
          'image/jpeg',
          quality
        )
      }

      tryQuality(INITIAL_QUALITY)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // Return original on error
    }

    img.src = url
  })
}

/**
 * Compress multiple files in parallel.
 */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage))
}
