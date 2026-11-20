import { handle } from './localApi.js'

async function call(method, url, body) {
  if (__STATIC__) return handle(method, url, body)
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'love-galaxy' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
  })
  let data = {}
  try { data = await res.json() } catch { /* empty */ }
  if (!res.ok) {
    const e = new Error(data.error || 'Something went wrong. Please try again.')
    e.status = res.status
    e.data = data
    throw e
  }
  return data
}
export const api = {
  get: (u) => call('GET', u),
  post: (u, b) => call('POST', u, b),
  put: (u, b) => call('PUT', u, b)
}

// Server-time clock: the countdown never trusts the device clock.
let offset = 0
export const syncClock = (serverNow) => { offset = serverNow - Date.now() }
export const serverNow = () => Date.now() + offset

export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n) => String(n).padStart(2, '0')
  return `${p(h)} : ${p(m)} : ${p(sec)}`
}
