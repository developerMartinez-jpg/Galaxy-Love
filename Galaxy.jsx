import { useEffect, useMemo, useRef, useState } from 'react'
import Planet, { GrandPlanet } from './Planet.jsx'
import { fmtCountdown, serverNow } from './api.js'
import { sfx } from './audio.js'

function useTicker() {
  const [, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN((n) => n + 1), 1000); return () => clearInterval(t) }, [])
  return serverNow()
}

export default function Galaxy({ state, onPick, onRefresh }) {
  const now = useTicker()
  const { planets, discovered, total, nextUnlockAt } = state
  const refreshedFor = useRef(0)
  const [toast, setToast] = useState('')

  // When a countdown reaches zero, ask the server (the only authority on time) what changed.
  useEffect(() => {
    if (nextUnlockAt && now >= nextUnlockAt && refreshedFor.current !== nextUnlockAt) {
      refreshedFor.current = nextUnlockAt
      setTimeout(onRefresh, 400)
    }
  }, [now, nextUnlockAt, onRefresh])

  const pick = (p) => {
    if (p.status === 'locked') {
      sfx.locked()
      setToast(p.unlockAt ? `Planet ${p.id} is still sleeping. It wakes up in ${fmtCountdown(p.unlockAt - now)}. 💜` : `Planet ${p.id} is waiting for the one before it. Coming soon... 💜`)
      clearTimeout(pick.t); pick.t = setTimeout(() => setToast(''), 3200)
      return
    }
    onPick(p)
  }

  const waiting = planets.find((p) => p.status === 'unlocked')
  const hero = useMemo(() => {
    if (discovered === total) return { kind: 'done' }
    if (waiting) return { kind: 'ready', planet: waiting }
    if (nextUnlockAt) return { kind: 'timer', ms: nextUnlockAt - now }
    return { kind: 'soon' }
  }, [discovered, total, waiting, nextUnlockAt, now])

  const pct = Math.round((discovered / total) * 100)
  const regular = planets.slice(0, 49)
  const last = planets[49]

  return (
    <main className="galaxy fade-in">
      <header className="hero">
        <h1 className="title">50 PLANETS, 50 REASONS TO LOVE YOU</h1>
        <p className="subtitle">Somewhere in this universe, there is a little galaxy made just for you. Every 24 hours, a new planet will reveal another reason why you mean the world to me. 💜</p>

        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={discovered}>
          <div className="progress-label">PLANETS DISCOVERED: {discovered}/{total}</div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        </div>

        <div className={`next-box ${hero.kind}`}>
          {hero.kind === 'timer' && (<>
            <div className="next-label">THE NEXT PLANET WAKES UP IN</div>
            <div className="countdown">{fmtCountdown(hero.ms)}</div>
            <div className="countdown-units">HOURS : MINUTES : SECONDS</div>
          </>)}
          {hero.kind === 'ready' && (<>
            <div className="next-label">A NEW PLANET IS WAITING FOR YOU ✨</div>
            <button className="btn-glow small" onClick={() => onPick(hero.planet)}>OPEN PLANET {hero.planet.id}</button>
          </>)}
          {hero.kind === 'soon' && <div className="next-label">COMING SOON...</div>}
          {hero.kind === 'done' && <div className="next-label">YOU HAVE DISCOVERED THE WHOLE UNIVERSE 💜</div>}
        </div>
      </header>

      <section className="planet-grid" aria-label="Planets 1 to 49">
        {regular.map((p) => (
          <Planet key={p.id} planet={p} remainingMs={p.unlockAt ? p.unlockAt - now : 0} onClick={pick} />
        ))}
      </section>
      <section className="grand-row" aria-label="Planet 50">
        <GrandPlanet planet={last} remainingMs={last.unlockAt ? last.unlockAt - now : 0} onClick={pick} />
      </section>

      <footer className="foot">made with love, just for you 💜</footer>
      <div className={`toast ${toast ? 'show' : ''}`} role="status">{toast}</div>
    </main>
  )
}
