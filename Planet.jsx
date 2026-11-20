import { memo, useMemo } from 'react'
import { lookFor } from './looks.js'
import { fmtCountdown } from './api.js'

const LockIcon = () => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" aria-hidden="true">
    <path d="M7 10V8a5 5 0 0 1 10 0v2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="5" y="10" width="14" height="10.5" rx="2.6" fill="#fff" />
    <circle cx="12" cy="15" r="1.7" fill="#2b1650" /><rect x="11.2" y="15.5" width="1.6" height="2.6" rx=".8" fill="#2b1650" />
  </svg>
)

export function planetVars(look) {
  return {
    '--c1': look.c1, '--c2': look.c2, '--c3': look.c3,
    '--tile': look.tile, '--spin': `${look.spin}s`, '--dir': look.dir,
    '--tilt': `${look.ringTilt}deg`, '--moon': `${look.moonSpeed}s`
  }
}

export function PlanetArt({ look, locked }) {
  return (
    <span className="planet-stage">
      {look.ring > 0 && <span className="ring-set back"><i className="ring r1" />{look.ring === 2 && <i className="ring r2" />}</span>}
      <span className="sphere">
        <span className="surface" />
        <span className="shade" />
      </span>
      {look.ring > 0 && <span className="ring-set front"><i className="ring r1" />{look.ring === 2 && <i className="ring r2" />}</span>}
      {look.moon && !locked && <span className="moon-orbit"><i /></span>}
      {!locked && <span className="twinkle t1">✦</span>}
      {!locked && <span className="twinkle t2">✦</span>}
      {locked && <span className="lock"><LockIcon /></span>}
    </span>
  )
}

/** One 3D, rotating planet. Props: planet {id,name,status,unlockAt}, remainingMs (for locked planets with a timer). */
function Planet({ planet, remainingMs, onClick }) {
  const look = useMemo(() => lookFor(planet.id), [planet.id])
  const { status } = planet
  const locked = status === 'locked'
  let label
  if (status === 'opened') label = 'OPENED 💜'
  else if (status === 'unlocked') label = 'TAP TO OPEN ✨'
  else if (planet.unlockAt) label = fmtCountdown(remainingMs)
  else label = 'COMING SOON...'

  return (
    <button type="button" className={`planet-cell ${status}`} style={planetVars(look)} onClick={() => onClick(planet)}
      aria-label={`Planet ${planet.id}, ${planet.name}, ${locked ? 'locked' : status}`}>
      <PlanetArt look={look} locked={locked} />
      <span className="p-num">{planet.id}</span>
      <span className="p-name">{planet.name}</span>
      <span className={`p-status ${locked && planet.unlockAt ? 'timer' : ''}`}>{label}</span>
    </button>
  )
}
export default memo(Planet)

/** Planet 50: the golden-and-pastel-pink finale planet, shown larger and very different from the rest. */
export function GrandPlanet({ planet, remainingMs, onClick }) {
  const locked = planet.status === 'locked'
  const label = planet.status === 'opened' ? 'OPENED 💜' : planet.status === 'unlocked' ? 'TAP TO OPEN ✨'
    : planet.unlockAt ? fmtCountdown(remainingMs) : 'COMING SOON...'
  return (
    <button type="button" className={`grand-cell ${planet.status}`} onClick={() => onClick(planet)}
      aria-label={`Planet 50, ${planet.name}, ${planet.status}`}>
      <GrandPlanetArt locked={locked} />
      <span className="p-num grand">50</span>
      <span className="p-name grand">{planet.name}</span>
      <span className={`p-status ${locked && planet.unlockAt ? 'timer' : ''}`}>{label}</span>
    </button>
  )
}

export function GrandPlanetArt({ locked = false, big = false }) {
  return (
    <span className={`grand-stage ${big ? 'big' : ''}`}>
      <span className="grand-aura" />
      <span className="grand-ring gr3 back" /><span className="grand-ring gr2 back" /><span className="grand-ring gr1 back" />
      <span className="grand-sphere"><span className="grand-surface" /><span className="shade" /></span>
      <span className="grand-ring gr3 front" /><span className="grand-ring gr2 front" /><span className="grand-ring gr1 front" />
      {!locked && [0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`g-heart gh${i}`}>{i % 2 ? '💖' : '💛'}</span>)}
      {!locked && [0, 1, 2, 3, 4].map((i) => <span key={i} className={`g-star gs${i}`}>★</span>)}
      {locked && <span className="lock grand-lock"><LockIcon /></span>}
    </span>
  )
}
