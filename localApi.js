// Static (GitHub Pages) replacement for server/index.js.
// It exposes the SAME routes and answers with the SAME shapes, so the interface is untouched.
//  - letters are AES-GCM encrypted in the bundle (see scripts/make-vault.js); a planet opens only with its own password
//  - time comes from the web server's HTTP "Date" header (not from the device clock) and can never go backwards
//  - progress lives in this browser's localStorage
import vault from './generated/vault.json'

const KEY = 'lg_static_v1'
const LIM = 'lg_static_lim'
const SESSION = 'lg_static_admin'
const HOUR = 3600_000
const COUNT = 50
const SESSION_MS = 8 * HOUR

/* ---------------- errors ---------------- */
const fail = (status, message, extra = {}) => {
  const e = new Error(message)
  e.status = status
  e.data = { error: message, ...extra }
  throw e
}

/* ---------------- storage ---------------- */
const blank = () => ({ welcomed: false, waitMs: 24 * HOUR, lastSeen: 0, adminHash: null, planets: {}, letters: {}, gifts: {} })
let mem = null
function load() {
  if (mem) return mem
  try { mem = { ...blank(), ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { mem = blank() }
  return mem
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* private mode: keep in memory */ } }
const P = (id) => (load().planets[id] ||= {})

/* ---------------- clock: server time via the HTTP Date header ---------------- */
let sync = null   // { server, perf }
let syncing = null
async function syncTime() {
  if (sync && performance.now() - sync.perf < 5 * 60_000) return
  if (!syncing) {
    syncing = (async () => {
      try {
        const ctl = new AbortController()
        const t = setTimeout(() => ctl.abort(), 4000)
        const res = await fetch(location.pathname + '?t=' + Date.now(), { method: 'HEAD', cache: 'no-store', signal: ctl.signal })
        clearTimeout(t)
        const d = Date.parse(res.headers.get('date') || '')
        if (Number.isFinite(d)) sync = { server: d, perf: performance.now() }
      } catch { /* offline: fall back below */ }
      syncing = null
    })()
  }
  await syncing
}
function now() {
  const s = load()
  const t = sync ? sync.server + (performance.now() - sync.perf) : Date.now()
  const v = Math.max(Math.round(t), s.lastSeen) // never goes backwards, even if the device clock is changed
  if (v > s.lastSeen + 5000) { s.lastSeen = v; save() }
  return v
}

/* ---------------- crypto ---------------- */
const enc = new TextEncoder(), dec = new TextDecoder()
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const toB64 = (u8) => btoa(String.fromCharCode(...u8))
async function deriveKey(pw, salt, usage) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: vault.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, usage)
}
async function unseal(box, pw) {
  try {
    const key = await deriveKey(pw, b64(box.s), ['decrypt'])
    const out = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(box.i) }, key, b64(box.c))
    return JSON.parse(dec.decode(out))
  } catch { return null }
}
// local hashes are only used for passwords the admin changes inside this browser
async function hashLocal(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: vault.iter, hash: 'SHA-256' }, base, 256))
  return { s: toB64(salt), h: toB64(bits) }
}
async function verifyLocal(pw, rec) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: b64(rec.s), iterations: vault.iter, hash: 'SHA-256' }, base, 256))
  return toB64(bits) === rec.h
}
// returns the decrypted planet payload, true (local override matched) or null
async function checkPlanetPassword(id, pw) {
  const rec = P(id).pwHash
  if (rec) return (await verifyLocal(pw, rec)) ? true : null
  return unseal(vault.planets[id - 1], pw)
}
async function checkAdminPassword(pw) {
  const s = load()
  if (s.adminHash) return (await verifyLocal(pw, s.adminHash)) ? true : null
  return unseal(vault.admin, pw)
}

/* ---------------- local brute-force limiter (mirrors the server's) ---------------- */
function limiter(name, { max, windowMs, blockMs }) {
  const read = () => { try { return JSON.parse(localStorage.getItem(LIM) || '{}')[name] || null } catch { return null } }
  const write = (v) => { try { const all = JSON.parse(localStorage.getItem(LIM) || '{}'); all[name] = v; localStorage.setItem(LIM, JSON.stringify(all)) } catch { /* ignore */ } }
  return {
    check() { const v = read(); const t = Date.now(); return v && v.blockedUntil > t ? v.blockedUntil - t : 0 },
    fail() {
      const t = Date.now(); let v = read()
      if (!v || v.first + windowMs < t) v = { fails: 0, first: t, blockedUntil: 0 }
      v.fails += 1
      if (v.fails >= max) v.blockedUntil = t + blockMs
      write(v)
    },
    ok() { write(null) }
  }
}
const planetLimiter = limiter('planet', { max: 10, windowMs: 5 * 60_000, blockMs: 2 * 60_000 })
const adminLimiter = limiter('admin', { max: 5, windowMs: 15 * 60_000, blockMs: 15 * 60_000 })

