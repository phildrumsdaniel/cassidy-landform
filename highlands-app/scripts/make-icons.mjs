// Generates PWA/app icons with no native dependencies: a loch-teal tile with
// a whisky-gold diamond, matching the brand. Writes:
//   public/icons/icon-192.png, icon-512.png, public/apple-touch-icon.png
//   public/favicon.svg
// Pure-JS RGBA → PNG (zlib) encoder so it runs anywhere, offline.

import { writeFile, mkdir } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const LOCH_DEEP = hex('#0d232b')
const LOCH = hex('#14343f')
const GOLD = hex('#c8912f')
const GOLD_SOFT = hex('#e6c987')

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const t = Buffer.from(type, 'ascii')
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit, RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function draw(size) {
  const buf = Buffer.alloc(size * size * 4)
  const c = size / 2
  const R = size * 0.34            // diamond half-extent
  const border = size * 0.055
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = x + 0.5, ny = y + 0.5
      // vertical gradient background
      const t = y / size
      let col = [
        Math.round(LOCH_DEEP[0] + (LOCH[0] - LOCH_DEEP[0]) * t),
        Math.round(LOCH_DEEP[1] + (LOCH[1] - LOCH_DEEP[1]) * t),
        Math.round(LOCH_DEEP[2] + (LOCH[2] - LOCH_DEEP[2]) * t)
      ]
      // inset gold frame
      if (nx > border && nx < size - border && ny > border && ny < size - border) {
        const fw = size * 0.012
        if (nx < border + fw || nx > size - border - fw || ny < border + fw || ny > size - border - fw) {
          col = GOLD_SOFT
        }
      }
      // gold diamond (|dx|+|dy| <= R)
      const d = Math.abs(nx - c) + Math.abs(ny - c)
      if (d <= R) col = GOLD
      else if (d <= R + size * 0.02) col = GOLD_SOFT // soft edge
      const i = (y * size + x) * 4
      buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255
    }
  }
  return buf
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0d232b"/><stop offset="1" stop-color="#14343f"/>
  </linearGradient></defs>
  <rect width="64" height="64" rx="12" fill="url(#g)"/>
  <rect x="5" y="5" width="54" height="54" rx="9" fill="none" stroke="#e6c987" stroke-width="1.5"/>
  <path d="M32 12 L52 32 L32 52 L12 32 Z" fill="#c8912f"/>
</svg>
`

await mkdir(path.join(ROOT, 'public', 'icons'), { recursive: true })
for (const s of [192, 512]) {
  await writeFile(path.join(ROOT, 'public', 'icons', `icon-${s}.png`), encodePNG(s, draw(s)))
  console.log(`Wrote public/icons/icon-${s}.png`)
}
await writeFile(path.join(ROOT, 'public', 'apple-touch-icon.png'), encodePNG(180, draw(180)))
await writeFile(path.join(ROOT, 'public', 'favicon.svg'), favicon)
console.log('Wrote apple-touch-icon.png and favicon.svg')
