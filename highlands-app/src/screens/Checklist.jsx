import { useNavigate } from 'react-router-dom'
import { useChecklist } from '../lib/storage.js'
import { Eyebrow } from '../components/ui.jsx'
import { IconCheck } from '../components/icons.jsx'

export default function Checklist({ storageKey, title, eyebrow, groups }) {
  const navigate = useNavigate()
  const [ticked, toggle, clear] = useChecklist(`checklist:${storageKey}`)

  const allItems = groups.flatMap((g) => g.items.map((it) => `${g.group}|${it}`))
  const doneCount = allItems.filter((id) => ticked[id]).length
  const pct = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0

  return (
    <>
      <header className="topbar">
        <button className="back" onClick={() => navigate('/')}>← Home</button>
        <div style={{ marginTop: 12 }}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="serif" style={{ fontSize: '1.8rem', marginTop: 4 }}>{title}</h1>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="progress-bar"><span style={{ width: `${pct}%` }} /></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', opacity: 0.9 }}>
            <span>{doneCount} of {allItems.length} done</span>
            {doneCount > 0 && (
              <button
                onClick={clear}
                style={{ background: 'none', border: 'none', color: 'var(--whisky-soft)', font: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="container">
        {groups.map((g) => (
          <div className="check-group" key={g.group}>
            <div className="section-title" style={{ margin: '10px 0 10px' }}>
              <span className="diamond" /><h2 style={{ fontSize: '1.1rem' }}>{g.group}</h2>
            </div>
            {g.items.map((it) => {
              const id = `${g.group}|${it}`
              const on = !!ticked[id]
              return (
                <div className={`check-item${on ? ' on' : ''}`} key={id} onClick={() => toggle(id)}>
                  <span className="box">{on && <IconCheck />}</span>
                  <span className="txt">{it}</span>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
