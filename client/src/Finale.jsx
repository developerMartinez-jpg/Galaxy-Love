import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { sfx } from './audio.js'
import { burst, fireworksShow, stopFireworks, risingHearts } from './fx.js'
import { GrandPlanetArt } from './Planet.jsx'
import { Paragraphs } from './Modals.jsx'

const rnd = (a, b) => a + Math.random() * (b - a)

/* ---------------- gift effects ---------------- */
function RosePetals() {
  const petals = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    left: rnd(-5, 100), delay: rnd(0, 4.5), dur: rnd(5.5, 9.5), size: rnd(12, 30), sway: rnd(30, 110), spin: rnd(240, 900),
    hue: ['#ff4d6d', '#e11d48', '#ff8fab', '#be123c', '#ffb3c6'][i % 5]
  })), [])
  return (
    <div className="fx-layer petals" aria-hidden="true">
      {petals.map((p, i) => (
        <i key={i} style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.25, background: `radial-gradient(circle at 30% 25%, #fff6, ${p.hue} 55%)`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, '--sway': `${p.sway}px`, '--spin': `${p.spin}deg` }} />
      ))}
    </div>
  )
}

function MagicLights() {
  const bulbs = Array.from({ length: 16 }, (_, i) => {
    const t = i / 15
    return { left: 3 + t * 94, top: 34 * Math.sin(Math.PI * t) + 2, delay: i * 0.12 }
  })
  const orbs = useMemo(() => Array.from({ length: 36 }, () => ({ left: rnd(0, 100), size: rnd(6, 18), delay: rnd(0, 5), dur: rnd(6, 11) })), [])
  return (
    <div className="fx-layer lights" aria-hidden="true">
      <div className="string" />
      {bulbs.map((b, i) => <b key={i} style={{ left: `${b.left}%`, top: `${b.top}px`, animationDelay: `${b.delay}s` }} />)}
      {orbs.map((o, i) => <i key={i} style={{ left: `${o.left}%`, width: o.size, height: o.size, animationDelay: `${o.delay}s`, animationDuration: `${o.dur}s` }} />)}
    </div>
  )
}

function TravelScene() {
  const stars = useMemo(() => Array.from({ length: 46 }, () => ({ top: rnd(2, 98), delay: rnd(0, 3), dur: rnd(1.2, 3.4), len: rnd(40, 160) })), [])
  return (
    <div className="fx-layer travel" aria-hidden="true">
      {stars.map((s, i) => <i key={i} style={{ top: `${s.top}%`, width: s.len, animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }} />)}
      <div className="cloud c1" /><div className="cloud c2" />
      <div className="plane">
        <span className="trail" />
        <svg viewBox="0 0 64 64" width="100%" height="100%">
          <path d="M62 30 L40 24 L26 6 L20 6 L28 24 L10 22 L4 14 L0 14 L4 30 L0 46 L4 46 L10 38 L28 36 L20 54 L26 54 L40 36 L62 32Z" fill="#fff" stroke="#c7b6ff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="travel-caption">✦ ✧ ✦</div>
    </div>
  )
}

/* ---------------- star heart ---------------- */
function StarHeart() {
  const pts = useMemo(() => {
    const out = []
    const hx = (t) => 16 * Math.sin(t) ** 3
    const hy = (t) => -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    for (let i = 0; i < 90; i++) { const t = (i / 90) * Math.PI * 2; out.push({ x: hx(t), y: hy(t), r: rnd(1.1, 1.9), edge: true }) }
    for (let i = 0; i < 230; i++) {
      const t = rnd(0, Math.PI * 2), k = Math.sqrt(Math.random()) * 0.96
      out.push({ x: hx(t) * k, y: hy(t) * k, r: rnd(0.35, 1.2) })
    }
    return out.map((p, i) => ({ ...p, delay: (i % 60) * 0.045 + rnd(0, 0.5), tw: rnd(1.6, 4.2) }))
  }, [])
  const edge = pts.filter((p) => p.edge)
  const d = edge.map((p, i) => `${i ? 'L' : 'M'}${(p.x * 8 + 160).toFixed(1)} ${(p.y * 8 + 150).toFixed(1)}`).join(' ') + 'Z'
  return (
    <svg className="star-heart" viewBox="0 0 320 320" role="img" aria-label="A giant heart made of stars">
      <path d={d} fill="none" stroke="#ffd1ec" strokeOpacity=".25" strokeWidth=".8" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x * 8 + 160} cy={p.y * 8 + 150} r={p.r * 1.6}
          fill={i % 4 === 0 ? '#ffe08a' : i % 3 === 0 ? '#ff9ad5' : '#fff'}
          style={{ animationDelay: `${p.delay}s, ${p.delay + 1.2}s`, animationDuration: `0.8s, ${p.tw}s` }} />
      ))}
    </svg>
  )
}

