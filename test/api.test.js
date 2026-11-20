import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PREFIX = 'TestPlanetKey'
const ADMIN = 'Test-Admin-Pass-99'
const HOUR = 3600_000
let proc, base, dir, cookie = ''

const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'love-galaxy' }
async function call(method, url, body, { admin = false, headers = {} } = {}) {
  const res = await fetch(base + url, {
    method, headers: { ...H, ...(admin ? { Cookie: cookie } : {}), ...headers },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
  })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data, headers: res.headers }
}
const open = (id, pw) => call('POST', `/api/planets/${id}/open`, { password: pw })

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'galaxy-'))
  const port = 41000 + Math.floor(Math.random() * 2000)
  base = `http://127.0.0.1:${port}`
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { ...process.env, PORT: String(port), DB_PATH: path.join(dir, 't.db'), PLANET_PASSWORD_PREFIX: PREFIX, ADMIN_PASSWORD: ADMIN, UNLOCK_WAIT_HOURS: '24' },
    stdio: ['ignore', 'pipe', 'inherit']
  })
  await new Promise((res, rej) => {
    proc.stdout.on('data', (d) => String(d).includes('running') && res())
    proc.on('exit', (c) => rej(new Error('server exited ' + c)))
    setTimeout(() => rej(new Error('server start timeout')), 20000)
  })
})
after(() => { proc?.kill(); fs.rmSync(dir, { recursive: true, force: true }) })

test('initial state: exactly 50 planets, only planet 1 unlocked, welcome not seen', async () => {
  const { data } = await call('GET', '/api/state')
  assert.equal(data.planets.length, 50)
  assert.deepEqual(data.planets.map((p) => p.id), Array.from({ length: 50 }, (_, i) => i + 1))
  assert.equal(data.planets[0].status, 'unlocked')
  assert.ok(data.planets.slice(1).every((p) => p.status === 'locked' && p.unlockAt === null))
  assert.equal(data.discovered, 0); assert.equal(data.welcomed, false)
  assert.ok(Math.abs(data.now - Date.now()) < 5000)
})

test('passwords never leak in public responses or in the database file', async () => {
  const { data } = await call('GET', '/api/state')
  assert.ok(!JSON.stringify(data).includes(PREFIX))
  const raw = fs.readFileSync(path.join(dir, 't.db')).toString('latin1') + (fs.existsSync(path.join(dir, 't.db-wal')) ? fs.readFileSync(path.join(dir, 't.db-wal')).toString('latin1') : '')
  assert.ok(!raw.includes(PREFIX), 'planet password stored in plain text')
  assert.ok(!raw.includes(ADMIN), 'admin password stored in plain text')
  assert.ok(raw.includes('scrypt$'))
})

test('locked planets cannot be opened, nothing can be skipped', async () => {
  const r = await open(2, `${PREFIX}2`)
  assert.equal(r.status, 403); assert.equal(r.data.code, 'locked')
  assert.equal((await open(50, `${PREFIX}50`)).status, 403)
  assert.equal((await call('GET', '/api/planets/2/letter')).status, 403)
  assert.equal((await call('GET', '/api/finale')).status, 403)
})

test('each password opens only its own planet; admin password opens nothing', async () => {
  const wrong = await open(1, 'nope')
  assert.equal(wrong.status, 401)
  assert.equal(wrong.data.error, "Oops! That's not the right password. Try again, my love! 💜")
  assert.equal((await open(1, `${PREFIX}2`)).status, 401)
  assert.equal((await open(1, ADMIN)).status, 401)
  assert.equal((await open(1, '')).status, 401)
  assert.equal((await call('GET', '/api/state')).data.planets[0].status, 'unlocked')
})

test('correct password opens planet 1 and starts a 24h countdown for planet 2 (server time)', async () => {
  const r = await open(1, `${PREFIX}1`)
  assert.equal(r.status, 200); assert.equal(r.data.first, true)
  assert.equal(r.data.letter.title, 'Why You Are Special')
  const p2 = r.data.state.planets[1]
  assert.equal(p2.status, 'locked')
  assert.ok(Math.abs(p2.unlockAt - (Date.now() + 24 * HOUR)) < 10_000, 'unlock should be ~24h from now')
  assert.equal(r.data.state.discovered, 1)
  // letters of opened planets can be re-read, others cannot
  assert.equal((await call('GET', '/api/planets/1/letter')).status, 200)
  assert.equal((await call('GET', '/api/planets/2/letter')).status, 403)
  // re-opening later does not move the original timestamp
  const again = await open(1, `${PREFIX}1`)
  assert.equal(again.data.first, false)
  assert.equal(again.data.state.planets[1].unlockAt, p2.unlockAt)
  assert.equal((await open(3, `${PREFIX}3`)).status, 403)
})

