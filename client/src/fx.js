// Imperative particle effects (hearts, stars, sparkles, fireworks) drawn on one overlay canvas.
let canvas, c2d, parts = [], raf = 0, running = false, W = 0, H = 0, dpr = 1
let fwTimer = 0

const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

export function attach(el) {
  canvas = el
  c2d = canvas.getContext('2d')
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = window.innerWidth; H = window.innerHeight
    canvas.width = W * dpr; canvas.height = H * dpr
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)
  return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); running = false; parts = [] }
}

function loop() {
  c2d.clearRect(0, 0, W, H)
  const now = performance.now()
  parts = parts.filter((p) => now - p.born < p.life)
  for (const p of parts) {
    const k = (now - p.born) / p.life
    const dt = 1 / 60
    p.vy += p.g * dt
    p.vx *= p.drag; p.vy *= p.drag
    p.x += p.vx; p.y += p.vy
    p.rot += p.vr
    c2d.save()
    c2d.globalAlpha = Math.max(0, p.fade ? 1 - k * k : 1 - Math.pow(k, 3))
    c2d.translate(p.x, p.y)
    c2d.rotate(p.rot)
    if (p.glyph) {
      c2d.font = `${p.size}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`
      c2d.textAlign = 'center'; c2d.textBaseline = 'middle'
      c2d.fillText(p.glyph, 0, 0)
    } else {
      c2d.fillStyle = p.color
      c2d.shadowColor = p.color; c2d.shadowBlur = p.size * 3
      c2d.beginPath(); c2d.arc(0, 0, p.size * (1 - k * 0.5), 0, Math.PI * 2); c2d.fill()
    }
    c2d.restore()
  }
  if (parts.length) raf = requestAnimationFrame(loop)
  else { running = false; c2d.clearRect(0, 0, W, H) }
}
function add(p) {
  parts.push({ born: performance.now(), life: 1500, g: 0, drag: 0.99, vr: 0, rot: 0, size: 14, ...p })
  if (!running && c2d) { running = true; raf = requestAnimationFrame(loop) }
}

const GLYPHS = ['💜', '✨', '⭐', '💖', '🌟', '💫', '❤️']
const COLORS = ['#ff9ad5', '#c9a7ff', '#ffe08a', '#9ad7ff', '#ffffff', '#ff6bb5']

/** A celebratory burst of hearts, stars and sparkles. */
export function burst(x = W / 2, y = H / 2, { count = 40, power = 1 } = {}) {
  if (!c2d) return
  const n = reduced() ? Math.ceil(count / 4) : count
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(2, 7) * power
    if (Math.random() < 0.6) {
      add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, g: 5, glyph: pick(GLYPHS), size: rand(14, 28), vr: rand(-0.06, 0.06), life: rand(1300, 2300) })
    } else {
      add({ x, y, vx: Math.cos(a) * s * 1.2, vy: Math.sin(a) * s * 1.2, g: 2, color: pick(COLORS), size: rand(1.5, 3.5), life: rand(900, 1700) })
    }
  }
}

/** One firework shell. */
export function firework(x = rand(W * 0.15, W * 0.85), y = rand(H * 0.12, H * 0.5)) {
  if (!c2d) return
  const colors = [pick(['#ffd56b', '#ff9ad5', '#c9a7ff', '#9ad7ff', '#ffffff']), pick(['#ffe08a', '#ff6bb5', '#ffffff'])]
  const n = reduced() ? 24 : 90
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05), s = rand(2, 6.2) * (i % 2 ? 1 : 0.6)
    add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 3, drag: 0.972, color: pick(colors), size: rand(1.4, 2.8), life: rand(1200, 2000), fade: true })
  }
  if (!reduced()) for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2), s = rand(1, 4)
    add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 3, glyph: pick(['💜', '✨', '💖']), size: rand(14, 22), life: 1800 })
  }
}

export function fireworksShow(ms = 9000, onShell) {
  clearInterval(fwTimer)
  const end = performance.now() + ms
  const shoot = () => { firework(); onShell && onShell() }
  shoot()
  fwTimer = setInterval(() => {
    if (performance.now() > end) return clearInterval(fwTimer)
    shoot(); if (Math.random() < 0.5) setTimeout(shoot, 220)
  }, 650)
}
export const stopFireworks = () => clearInterval(fwTimer)

/** Hearts drifting upward (used by the finale). */
export function risingHearts(n = 24) {
  for (let i = 0; i < n; i++) setTimeout(() => add({
    x: rand(0, W), y: H + 20, vx: rand(-0.3, 0.3), vy: rand(-2.6, -1.2), g: 0, drag: 1,
    glyph: pick(['💜', '💖', '❤️', '✨']), size: rand(16, 30), life: rand(3500, 6000), fade: true
  }), i * 120)
}