/* ---------------- game rules (same as server/logic.js) ---------------- */
const waitMs = () => load().waitMs
const nameOf = (id) => P(id).name ?? vault.names[id - 1]

function computePlanets(t = now()) {
  const wait = waitMs()
  const rows = []
  for (let id = 1; id <= COUNT; id++) {
    const p = P(id)
    rows.push({ id, name: nameOf(id), override: p.override ?? null, opened_at: p.opened_at ?? null, delay_ms: p.delay_ms ?? null })
  }
  return rows.map((p, i) => {
    let availableAt = null
    if (p.id === 1) availableAt = 0
    else {
      const prev = rows[i - 1]
      if (prev.opened_at != null) availableAt = prev.opened_at + (prev.delay_ms ?? wait)
    }
    const natural = availableAt !== null && t >= availableAt
    const unlocked = p.override === 'lock' ? false : p.override === 'unlock' ? true : natural
    const opened = p.opened_at != null
    const status = !unlocked ? 'locked' : opened ? 'opened' : 'unlocked'
    return {
      id: p.id, name: p.name, status, override: p.override,
      openedAt: p.opened_at, delayMs: p.delay_ms,
      unlockAt: !unlocked && availableAt ? availableAt : null,
      availableAt
    }
  })
}
function publicState(t = now()) {
  const planets = computePlanets(t)
  const discovered = planets.filter((p) => p.status === 'opened').length
  const upcoming = planets.filter((p) => p.status === 'locked' && p.unlockAt).map((p) => p.unlockAt)
  return {
    now: t,
    welcomed: !!load().welcomed,
    total: COUNT,
    discovered,
    nextUnlockAt: upcoming.length ? Math.min(...upcoming) : null,
    finaleReady: planets[COUNT - 1].status === 'opened',
    planets: planets.map((p) => ({ id: p.id, name: p.name, status: p.status, unlockAt: p.unlockAt }))
  }
}
const planetStatus = (id, t = now()) => computePlanets(t).find((p) => p.id === id)

function giftsState() {
  const s = load()
  return vault.giftMeta.map((m) => {
    const g = s.gifts[m.id] || {}
    return { id: m.id, kind: m.kind, label: m.label, title: g.title ?? '', body: g.body ?? '', enabled: g.enabled === false ? 0 : 1, opened_at: g.opened_at ?? null }
  })
}
const allEnabledGiftsOpened = () => giftsState().filter((g) => g.enabled).every((g) => g.opened_at != null)
const letterOf = (id) => load().letters[id] || null

/* what a planet password reveals gets cached in this browser (so reopening needs no password again) */
function remember(id, payload) {
  const s = load()
  if (payload.letter && !s.letters[id]?.edited) s.letters[id] = { title: payload.letter.title, body: payload.letter.body, updated_at: s.letters[id]?.updated_at ?? vault.builtAt }
  for (const g of payload.gifts || []) {
    const cur = s.gifts[g.id] || {}
    if (!cur.edited) s.gifts[g.id] = { ...cur, title: g.title, body: g.body }
  }
}

/* ---------------- validation ---------------- */
const planetIdOf = (v) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 1 || n > COUNT) fail(404, 'Planet not found.')
  return n
}
const str = (v, { max = 20000, min = 1, name = 'Field' } = {}) => {
  if (typeof v !== 'string') fail(400, `${name} must be text.`)
  const t = v.trim()
  if (t.length < min) fail(400, `${name} cannot be empty.`)
  if (t.length > max) fail(400, `${name} is too long.`)
  return t
}
const hoursToMs = (h) => {
  const n = Number(h)
  if (!Number.isFinite(n) || n < 0 || n > 24 * 365) fail(400, 'Hours must be a number between 0 and 8760.')
  return Math.round(n * HOUR)
}

/* ---------------- admin session ---------------- */
let adminContent = null   // { letters:[{title,body}], gifts:[{id,title,body}] } (decrypted with the admin password)
function adminSession() {
  try {
    const r = JSON.parse(sessionStorage.getItem(SESSION) || 'null')
    if (!r || r.exp < Date.now()) return null
    adminContent = r.content
    return r
  } catch { return null }
}
const requireAdmin = () => { if (!adminSession()) fail(401, 'Administrator authentication required.') }

