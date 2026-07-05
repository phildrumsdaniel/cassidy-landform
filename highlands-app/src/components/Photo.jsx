import { useState } from 'react'

const base = import.meta.env.BASE_URL

// Resolution order for every POI image:
//   1. our own photo   public/images/mine/<slug>.jpg
//   2. downloaded Commons photo  public/images/<slug>.jpg (or .jpeg)
//   3. tasteful parchment placeholder (never looks broken, works offline)
function candidates(slug) {
  return [
    `${base}images/mine/${slug}.jpg`,
    `${base}images/mine/${slug}.jpeg`,
    `${base}images/${slug}.jpg`,
    `${base}images/${slug}.jpeg`
  ]
}

export function Placeholder({ name, minimal = false }) {
  return (
    <div className="placeholder" role="img" aria-label={name}>
      <div className="ph-inner">
        <div className="ph-diamond" />
        {!minimal && <div className="ph-name serif">{name}</div>}
        {!minimal && <div className="ph-sub">Highlands Adventure</div>}
      </div>
    </div>
  )
}

export default function Photo({ slug, name, className = '', eager = false, minimal = false }) {
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const srcs = candidates(slug)

  if (failed || !slug) {
    return (
      <div className={className}>
        <Placeholder name={name} minimal={minimal} />
      </div>
    )
  }

  return (
    <img
      className={className}
      src={srcs[idx]}
      alt={name}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => (idx < srcs.length - 1 ? setIdx(idx + 1) : setFailed(true))}
    />
  )
}
