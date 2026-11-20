import crypto from 'node:crypto'

/* ---------- Password hashing (scrypt, salted, constant-time compare) ---------- */
const KEYLEN = 64
const scryptAsync = (pw, salt) =>
  new Promise((res, rej) => crypto.scrypt(pw, salt, KEYLEN, (e, k) => (e ? rej(e) : res(k))))

export function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16)
  const key = crypto.scryptSync(password, salt, KEYLEN)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const key = await scryptAsync(password, salt)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}

// A throw-away hash so verification takes the same time even when nothing is stored.
const DUMMY = hashPasswordSync('dummy-value-for-timing')

export async function verifyPassword(password, stored) {
  const parts = String(stored || DUMMY).split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'base64')
  const expected = Buffer.from(parts[2], 'base64')
  const actual = await scryptAsync(String(password), salt)
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) && !!stored
}

/* ---------- Tokens / sessions ---------- */
export const newToken = () => crypto.randomBytes(32).toString('base64url')
export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

export function parseCookies(header = '') {
  const out = {}
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function cookie(name, value, { maxAge, secure }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAge}`,
    secure ? 'Secure' : ''
  ].filter(Boolean).join('; ')
}

/* ---------- Rate limiting ---------- */
export class Limiter {
  // max failures within windowMs; once exceeded, blocked for blockMs
  constructor({ max, windowMs, blockMs }) {
    Object.assign(this, { max, windowMs, blockMs })
    this.map = new Map()
    setInterval(() => this.sweep(), 60_000).unref()
  }
  sweep() {
    const t = Date.now()
    for (const [k, v] of this.map) if (v.blockedUntil < t && v.first + this.windowMs < t) this.map.delete(k)
  }
  // returns ms to wait (0 = allowed)
  check(key) {
    const v = this.map.get(key)
    if (!v) return 0
    const t = Date.now()
    return v.blockedUntil > t ? v.blockedUntil - t : 0
  }
  fail(key) {
    const t = Date.now()
    let v = this.map.get(key)
    if (!v || v.first + this.windowMs < t) v = { fails: 0, first: t, blockedUntil: 0 }
    v.fails += 1
    if (v.fails >= this.max) v.blockedUntil = t + this.blockMs
    this.map.set(key, v)
  }
  success(key) { this.map.delete(key) }
}
