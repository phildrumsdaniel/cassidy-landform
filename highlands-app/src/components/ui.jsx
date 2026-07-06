// Small shared presentational bits.

export function Diamond() {
  return <span className="diamond" aria-hidden="true" />
}

export function DayPlate({ n, label = 'Day' }) {
  return (
    <div className="dayplate">
      <span className="k">{label}</span>
      <span className="num">{n}</span>
    </div>
  )
}

export function Eyebrow({ children }) {
  return <div className="eyebrow">{children}</div>
}

export function Ribbon({ drive, distance, overnight }) {
  return (
    <div className="ribbon">
      <div className="cell">
        <span className="k label">Drive</span>
        <span className="v">{drive}</span>
      </div>
      <div className="cell">
        <span className="k label">Distance</span>
        <span className="v">{distance}</span>
      </div>
      <div className="cell">
        <span className="k label">Overnight</span>
        <span className="v">{overnight}</span>
      </div>
    </div>
  )
}

export function BaseRibbon({ miles, drive, nights }) {
  return (
    <div className="ribbon">
      <div className="cell">
        <span className="k label">Drive in</span>
        <span className="v">{drive}</span>
      </div>
      <div className="cell">
        <span className="k label">Miles</span>
        <span className="v">{miles}</span>
      </div>
      <div className="cell">
        <span className="k label">Nights</span>
        <span className="v">{nights === 0 ? '—' : nights}</span>
      </div>
    </div>
  )
}

export function Note({ children, title = 'Good to know' }) {
  return (
    <div className="note">
      <span className="diamond" aria-hidden="true" />
      <div>
        <span className="k label">{title}</span>
        <p>{children}</p>
      </div>
    </div>
  )
}

export function SectionTitle({ eyebrow, children }) {
  return (
    <div className="section-title" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2>{children}</h2>
    </div>
  )
}