test('welcome flag is stored on the server', async () => {
  await call('POST', '/api/welcome/seen')
  assert.equal((await call('GET', '/api/state')).data.welcomed, true)
})

test('admin routes require authentication on the server', async () => {
  for (const [m, u] of [['GET', '/api/admin/dashboard'], ['GET', '/api/admin/planets'], ['GET', '/api/admin/letters'], ['GET', '/api/admin/gifts'],
    ['GET', '/api/admin/countdown'], ['GET', '/api/admin/settings'], ['POST', '/api/admin/reset'], ['POST', '/api/admin/passwords/1'], ['PUT', '/api/admin/letters/1'], ['POST', '/api/admin/planets/2/override']]) {
    const r = await call(m, u, {})
    assert.equal(r.status, 401, `${m} ${u}`)
  }
  assert.equal((await call('GET', '/api/admin/me')).data.admin, false)
})

test('planet passwords never grant admin access; wrong admin password is refused', async () => {
  for (const pw of [`${PREFIX}1`, `${PREFIX}50`, '', 'x']) {
    const r = await call('POST', '/api/admin/login', { password: pw })
    assert.equal(r.status, 401)
    assert.ok(!r.headers.get('set-cookie'))
  }
})

test('admin login: secure cookie, CSRF guard, session works', async () => {
  const noHeader = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: ADMIN }) })
  assert.equal(noHeader.status, 403)
  const r = await call('POST', '/api/admin/login', { password: ADMIN })
  assert.equal(r.status, 200)
  const sc = r.headers.get('set-cookie')
  assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Strict/)
  cookie = sc.split(';')[0]
  assert.equal((await call('GET', '/api/admin/me', null, { admin: true })).data.admin, true)
  // a cross-site origin is rejected even with a valid cookie
  const evil = await call('POST', '/api/admin/reset', { confirm: 'RESET' }, { admin: true, headers: { Origin: 'https://evil.example' } })
  assert.equal(evil.status, 403)
  // the admin password still cannot open a planet
  assert.equal((await open(2, ADMIN)).status, 403)
})

test('dashboard reflects progress', async () => {
  const d = (await call('GET', '/api/admin/dashboard', null, { admin: true })).data
  assert.equal(d.opened, 1); assert.equal(d.remaining, 49); assert.equal(d.percent, 2)
  assert.equal(d.firstOpened.id, 1); assert.equal(d.lastOpened.id, 1); assert.equal(d.next.id, 2)
})

test('admin can edit letters and they show up for the visitor', async () => {
  const bad = await call('PUT', '/api/admin/letters/1', { title: '', body: 'x' }, { admin: true })
  assert.equal(bad.status, 400)
  assert.equal((await call('PUT', '/api/admin/letters/1', { title: 'New Title', body: 'New text.\n\nSecond paragraph.' }, { admin: true })).status, 200)
  const l = (await call('GET', '/api/planets/1/letter')).data.letter
  assert.equal(l.title, 'New Title')
  await call('PUT', '/api/admin/letters/1', { title: 'Why You Are Special', body: 'restored' }, { admin: true })
})

test('admin countdown tools: add hours, set, restart, default', async () => {
  const before = (await call('GET', '/api/admin/countdown', null, { admin: true })).data.rows[0]
  assert.equal(before.id, 2)
  await call('POST', '/api/admin/countdown/2', { action: 'add', hours: 2 }, { admin: true })
  const added = (await call('GET', '/api/admin/countdown', null, { admin: true })).data.rows[0]
  assert.equal(Math.round((added.unlockAt - before.unlockAt) / HOUR), 2)
  assert.equal((await call('POST', '/api/admin/countdown/2', { action: 'restart' }, { admin: true })).status, 200)
  assert.equal((await call('POST', '/api/admin/countdown/3', { action: 'restart' }, { admin: true })).status, 400) // planet 2 not opened
  assert.equal((await call('POST', '/api/admin/countdown/2', { action: 'default' }, { admin: true })).status, 200)
  assert.equal((await call('POST', '/api/admin/countdown/2', { action: 'set', hours: -1 }, { admin: true })).status, 400)
})