/* ---------------- finale ---------------- */
function finaleView() {
  if (planetStatus(COUNT).status !== 'opened') fail(403, 'The last planet has not been opened yet.')
  const gifts = giftsState().filter((g) => g.enabled).map((g) => {
    const opened = g.opened_at != null
    return { id: g.id, kind: g.kind, label: g.label, opened, ...(opened ? { title: g.title, body: g.body } : {}) }
  })
  const allOpened = allEnabledGiftsOpened()
  const out = { text: vault.finale, gifts, allOpened }
  if (allOpened) out.finalLetter = letterOf(COUNT)
  return out
}

/* ---------------- routes ---------------- */
const routes = []
const route = (method, pattern, handler, admin = false) => {
  const keys = []
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)' }) + '/?$')
  routes.push({ method, re, keys, handler, admin })
}

route('GET', '/api/state', () => publicState())
route('POST', '/api/welcome/seen', () => { load().welcomed = true; save(); return { ok: true } })

route('POST', '/api/planets/:id/open', async ({ params, body }) => {
  const id = planetIdOf(params.id)
  const wait = planetLimiter.check()
  if (wait) fail(429, 'Too many tries. Take a breath and try again in a moment, my love. 💜', { retryAfterMs: wait })
  const st = planetStatus(id)
  if (st.status === 'locked') fail(403, 'This planet is still locked.', { code: 'locked' })

  const given = typeof body.password === 'string' ? body.password : ''
  const res = given.length > 0 && given.length < 200 ? await checkPlanetPassword(id, given) : null
  if (!res) {
    planetLimiter.fail()
    fail(401, "Oops! That's not the right password. Try again, my love! 💜", { code: 'wrong_password' })
  }
  planetLimiter.ok()
  if (res !== true) remember(id, res)
  else if (!letterOf(id) && adminContent) remember(id, { letter: adminContent.letters[id - 1] })

  const first = st.status === 'unlocked'
  if (first && P(id).opened_at == null) P(id).opened_at = now()
  save()
  return { first, letter: letterOf(id) && { title: letterOf(id).title, body: letterOf(id).body }, state: publicState() }
})

route('GET', '/api/planets/:id/letter', ({ params }) => {
  const id = planetIdOf(params.id)
  if (planetStatus(id).status !== 'opened') fail(403, 'This planet has not been opened yet.')
  const l = letterOf(id)
  if (!l) fail(404, 'Letter not found on this device.')
  return { letter: { title: l.title, body: l.body } }
})

route('GET', '/api/finale', () => finaleView())

route('POST', '/api/gifts/:id/open', ({ params }) => {
  finaleView()
  const id = Number(params.id)
  const g = giftsState().find((x) => x.id === id && x.enabled)
  if (!g) fail(404, 'Gift not found.')
  const s = load()
  s.gifts[id] = { ...(s.gifts[id] || {}), opened_at: s.gifts[id]?.opened_at ?? now() }
  save()
  return { gift: { id: g.id, kind: g.kind, title: g.title, body: g.body }, finale: finaleView() }
})

/* ---- admin ---- */
route('POST', '/api/admin/login', async ({ body }) => {
  const wait = adminLimiter.check()
  if (wait) fail(429, `Too many failed attempts. Try again in ${Math.ceil(wait / 60000)} minute(s).`, { retryAfterMs: wait })
  const given = typeof body.password === 'string' ? body.password : ''
  const res = given.length > 0 && given.length < 200 ? await checkAdminPassword(given) : null
  if (!res) {
    adminLimiter.fail()
    await new Promise((r) => setTimeout(r, 400))
    fail(401, 'Incorrect master password.')
  }
  adminLimiter.ok()
  // with a locally-changed admin password the vault cannot be opened, so use what this browser already knows
  let content = res === true ? (adminContent || adminSession()?.content) : res
  if (!content) {
    const s = load()
    content = { letters: Array.from({ length: COUNT }, (_, i) => s.letters[i + 1] || { title: '', body: '' }), gifts: giftsState() }
  }
  adminContent = content
  try { sessionStorage.setItem(SESSION, JSON.stringify({ exp: Date.now() + SESSION_MS, content })) } catch { /* ignore */ }
  return { ok: true }
})

route('POST', '/api/admin/logout', () => {
  adminContent = null
  try { sessionStorage.removeItem(SESSION) } catch { /* ignore */ }
  return { ok: true }
})
route('GET', '/api/admin/me', () => ({ admin: !!adminSession() }))

