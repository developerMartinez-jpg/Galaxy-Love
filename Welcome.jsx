import { useState } from 'react'

export default function Welcome({ onEnter }) {
  const [leaving, setLeaving] = useState(false)
  const go = () => {
    if (leaving) return
    setLeaving(true)
    onEnter()                       // audio + server flag happen inside the user gesture
  }
  return (
    <div className={`welcome ${leaving ? 'leaving' : ''}`}>
      <div className="warp" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--a': `${i * 10}deg`, '--d': `${(i % 6) * 0.05}s` }} />)}</div>
      <div className="welcome-inner">
        <div className="big-heart" aria-hidden="true">
          <svg viewBox="0 0 100 90" width="100%" height="100%">
            <defs>
              <radialGradient id="hg" cx="35%" cy="30%" r="80%"><stop offset="0" stopColor="#ffd1ec" /><stop offset=".45" stopColor="#ff5fb4" /><stop offset="1" stopColor="#7b1fa2" /></radialGradient>
            </defs>
            <path d="M50 84 C 8 52 2 24 22 11 C 36 3 47 12 50 22 C 53 12 64 3 78 11 C 98 24 92 52 50 84Z" fill="url(#hg)" />
            <path d="M24 22 C 28 15 36 14 40 18" stroke="#fff" strokeOpacity=".7" strokeWidth="3" fill="none" strokeLinecap="round" />
          </svg>
          <span className="orbit o1">✦</span><span className="orbit o2">✧</span><span className="orbit o3">✦</span>
        </div>
        <h1 className="welcome-title">HEY, YOU! ❤️</h1>
        <p className="welcome-text">I made something special for you. A little universe filled with memories, feelings and 50 reasons why you mean so much to me.</p>
        <button className="btn-glow" onClick={go}>ENTER MY UNIVERSE</button>
      </div>
    </div>
  )
}