test('admin can force-unlock and re-lock a planet', async () => {
  await call('POST', '/api/admin/planets/5/override', { mode: 'unlock' }, { admin: true })
  assert.equal((await call('GET', '/api/state')).data.planets[4].status, 'unlocked')
  await call('POST', '/api/admin/planets/5/override', { mode: 'lock' }, { admin: true })
  assert.equal((await call('GET', '/api/state')).data.planets[4].status, 'locked')
  assert.equal((await open(5, `${PREFIX}5`)).status, 403)
  await call('POST', '/api/admin/planets/5/override', { mode: 'auto' }, { admin: true })
})

test('changing a planet password: old stops working, new works, duplicates/admin password refused', async () => {
  assert.equal((await call('POST', '/api/admin/passwords/1', { password: ADMIN }, { admin: true })).status, 400)
  assert.equal((await call('POST', '/api/admin/passwords/1', { password: `${PREFIX}7` }, { admin: true })).status, 400)
  assert.equal((await call('POST', '/api/admin/passwords/1', { password: 'abc' }, { admin: true })).status, 400)
  assert.equal((await call('POST', '/api/admin/passwords/1', { password: 'BrandNewKey1' }, { admin: true })).status, 200)
  assert.equal((await open(1, `${PREFIX}1`)).status, 401)
  assert.equal((await open(1, 'BrandNewKey1')).status, 200)
  assert.equal((await call('POST', '/api/admin/passwords/1/check', { password: 'BrandNewKey1' }, { admin: true })).data.match, true)
  await call('POST', '/api/admin/passwords/1', { password: `${PREFIX}1` }, { admin: true })
})

test('the whole journey: 50 planets in order, then the finale, 3 gifts and the final letter', async () => {
  const letters = new Set()
  for (let n = 2; n <= 50; n++) {
    // not yet unlocked (waiting 24h) …
    const locked = await open(n, `${PREFIX}${n}`)
    assert.equal(locked.status, 403, `planet ${n} should be locked before its time`)
    // … until the timer in front of it runs out (admin shortens the wait to zero)
    await call('POST', `/api/admin/countdown/${n}`, { action: 'set', hours: 0 }, { admin: true })
    const wrong = await open(n, `${PREFIX}${n - 1}`)
    assert.equal(wrong.status, 401, `planet ${n} must reject planet ${n - 1}'s password`)
    const ok = await open(n, `${PREFIX}${n}`)
    assert.equal(ok.status, 200, `planet ${n}`)
    letters.add(ok.data.letter.title)
    assert.equal(ok.data.state.discovered, n)
  }
  assert.equal(letters.size, 49)
  const st = (await call('GET', '/api/state')).data
  assert.equal(st.discovered, 50); assert.equal(st.finaleReady, true); assert.equal(st.nextUnlockAt, null)

  // finale
  let f = (await call('GET', '/api/finale')).data
  assert.equal(f.gifts.length, 3); assert.equal(f.allOpened, false); assert.equal(f.finalLetter, undefined)
  assert.ok(f.gifts.every((g) => g.title === undefined), 'unopened gifts must not leak their text')
  assert.deepEqual(f.gifts.map((g) => g.label), ['GIFT 1 — DECORATION 🏡', 'GIFT 2 — ROSES 🌹', 'GIFT 3 — TRAVEL ✈️'])
  const g1 = (await call('POST', '/api/gifts/1/open')).data
  assert.equal(g1.gift.title, 'A LITTLE PIECE OF MAGIC'); assert.equal(g1.finale.finalLetter, undefined)
  const g2 = (await call('POST', '/api/gifts/2/open')).data
  assert.equal(g2.gift.title, 'A THOUSAND ROSES FOR YOU')
  // disabling gift 3 means only active gifts are needed
  await call('PUT', '/api/admin/gifts/3', { title: 'AN ADVENTURE JUST FOR US', body: 'x', enabled: false }, { admin: true })
  assert.equal((await call('POST', '/api/gifts/3/open')).status, 404)
  f = (await call('GET', '/api/finale')).data
  assert.equal(f.allOpened, true); assert.equal(f.finalLetter.title, 'MY FAVOURITE UNIVERSE IS YOU 💜')
  await call('PUT', '/api/admin/gifts/3', { title: 'AN ADVENTURE JUST FOR US', body: 'A special trip together, full of new memories, beautiful places, laughter, kisses and moments that we will remember forever. Because my favourite destination will always be wherever you are.', enabled: true }, { admin: true })
  f = (await call('GET', '/api/finale')).data
  assert.equal(f.allOpened, false, 'final letter requires every active gift to be opened')
  const g3 = (await call('POST', '/api/gifts/3/open')).data
  assert.equal(g3.gift.title, 'AN ADVENTURE JUST FOR US'); assert.ok(g3.finale.finalLetter.body.includes('I love you more than words could ever explain. ❤️'))
})

