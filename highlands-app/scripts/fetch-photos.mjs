// Downloads a photo for every POI into public/images/<slug>.jpg and records
// author/licence attribution into src/data/credits.json.
//
//   node scripts/fetch-photos.mjs            # fetch missing images
//   node scripts/fetch-photos.mjs --force    # re-fetch everything
//
// Source: Wikimedia Commons. For each POI we either use a verified filename
// or search the File namespace for a good landscape image. Commons' own
// thumbnail endpoint gives us a ~1200px JPEG, so no local image processing
// is required. Your own photos in public/images/mine/<slug>.jpg always win.
//
// NOTE: some sandboxes block wikimedia.org. Run this on an unrestricted
// network (your machine) or in CI (see .github/workflows) where it is reachable.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const IMG_DIR = path.join(ROOT, 'public', 'images')
const CREDITS = path.join(ROOT, 'src', 'data', 'credits.json')
const API = 'https://commons.wikimedia.org/w/api.php'
const UA = 'HighlandsAdventurePWA/1.0 (personal trip app; +https://github.com/phildrumsdaniel/cassidy-landform)'
const WIDTH = 1200
const FORCE = process.argv.includes('--force')

async function loadSources() {
  const mod = await import('../src/data/photo-sources.js')
  return mod.photoSources
}

async function api(paramsObj) {
  const params = new URLSearchParams({ format: 'json', formatversion: '2', ...paramsObj })
  const res = await fetch(`${API}?${params}`, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

function pickImageInfo(page) {
  const ii = page?.imageinfo?.[0]
  if (!ii) return null
  const ext = ii.extmetadata || {}
  return {
    title: page.title,
    thumburl: ii.thumburl || ii.url,
    width: ii.thumbwidth || ii.width,
    height: ii.thumbheight || ii.height,
    mime: ii.mime,
    artist: ext.Artist?.value || '',
    license: ext.LicenseShortName?.value || ext.License?.value || '',
    descriptionurl: ii.descriptionurl || ''
  }
}

async function resolveByFilename(filename) {
  const data = await api({
    action: 'query',
    titles: `File:${filename}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: String(WIDTH)
  })
  const page = data?.query?.pages?.[0]
  if (!page || page.missing) return null
  return pickImageInfo(page)
}

async function resolveBySearch(query) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: String(WIDTH)
  })
  const pages = data?.query?.pages || []
  const infos = pages.map(pickImageInfo).filter(Boolean).filter((i) => /jpeg|png/.test(i.mime))
  if (!infos.length) return null
  // Prefer landscape, reasonably large.
  infos.sort((a, b) => {
    const la = a.width >= a.height ? 1 : 0
    const lb = b.width >= b.height ? 1 : 0
    if (la !== lb) return lb - la
    return (b.width || 0) - (a.width || 0)
  })
  return infos[0]
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`download ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

async function exists(p) {
  try { await access(p); return true } catch { return false }
}

async function withRetry(fn, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try { return await fn() } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1000 * (i + 1))) }
  }
  throw last
}

async function main() {
  await mkdir(IMG_DIR, { recursive: true })
  const sources = await loadSources()
  const credits = []
  let ok = 0, skip = 0, fail = 0

  for (const s of sources) {
    const dest = path.join(IMG_DIR, `${s.slug}.jpg`)
    if (!FORCE && (await exists(dest))) {
      console.log(`· ${s.slug} — already present`)
      skip++
      // keep any existing credit for this slug if present
      continue
    }
    try {
      const info = await withRetry(async () => {
        let r = s.commons ? await resolveByFilename(s.commons) : null
        if (!r && s.query) r = await resolveBySearch(s.query)
        if (!r && s.commons) r = await resolveBySearch(s.name) // filename miss → search by name
        if (!r) throw new Error('no image found')
        return r
      })
      await withRetry(() => download(info.thumburl, dest))
      credits.push({
        slug: s.slug,
        name: s.name,
        title: info.title,
        artist: info.artist,
        license: info.license,
        descriptionurl: info.descriptionurl
      })
      console.log(`✓ ${s.slug} ← ${info.title} (${info.license || 'licence n/a'})`)
      ok++
    } catch (e) {
      console.warn(`✗ ${s.slug} — ${e.message} (placeholder will be used)`)
      fail++
    }
  }

  // Merge with any pre-existing credits so skipped-but-present images keep theirs.
  let prev = []
  try { prev = JSON.parse(await readFile(CREDITS, 'utf8')) } catch {}
  const bySlug = Object.fromEntries(prev.map((c) => [c.slug, c]))
  for (const c of credits) bySlug[c.slug] = c
  const merged = sources.map((s) => bySlug[s.slug]).filter(Boolean)
  await writeFile(CREDITS, JSON.stringify(merged, null, 2) + '\n')

  console.log(`\nDone: ${ok} downloaded, ${skip} already present, ${fail} failed. Credits: ${merged.length}.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
