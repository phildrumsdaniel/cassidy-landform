// Shrink big phone photos before upload: keeps the shared album inside the free
// storage tier and makes it load fast on patchy Highland signal. Falls back to
// the original file if anything goes wrong. Videos are left untouched.
//
// Memory matters here: uploading dozens of photos at once means decoding dozens
// of multi-megapixel images, which can exhaust mobile Safari. So we prefer
// createImageBitmap (decodes efficiently, and we close() it straight after) and
// free the canvas as soon as we're done, keeping the footprint per photo small.

async function drawToJpeg(file, max, quality) {
  let bitmap, url, src
  try {
    if (typeof createImageBitmap === 'function') {
      bitmap = await createImageBitmap(file)
      src = bitmap
    } else {
      url = URL.createObjectURL(file)
      src = await new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = url
      })
    }
    const big = Math.max(src.width, src.height) || 1
    const scale = Math.min(1, max / big)
    const w = Math.max(1, Math.round(src.width * scale))
    const h = Math.max(1, Math.round(src.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(src, 0, 0, w, h)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
    canvas.width = 0; canvas.height = 0 // release the backing store promptly
    return { blob, scaled: scale < 1 }
  } finally {
    if (bitmap) bitmap.close()
    if (url) URL.revokeObjectURL(url)
  }
}

// A small grid thumbnail (~480px). Always downscales so the album grid loads
// tiny files (tens of KB) even when the originals are multi-MB.
export async function makeThumb(file, max = 480, quality = 0.6) {
  if (!file || !(file.type || '').startsWith('image/')) return null
  try {
    const { blob } = await drawToJpeg(file, max, quality)
    return blob
  } catch {
    return null
  }
}

export async function compressImage(file, max = 1600, quality = 0.82) {
  if (!file || !(file.type || '').startsWith('image/')) return file
  if (file.size < 700 * 1024) return file // already small enough
  try {
    const { blob } = await drawToJpeg(file, max, quality)
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}
