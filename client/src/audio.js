// All sound is synthesised with the Web Audio API: no audio files, no copyright, nothing to download.
let ctx, master, wet, musicTimer, musicOn = false, step = 0, nextTime = 0

const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
}

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain(); master.gain.value = 0.9
    // simple feedback-delay "reverb"
    wet = ctx.createGain(); wet.gain.value = 0.35
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.34
    const fb = ctx.createGain(); fb.gain.value = 0.42
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400
    wet.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(master)
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, t, { dur = 1, type = 'sine', vol = 0.1, attack = 0.01, send = 0.5, out } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type; o.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(out || master)
  const s = ctx.createGain(); s.gain.value = send; g.connect(s); s.connect(wet)
  o.start(t); o.stop(t + dur + 0.05)
}

/* ---------- romantic ambient loop: Cmaj7 - Am7 - Fmaj7 - G6, soft pads + music-box arpeggio ---------- */
const CHORDS = [
  [130.81, 164.81, 196.0, 246.94], // Cmaj7
  [110.0, 164.81, 196.0, 261.63],  // Am7
  [87.31, 174.61, 220.0, 329.63],  // Fmaj7
  [98.0, 146.83, 196.0, 246.94]    // G6
]
const ARP = [0, 1, 2, 3, 2, 1, 3, 2]
const BEAT = 0.8

function scheduleMusic() {
  if (!musicOn || !ctx) return
  while (nextTime < ctx.currentTime + 1.5) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length]
    const i = step % 8
    if (i === 0) chord.forEach((f, k) => tone(f, nextTime + k * 0.05, { dur: BEAT * 8.4, type: 'sine', vol: 0.045, attack: 1.6, send: 0.3 }))
    const note = chord[ARP[i]] * 4
    tone(note, nextTime, { dur: 2.2, type: 'triangle', vol: 0.05, attack: 0.012, send: 0.7 })
    if (i === 4) tone(chord[3] * 2, nextTime, { dur: 3, type: 'sine', vol: 0.04, send: 0.8 })
    nextTime += BEAT
    step++
  }
}

export const music = {
  get on() { return musicOn },
  get preferred() { return store.get('lg_music') !== 'off' },
  start() {
    if (!ensure() || musicOn) return
    musicOn = true; step = 0; nextTime = ctx.currentTime + 0.1
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4)
    scheduleMusic()
    musicTimer = setInterval(scheduleMusic, 400)
    store.set('lg_music', 'on')
  },
  stop(remember = true) {
    if (!ctx || !musicOn) return
    musicOn = false
    clearInterval(musicTimer)
    master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25)
    setTimeout(() => { if (!musicOn && ctx) master.gain.setValueAtTime(0.9, ctx.currentTime) }, 1500)
    if (remember) store.set('lg_music', 'off')
  }
}

/* ---------- little sound effects ---------- */
const seq = (notes, gap, opts) => { if (!ensure()) return; notes.forEach((f, i) => tone(f, ctx.currentTime + i * gap, opts)) }

export const sfx = {
  tap: () => seq([880], 0, { dur: 0.25, type: 'triangle', vol: 0.05 }),
  wrong: () => seq([300, 240], 0.13, { dur: 0.35, type: 'sine', vol: 0.07, send: 0.2 }),
  locked: () => seq([220, 196], 0.1, { dur: 0.3, type: 'sine', vol: 0.05, send: 0.1 }),
  unlock: () => seq([523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98], 0.09, { dur: 1.6, type: 'triangle', vol: 0.07, send: 0.8 }),
  letter: () => seq([392, 493.88, 587.33], 0.16, { dur: 1.4, type: 'sine', vol: 0.05, send: 0.7 }),
  gift: () => seq([659.25, 880, 1108.73, 1318.5], 0.07, { dur: 1.2, type: 'triangle', vol: 0.06, send: 0.8 }),
  whoosh() {
    if (!ensure()) return
    const t = ctx.currentTime
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
    const src = ctx.createBufferSource(); src.buffer = buf
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(3000, t + 1)
    const g = ctx.createGain(); g.gain.value = 0.08
    src.connect(f); f.connect(g); g.connect(master); src.start(t)
  },
  boom() {
    if (!ensure()) return
    const t = ctx.currentTime
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.5)
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.7)
    seq([2093, 2637, 3136], 0.05, { dur: 0.5, type: 'triangle', vol: 0.02, send: 0.9 })
  }
}
