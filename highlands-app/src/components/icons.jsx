// Inline stroke icons (no external assets → works offline, themeable).
const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconHome = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
)
export const IconMap = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M9 4l6 2 6-2v14l-6 2-6-2-6 2V6z" /><path d="M9 4v14M15 6v14" /></svg>
)
export const IconList = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M8 6h12M8 12h12M8 18h12" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>
)
export const IconCheck = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M4 12l5 5L20 6" /></svg>
)
export const IconInfo = () => (
  <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
)
export const IconPin = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M12 21s7-6.4 7-11a7 7 0 10-14 0c0 4.6 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
)
export const IconMoon = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M21 12.8A8.5 8.5 0 1111.2 3a6.5 6.5 0 009.8 9.8z" /></svg>
)
export const IconSun = () => (
  <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>
)
export const IconChevronLeft = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M15 6l-6 6 6 6" /></svg>
)
export const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" {...s}><path d="M9 6l6 6-6 6" /></svg>
)
