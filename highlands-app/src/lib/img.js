// Shrink big phone photos before upload: keeps the shared album inside the free
// storage tier and makes it load fast on patchy Highland signal. Falls back to
// the original file if anything goes wrong. Videos are left untouched.

export async function compressImage(file, max = 1600, quality = 0.82) {
  if (!file || !(file.type || '').startsWith('image/')) return file
  let url
  try {
    url = URL.createObjectURL(file)
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const big = Math.max(img.width, img.height)
    const scale = Math.min(1, max / big)
    if (scale >= 1 && file.size < 700 * 1024) return file // already small
    const w = Math.round(img.width * scale)
    const h = Math.round(img.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  } finally {
    if (url) URL.revokeObjectURL(url)
  }
}