route('GET', '/api/admin/dashboard', () => {
  const t = now()
  const planets = computePlanets(t)
  const opened = planets.filter((p) => p.openedAt != null)
  const unlockedNow = planets.filter((p) => p.status !== 'locked')
  const last = [...opened].sort((a, b) => b.openedAt - a.openedAt)[0]
  const first = [...opened].sort((a, b) => a.openedAt - b.openedAt)[0]
  const upcoming = planets.filter((p) => p.status === 'locked' && p.unlockAt).sort((a, b) => a.unlockAt - b.unlockAt)[0]
  return {
    now: t, total: COUNT,
    unlocked: unlockedNow.length,
    opened: opened.length,
    remaining: COUNT - opened.length,
    percent: Math.round((opened.length / COUNT) * 1000) / 10,
    firstOpened: first ? { id: first.id, name: first.name, at: first.openedAt } : null,
    lastOpened: last ? { id: last.id, name: last.name, at: last.openedAt } : null,
    next: upcoming ? { id: upcoming.id, name: upcoming.name, at: upcoming.unlockAt } : null,
    welcomed: !!load().welcomed,
    waitHours: waitMs() / HOUR
  }
}, true)

route('GET', '/api/admin/planets', () => {
  const t = now()
  return { now: t, planets: computePlanets(t).map((p) => ({ ...p, pwChangedAt: P(p.id).pwChangedAt ?? vault.builtAt })) }
}, true)

route('POST', '/api/admin/planets/:id/override', ({ params, body }) => {
  const id = planetIdOf(params.id)
  if (!['unlock', 'lock', 'auto'].includes(body.mode)) fail(400, 'Mode must be unlock, lock or auto.')
  P(id).override = body.mode === 'auto' ? null : body.mode
  save(); return { ok: true }
}, true)

route('POST', '/api/admin/planets/:id/unopen', ({ params }) => {
  P(planetIdOf(params.id)).opened_at = null
  save(); return { ok: true }
}, true)

route('PUT', '/api/admin/planets/:id/name', ({ params, body }) => {
  const id = planetIdOf(params.id)
  P(id).name = str(body.name, { max: 40, name: 'Name' })
  save(); return { ok: true }
}, true)

route('GET', '/api/admin/letters', () => {
  const s = load()
  return {
    letters: Array.from({ length: COUNT }, (_, i) => {
      const id = i + 1
      const l = s.letters[id]?.edited ? s.letters[id] : adminContent.letters[i]
      return { id, title: l.title, body: l.body, updatedAt: s.letters[id]?.updated_at ?? vault.builtAt }
    })
  }
}, true)

route('PUT', '/api/admin/letters/:id', ({ params, body }) => {
  const id = planetIdOf(params.id)
  const title = str(body.title, { max: 120, name: 'Title' })
  const text = str(body.body, { max: 8000, name: 'Letter text' })
  load().letters[id] = { title, body: text, updated_at: now(), edited: true }
  save(); return { ok: true }
}, true)

route('GET', '/api/admin/gifts', () => {
  const s = load()
  return {
    gifts: giftsState().map((g) => {
      const base = adminContent.gifts.find((x) => x.id === g.id) || {}
      return s.gifts[g.id]?.edited ? g : { ...g, title: base.title ?? g.title, body: base.body ?? g.body }
    })
  }
}, true)

route('PUT', '/api/admin/gifts/:id', ({ params, body }) => {
  const id = Number(params.id)
  if (!vault.giftMeta.some((g) => g.id === id)) fail(404, 'Gift not found.')
  const s = load()
  s.gifts[id] = {
    ...(s.gifts[id] || {}),
    title: str(body.title, { max: 120, name: 'Title' }),
    body: str(body.body, { max: 2000, name: 'Description' }),
    enabled: !!body.enabled, edited: true
  }
  save(); return { ok: true }
}, true)

route('POST', '/api/admin/gifts/:id/reset', ({ params }) => {
  const id = Number(params.id)
  const s = load()
  if (s.gifts[id]) s.gifts[id].opened_at = null
  save(); return { ok: true }
}, true)

route('GET', '/api/admin/countdown', () => {
  const t = now()
  const planets = computePlanets(t)
  return {
    now: t, waitHours: waitMs() / HOUR,
    rows: planets.slice(1).map((p, i) => {
      const prev = planets[i]
      return {
        id: p.id, name: p.name, status: p.status, previousId: prev.id,
        previousOpenedAt: prev.openedAt,
        unlockAt: p.unlockAt,
        remainingMs: p.unlockAt ? Math.max(0, p.unlockAt - t) : null,
        customDelayHours: prev.delayMs == null ? null : prev.delayMs / HOUR
      }
    })
  }
}, true)