/* ---------------- gift box ---------------- */
function GiftBox({ gift, state, onOpen }) {
  return (
    <button className={`gift ${gift.kind} ${state}`} onClick={() => onOpen(gift)} aria-label={gift.label}>
      <span className="gift-box">
        <i className="beam" />
        <i className="gift-emoji">{gift.kind === 'decoration' ? '🏡' : gift.kind === 'roses' ? '🌹' : '✈️'}</i>
        <i className="base" />
        <i className="lid"><b className="bow" /></i>
      </span>
      <span className="gift-label">{gift.label}</span>
      <span className="gift-hint">{state === 'opened' ? 'TAP TO SEE IT AGAIN' : 'TAP TO OPEN'}</span>
    </button>
  )
}

/* ---------------- the finale ---------------- */
export default function Finale({ replay, onClose }) {
  const [data, setData] = useState(null)
  const [stage, setStage] = useState(replay ? 3 : 0)       // 0 headline · 1 intro · 3 gifts
  const [opening, setOpening] = useState(null)             // gift id whose box is animating
  const [card, setCard] = useState(null)                   // gift card currently shown
  const [effect, setEffect] = useState(null)
  const [showFinal, setShowFinal] = useState(false)
  const finalRef = useRef(null)
  const timers = useRef([])
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t) }

  useEffect(() => {
    let alive = true
    api.get('/api/finale').then((d) => {
      if (!alive) return
      setData(d)
      if (replay && d.allOpened) setShowFinal(true)
    })
    if (!replay) {
      sfx.boom()
      fireworksShow(9500, () => Math.random() < 0.4 && sfx.boom())
      later(() => risingHearts(30), 1200)
      later(() => setStage(1), 3600)
      later(() => setStage(3), 8400)
    } else {
      fireworksShow(2500)
    }
    return () => { alive = false; stopFireworks(); timers.current.forEach(clearTimeout) }
  }, [replay])

  useEffect(() => {
    if (showFinal) later(() => finalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350)
  }, [showFinal])

  const openGift = async (gift) => {
    if (opening) return
    setOpening(gift.id)
    sfx.gift(); sfx.whoosh()
    const box = document.querySelector(`.gift.${gift.kind} .gift-box`)?.getBoundingClientRect()
    burst(box ? box.left + box.width / 2 : undefined, box ? box.top + box.height / 3 : undefined, { count: 45, power: 1.2 })
    try {
      const known = data.gifts.find((g) => g.id === gift.id)
      let payload
      if (known?.opened) payload = { gift: { id: known.id, kind: known.kind, title: known.title, body: known.body } }
      else payload = await api.post(`/api/gifts/${gift.id}/open`)
      if (payload.finale) setData(payload.finale)
      later(() => {
        setEffect(gift.kind)
        later(() => setEffect(null), 9500)
        setCard(payload.gift)
        setOpening(null)
      }, 1100)
    } catch {
      setOpening(null)
    }
  }

  const closeCard = () => {
    setCard(null)
    if (data?.allOpened && !showFinal) { setShowFinal(true); later(() => risingHearts(20), 600) }
  }

  const gifts = data?.gifts ?? []
  const text = data?.text

  return (
    <div className="finale" role="dialog" aria-modal="true" aria-label="The end of my universe">
      <div className="finale-bg" aria-hidden="true"><i /><i /><i /></div>

      <section className="finale-hero">
        <div className="finale-planet"><GrandPlanetArt big /></div>
        <h1 className="finale-headline">{text?.headline ?? 'YOU MADE IT TO THE END OF MY UNIVERSE ❤️'}</h1>
        {stage >= 1 && text && <p className="finale-intro fade-up">{text.intro}</p>}
      </section>

      {stage >= 3 && data && (
        <section className="gifts fade-up" aria-label="Three gifts">
          {gifts.map((g) => <GiftBox key={g.id} gift={g} state={g.opened ? 'opened' : opening === g.id ? 'opening' : ''} onOpen={openGift} />)}
          {!gifts.length && <p className="finale-intro">...</p>}
        </section>
      )}

      {showFinal && data?.finalLetter && (
        <section className="final-letter" ref={finalRef}>
          <article className="letter-card final">
            <h2 className="letter-title big">{data.finalLetter.title}</h2>
            <div className="letter-ornament" aria-hidden="true">✦ ✧ ✦</div>
            <div className="letter-body"><Paragraphs text={data.finalLetter.body} /></div>
          </article>
          <StarHeart />
          <p className="the-end">{text.ending}</p>
          <button className="btn-glow" onClick={onClose}>BACK TO THE GALAXY</button>
        </section>
      )}

      {!showFinal && stage >= 3 && <button className="finale-back" onClick={onClose}>BACK TO THE GALAXY</button>}

      {effect === 'roses' && <RosePetals />}
      {effect === 'decoration' && <MagicLights />}
      {effect === 'travel' && <TravelScene />}

      {card && (
        <div className="modal-backdrop gift-backdrop">
          <div className={`modal-card gift-card ${card.kind}`} role="dialog" aria-modal="true" aria-label={card.title}>
            <div className="gift-card-emoji" aria-hidden="true">{card.kind === 'decoration' ? '🏡' : card.kind === 'roses' ? '🌹' : '✈️'}</div>
            <h2 className="modal-title glow">{card.title}</h2>
            <p className="gift-card-text">{card.body}</p>
            <button className="btn-glow" onClick={closeCard}>{data?.allOpened && !showFinal ? 'ONE LAST THING 💜' : 'CLOSE'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
