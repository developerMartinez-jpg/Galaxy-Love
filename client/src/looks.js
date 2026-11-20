// Procedural "look" for every planet: palette + surface pattern + rings/moons. Deterministic per planet id,
// and every planet gets its own colour / pattern / ring / moon combination.

const KINDS = ['bands', 'marble', 'spots', 'hearts', 'craters', 'swirls', 'stripes', 'stars', 'waves', 'checks']

// hand-picked first ten (pink, lilac, blue, turquoise, red, gold, green, orange, silver, magenta)
const BASE = [
  ['#ffb3d9', '#ff5fa8', '#ffe3f1'], ['#d6b8ff', '#9a6bff', '#f1e6ff'], ['#8fd0ff', '#2f7dff', '#dff2ff'],
  ['#6df5e4', '#0fa9a4', '#d3fff8'], ['#ff7a85', '#b3091b', '#ffc7cc'], ['#ffe08a', '#d99a00', '#fff4c9'],
  ['#7ff0ad', '#0e9a55', '#d9ffe8'], ['#ffbe85', '#f2600d', '#ffe6cf'], ['#eef1fa', '#8e98b0', '#ffffff'],
  ['#ff7df2', '#a4128f', '#ffd1fa']
]

const hsl = (h, s, l) => `hsl(${Math.round(h) % 360} ${s}% ${l}%)`
const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function palette(id) {
  if (id <= BASE.length) return BASE[id - 1]
  const h = (id * 137.508) % 360                       // golden-angle hue walk: no two neighbours look alike
  const s = 62 + ((id * 13) % 28)
  const l = 56 + ((id * 7) % 14)
  return [hsl(h, s, l + 10), hsl(h + 18, s + 8, l - 12), hsl(h - 16, s - 15, l + 26)]
}

export function lookFor(id) {
  const [c1, c2, c3] = palette(id)
  const kind = KINDS[(id * 3 + Math.floor(id / 10)) % KINDS.length]
  const ringType = id % 4 === 1 ? 1 : id % 9 === 0 ? 2 : 0     // single ring / double ring
  return {
    id, c1, c2, c3, kind,
    ring: ringType,
    ringTilt: ((id * 29) % 50) - 25,
    moon: id % 5 === 2 || id % 11 === 0,
    moonSpeed: 6 + (id % 7),
    spin: 18 + ((id * 5) % 26),                         // seconds per rotation
    dir: id % 6 === 0 ? 'reverse' : 'normal',
    tile: tileUri({ id, c1, c2, c3, kind })
  }
}

const HEART = 'M0 -3 C -5 -9 -12 -2 0 9 C 12 -2 5 -9 0 -3Z'

function tileUri({ id, c1, c2, c3, kind }) {
  const r = rng(id * 977 + 13), W = 200, H = 100
  const wrap = (fn) => [-W, 0, W].map(fn).join('')
  let body = ''
  const cols = [c1, c2, c3]
  switch (kind) {
    case 'bands': {
      let y = 0
      while (y < H) { const h = 5 + r() * 14; body += `<rect x="0" y="${y}" width="${W}" height="${h}" fill="${cols[Math.floor(r() * 3)]}" opacity="${0.35 + r() * 0.5}"/>`; y += h }
      for (let i = 0; i < 3; i++) { const x = r() * W, y2 = 20 + r() * 60; body += wrap((dx) => `<ellipse cx="${x + dx}" cy="${y2}" rx="${10 + r() * 10}" ry="${5 + r() * 4}" fill="${c3}" opacity=".7"/>`) }
      break
    }
    case 'marble':
      for (let i = 0; i < 9; i++) { const x = r() * W, y = r() * H, rad = 14 + r() * 24, col = cols[Math.floor(r() * 3)]; body += wrap((dx) => `<circle cx="${x + dx}" cy="${y}" r="${rad}" fill="${col}" opacity=".55" filter="url(#b)"/>`) }
      break
    case 'spots':
      for (let i = 0; i < 20; i++) { const x = r() * W, y = r() * H, rad = 3 + r() * 8, col = cols[1 + Math.floor(r() * 2)]; body += wrap((dx) => `<circle cx="${x + dx}" cy="${y}" r="${rad}" fill="${col}" opacity=".75"/>`) }
      break
    case 'hearts':
      for (let i = 0; i < 12; i++) { const x = r() * W, y = 8 + r() * 84, s = 0.7 + r() * 1.1, col = cols[1 + Math.floor(r() * 2)]; body += wrap((dx) => `<path d="${HEART}" transform="translate(${x + dx} ${y}) scale(${s}) rotate(${(r() - 0.5) * 40})" fill="${col}" opacity=".85"/>`) }
      break
    case 'craters':
      for (let i = 0; i < 9; i++) { const x = r() * W, y = 8 + r() * 84, rad = 5 + r() * 11; body += wrap((dx) => `<circle cx="${x + dx}" cy="${y}" r="${rad}" fill="${c2}" opacity=".6"/><circle cx="${x + dx - rad * 0.2}" cy="${y - rad * 0.2}" r="${rad * 0.75}" fill="${c1}" opacity=".45"/>`) }
      break
    case 'swirls':
      for (let i = 0; i < 7; i++) { const y = 8 + i * 14 + r() * 6, a = 5 + r() * 7, col = cols[Math.floor(r() * 3)]; body += `<path d="M0 ${y} C 40 ${y - a}, 60 ${y + a}, 100 ${y} S 160 ${y - a}, 200 ${y}" fill="none" stroke="${col}" stroke-width="${2 + r() * 4}" opacity=".7"/>` }
      break
    case 'stripes': {
      let x = 0, i = 0
      const n = 8 + Math.floor(r() * 5)
      for (let k = 0; k < n; k++) { const w = W / n; body += `<rect x="${x}" y="0" width="${w + 0.5}" height="${H}" fill="${cols[i++ % 3]}" opacity="${0.4 + r() * 0.4}"/>`; x += w }
      break
    }
    case 'stars':
      for (let i = 0; i < 16; i++) { const x = r() * W, y = 6 + r() * 88, s = 1 + r() * 2.2; body += wrap((dx) => `<path d="M${x + dx} ${y - 4 * s} L${x + dx + s} ${y - s} L${x + dx + 4 * s} ${y} L${x + dx + s} ${y + s} L${x + dx} ${y + 4 * s} L${x + dx - s} ${y + s} L${x + dx - 4 * s} ${y} L${x + dx - s} ${y - s}Z" fill="${c3}" opacity=".9"/>`) }
      break
    case 'waves':
      for (let i = 0; i < 8; i++) { const y = 6 + i * 12, a = 3 + r() * 4, col = cols[1 + (i % 2)]; body += `<path d="M0 ${y} Q 25 ${y - a} 50 ${y} T 100 ${y} T 150 ${y} T 200 ${y}" fill="none" stroke="${col}" stroke-width="3" opacity=".7"/>` }
      break
    default: // checks (diamonds)
      for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) { if ((x + y) % 2) body += `<rect x="${x * 25 + 4}" y="${y * 24 + 4}" width="14" height="14" transform="rotate(45 ${x * 25 + 11} ${y * 24 + 11})" fill="${cols[(x + y) % 3]}" opacity=".6"/>` }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><filter id="b"><feGaussianBlur stdDeviation="5"/></filter><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/>${body}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
