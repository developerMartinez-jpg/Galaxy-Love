import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { sfx } from './audio.js'
import { burst } from './fx.js'
import { lookFor } from './looks.js'
import { PlanetArt, planetVars, GrandPlanetArt } from './Planet.jsx'

function useEscape(fn) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && fn()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [fn])
}

function OrbPreview({ id, locked = false }) {
  const look = useMemo(() => lookFor(id), [id])
  if (id === 50) return <div className="orb"><GrandPlanetArt locked={locked} /></div>
  return <div className="orb planet-cell unlocked" style={planetVars(look)}><PlanetArt look={look} locked={locked} /></div>
}

/** "ENTER THE SECRET PASSWORD" */
export function PasswordModal({ planet, onClose, onSuccess }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)
  const [phase, setPhase] = useState('ask') // ask -> unlocked
  const input = useRef(null)
  useEscape(() => phase === 'ask' && onClose())
  useEffect(() => { input.current?.focus() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (busy || !pw) return
    setBusy(true); setError('')
    try {
      const result = await api.post(`/api/planets/${planet.id}/open`, { password: pw.trim() })
      setPhase('unlocked')
      sfx.unlock()
      const r = document.querySelector('.modal-card')?.getBoundingClientRect()
      burst(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 3 : undefined, { count: 70, power: 1.3 })
      setTimeout(() => burst(undefined, undefined, { count: 50, power: 1.1 }), 450)
      setTimeout(() => onSuccess(result), 2100)
    } catch (err) {
      setError(err.message)
      setShake((n) => n + 1)
      sfx.wrong()
      setBusy(false)
      setPw('')
      input.current?.focus()
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && phase === 'ask' && onClose()}>
      <div className={`modal-card password ${phase}`} role="dialog" aria-modal="true" aria-label="Enter the secret password">
        {phase === 'ask' && <button className="x-btn" onClick={onClose} aria-label="Close">✕</button>}
        <OrbPreview id={planet.id} />
        {phase === 'ask' ? (
          <form onSubmit={submit} key={shake} className={shake ? 'shake' : ''}>
            <div className="modal-kicker">PLANET {planet.id} · {planet.name.toUpperCase()}</div>
            <h2 className="modal-title">ENTER THE SECRET PASSWORD</h2>
            <div className="pw-field">
              <input ref={input} type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)}
                autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck="false" maxLength={100}
                placeholder="••••••••••••" aria-label="Secret password" />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)}>{show ? 'HIDE' : 'SHOW'}</button>
            </div>
            <div className="form-error" role="alert">{error}</div>
            <button className="btn-glow" disabled={busy || !pw}>{busy ? '...' : 'UNLOCK PLANET'}</button>
          </form>
        ) : (
          <div className="unlocked-msg">
            <div className="modal-kicker">PLANET {planet.id} · {planet.name.toUpperCase()}</div>
            <h2 className="modal-title glow">PLANET UNLOCKED ✨</h2>
            <p className="unlock-sub">A new reason is waiting for you...</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function Paragraphs({ text }) {
  return text.split(/\n\s*\n/).map((p, i) => <p key={i} style={{ '--i': i }}>{p.trim()}</p>)
}

/** Love letter with an envelope-opening animation. */
export function LetterModal({ planet, letter, onClose }) {
  const [open, setOpen] = useState(false)
  useEscape(onClose)
  useEffect(() => {
    sfx.letter()
    const t = setTimeout(() => setOpen(true), 650)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { if (open) { const r = document.querySelector('.letter-card')?.getBoundingClientRect(); burst(r ? r.left + r.width / 2 : undefined, r ? r.top : undefined, { count: 14, power: 0.7 }) } }, [open])

  return (
    <div className="modal-backdrop letter-backdrop">
      <div className={`letter-scene ${open ? 'open' : ''}`}>
        <div className="envelope" aria-hidden="true"><i className="flap" /><i className="pocket" /><i className="seal">💜</i></div>
        <article className="letter-card" role="dialog" aria-modal="true" aria-label={letter.title}>
          <div className="letter-kicker">PLANET {planet.id} · {planet.name.toUpperCase()}</div>
          <h2 className="letter-title">{letter.title}</h2>
          <div className="letter-ornament" aria-hidden="true">✦ ✧ ✦</div>
          <div className="letter-body"><Paragraphs text={letter.body} /></div>
          <div className="letter-sign" aria-hidden="true">💜</div>
          <button className="btn-glow" onClick={onClose}>BACK TO THE GALAXY</button>
        </article>
      </div>
    </div>
  )
}
