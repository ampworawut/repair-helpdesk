/**
 * Server-side image compression using sharp.
 * Resizes to max 1920px, compresses to JPEG ~200KB.
 */

import sharp from 'sharp'

const MAX_DIMENSION = 1920
const MAX_SIZE_BYTES = 200 * 1024

export async function compressImageServer(buffer: Buffer, contentType?: string): Promise<Buffer> {
  try {
    let pipeline = sharp(buffer)

    // Resize if needed
    const metadata = await pipeline.metadata()
    if (metadata.width && metadata.height) {
      const maxDim = Math.max(metadata.width, metadata.height)
      if (maxDim > MAX_DIMENSION) {
        const ratio = MAX_DIMENSION / maxDim
        pipeline = pipeline.resize({
          width: Math.round(metadata.width * ratio),
          height: Math.round(metadata.height * ratio),
          fit: 'inside',
        })
      }
    }

    // Convert to JPEG with quality targeting ~200KB
    let quality = 70
    let result = await pipeline.jpeg({ quality }).toBuffer()

    // Reduce quality if still too large
    while (result.length > MAX_SIZE_BYTES && quality > 30) {
      quality -= 10
      result = await sharp(buffer)
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside' })
        .jpeg({ quality })
        .toBuffer()
    }

    return result
  } catch {
    return buffer // Return original on error
  }
}
