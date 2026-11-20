import { useCallback, useEffect, useRef, useState } from 'react'
import { api, syncClock } from './api.js'
import { music, sfx } from './audio.js'
import { attach } from './fx.js'
import Background from './Background.jsx'
import Welcome from './Welcome.jsx'
import Galaxy from './Galaxy.jsx'
import Finale from './Finale.jsx'
import { PasswordModal, LetterModal } from './Modals.jsx'
import AdminApp from './admin/AdminApp.jsx'

function Public() {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [entered, setEntered] = useState(false)
  const [pw, setPw] = useState(null)            // planet being unlocked
  const [letter, setLetter] = useState(null)    // { planet, letter }
  const [finale, setFinale] = useState(null)    // { replay }
  const [musicOn, setMusicOn] = useState(false)
  const fx = useRef(null)

  const apply = useCallback((s) => { syncClock(s.now); setState(s) }, [])
  const refresh = useCallback(() => api.get('/api/state').then(apply).catch((e) => setError(e.message)), [apply])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const t = setInterval(refresh, 30000)
    const vis = () => !document.hidden && refresh()
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [refresh])
  useEffect(() => attach(fx.current), [])

  // Browsers only allow sound after a tap: resume the music on the very first interaction if it was left on.
  useEffect(() => {
    const first = () => { if (music.preferred && entered && !music.on) { music.start(); setMusicOn(true) } }
    window.addEventListener('pointerdown', first, { once: true })
    return () => window.removeEventListener('pointerdown', first)
  }, [entered])

  const enter = () => {
    sfx.whoosh()
    if (music.preferred) { music.start(); setMusicOn(true) }
    api.post('/api/welcome/seen').catch(() => {})
    setTimeout(() => setEntered(true), 1500)
  }

  const toggleMusic = () => {
    if (music.on) { music.stop(); setMusicOn(false) } else { music.start(); setMusicOn(true) }
  }

  const pick = async (planet) => {
    sfx.tap()
    if (planet.status === 'unlocked') return setPw(planet)
    // already opened: reopen without asking again
    if (planet.id === 50) return setFinale({ replay: true })
    try {
      const { letter } = await api.get(`/api/planets/${planet.id}/letter`)
      setLetter({ planet, letter })
    } catch { refresh() }
  }

  const unlocked = (planet, result) => {
    apply(result.state)
    setPw(null)
    if (planet.id === 50) setFinale({ replay: false })
    else setLetter({ planet, letter: result.letter })
  }

  const showWelcome = state && !state.welcomed && !entered
  const inFinale = !!finale

  return (
    <>
      <Background />
      <canvas ref={fx} className="fx-canvas" aria-hidden="true" />

      {!showWelcome && state && (
        <nav className="topbar">
          <a className="admin-link" href="#/admin">Admin Login</a>
          <button className={`music-btn ${musicOn ? 'on' : ''}`} onClick={toggleMusic} aria-pressed={musicOn}>
            <span aria-hidden="true">{musicOn ? '♪' : '♪̸'}</span> MUSIC {musicOn ? 'ON' : 'OFF'}
          </button>
        </nav>
      )}

      {!state && !error && <div className="loading"><span className="spinner" aria-hidden="true" />Loading the universe...</div>}
      {error && !state && <div className="loading">The stars are a little shy right now. Please refresh in a moment. 💜</div>}

      {showWelcome && <Welcome onEnter={enter} />}
      {state && !showWelcome && <Galaxy state={state} onPick={pick} onRefresh={refresh} />}

      {pw && <PasswordModal planet={pw} onClose={() => setPw(null)} onSuccess={(r) => unlocked(pw, r)} />}
      {letter && <LetterModal planet={letter.planet} letter={letter.letter} onClose={() => setLetter(null)} />}
      {inFinale && <Finale replay={finale.replay} onClose={() => { setFinale(null); refresh() }} />}
    </>
  )
}

export default function App() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const h = () => setHash(window.location.hash)
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  return hash.startsWith('#/admin') ? <AdminApp /> : <Public />
}