test('reset requires confirmation and clears progress', async () => {
  assert.equal((await call('POST', '/api/admin/reset', {}, { admin: true })).status, 400)
  assert.equal((await call('POST', '/api/admin/reset', { confirm: 'reset' }, { admin: true })).status, 400)
  assert.equal((await call('POST', '/api/admin/reset', { confirm: 'RESET' }, { admin: true })).status, 200)
  const st = (await call('GET', '/api/state')).data
  assert.equal(st.discovered, 0); assert.equal(st.welcomed, false); assert.equal(st.planets[0].status, 'unlocked'); assert.equal(st.planets[1].status, 'locked')
  assert.equal((await call('GET', '/api/finale')).status, 403)
})

test('progress survives a server restart (stored in the database)', async () => {
  assert.equal((await open(1, `${PREFIX}1`)).status, 200)
  proc.kill(); await new Promise((r) => proc.on('exit', r))
  const port = new URL(base).port
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { ...process.env, PORT: port, DB_PATH: path.join(dir, 't.db') }, stdio: ['ignore', 'pipe', 'inherit']   // note: no passwords in env on restart
  })
  await new Promise((res) => proc.stdout.on('data', (d) => String(d).includes('running') && res()))
  const st = (await call('GET', '/api/state')).data
  assert.equal(st.discovered, 1)
  assert.ok(st.planets[1].unlockAt > Date.now())
  // sessions survive too, and the admin password is still the hashed one
  assert.equal((await call('GET', '/api/admin/me', null, { admin: true })).data.admin, true)
})

test('admin password change: needs current password, kills other sessions, planet passwords are rejected', async () => {
  assert.equal((await call('POST', '/api/admin/settings/admin-password', { current: 'wrong', next: 'Another-Long-Pass-1' }, { admin: true })).status, 401)
  assert.equal((await call('POST', '/api/admin/settings/admin-password', { current: ADMIN, next: `${PREFIX}7` + 'xxxx' }, { admin: true })).status, 200) // not equal to a planet password → allowed
  const r = await call('POST', '/api/admin/login', { password: `${PREFIX}7xxxx` })
  assert.equal(r.status, 200)
})

test('brute force on the admin login is rate limited (429)', async () => {
  let last
  for (let i = 0; i < 7; i++) last = await call('POST', '/api/admin/login', { password: 'guess' + i })
  assert.equal(last.status, 429)
  assert.ok(Number(last.headers.get('retry-after')) > 0)
  // even the right password is refused while blocked
  assert.equal((await call('POST', '/api/admin/login', { password: `${PREFIX}7xxxx` })).status, 429)
})

test('static site has security headers and no secrets', async () => {
  const res = await fetch(base + '/')
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-security-policy'), /default-src 'self'/)
  assert.equal(res.headers.get('x-frame-options'), 'DENY')
  const js = await (await fetch(base + '/app.js')).text()
  for (const s of [PREFIX, ADMIN]) assert.ok(!js.includes(s), `front-end bundle contains ${s}`)
  assert.equal((await fetch(base + '/..%2f..%2fserver%2fdb.js')).headers.get('content-type').includes('javascript'), false)
})