route('POST', '/api/admin/countdown/:id', ({ params, body }) => {
  const id = planetIdOf(params.id)
  if (id < 2) fail(400, 'Planet 1 has no countdown.')
  const prevId = id - 1
  const prev = P(prevId)
  const wait = waitMs()
  switch (body.action) {
    case 'restart':
      if (prev.opened_at == null) fail(400, `Planet ${prevId} has not been opened, so there is no timer to restart.`)
      prev.opened_at = now(); break
    case 'add': prev.delay_ms = (prev.delay_ms ?? wait) + hoursToMs(body.hours); break
    case 'set': prev.delay_ms = hoursToMs(body.hours); break
    case 'default': prev.delay_ms = null; break
    default: fail(400, 'Unknown countdown action.')
  }
  save(); return { ok: true }
}, true)

// keep a planet's letter/gifts readable after its password is changed here
function pinContent(id) {
  const s = load()
  if (!s.letters[id] && adminContent) s.letters[id] = { ...adminContent.letters[id - 1], updated_at: vault.builtAt }
  if (id === COUNT && adminContent) for (const g of adminContent.gifts) if (s.gifts[g.id]?.title === undefined) s.gifts[g.id] = { ...(s.gifts[g.id] || {}), title: g.title, body: g.body }
}

route('POST', '/api/admin/passwords/:id', async ({ params, body }) => {
  const id = planetIdOf(params.id)
  const pw = str(body.password, { min: 6, max: 100, name: 'Password' })
  if (await checkAdminPassword(pw)) fail(400, 'A planet password must be different from the admin password.')
  const others = await Promise.all(Array.from({ length: COUNT }, (_, i) => i + 1).filter((n) => n !== id).map(async (n) => ((await checkPlanetPassword(n, pw)) ? n : 0)))
  const clash = others.find(Boolean)
  if (clash) fail(400, `That password is already used by planet ${clash}. Every planet needs its own.`)
  pinContent(id)
  P(id).pwHash = await hashLocal(pw)
  P(id).pwChangedAt = now()
  save(); return { ok: true }
}, true)

route('POST', '/api/admin/passwords/:id/check', async ({ params, body }) => {
  const id = planetIdOf(params.id)
  return { match: typeof body.password === 'string' && !!(await checkPlanetPassword(id, body.password)) }
}, true)

route('GET', '/api/admin/settings', () => ({ waitHours: waitMs() / HOUR, welcomed: !!load().welcomed }), true)
route('PUT', '/api/admin/settings', ({ body }) => {
  const ms = hoursToMs(body.waitHours)
  if (ms < 60_000) fail(400, 'The waiting time must be at least one minute.')
  load().waitMs = ms
  save(); return { ok: true }
}, true)

route('POST', '/api/admin/settings/admin-password', async ({ body }) => {
  const cur = typeof body.current === 'string' ? body.current : ''
  if (!(await checkAdminPassword(cur))) fail(401, 'Current password is incorrect.')
  const next = str(body.next, { min: 10, max: 100, name: 'New password' })
  const clash = await Promise.all(Array.from({ length: COUNT }, (_, i) => checkPlanetPassword(i + 1, next)))
  if (clash.some(Boolean)) fail(400, 'The admin password must be different from every planet password.')
  load().adminHash = await hashLocal(next)
  save(); return { ok: true }
}, true)

route('POST', '/api/admin/reset', ({ body }) => {
  if (body.confirm !== 'RESET') fail(400, 'Type RESET to confirm.')
  const s = load()
  for (const id of Object.keys(s.planets)) { s.planets[id].opened_at = null; s.planets[id].override = null; s.planets[id].delay_ms = null }
  for (const id of Object.keys(s.gifts)) s.gifts[id].opened_at = null
  s.welcomed = false
  save(); return { ok: true }
}, true)

/* ---------------- entry point used by api.js ---------------- */
export async function handle(method, url, body = {}) {
  const path = new URL(url, 'http://x').pathname
  await syncTime()
  for (const r of routes) {
    if (r.method !== method) continue
    const m = r.re.exec(path)
    if (!m) continue
    if (r.admin) requireAdmin()
    const params = {}
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]) })
    return (await r.handler({ params, body })) ?? { ok: true }
  }
  fail(404, 'Not found.')
}
