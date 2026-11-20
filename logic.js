// Pure-ish game rules. Everything time-related uses the SERVER clock passed in as `now`.
import { db, getSetting } from './db.js'
import { PLANET_COUNT } from './content/index.js'

export const getWaitMs = () => Number(getSetting('wait_ms', 24 * 3600_000))

/**
 * Planet N becomes available `delay` after planet N-1 was correctly opened
 * (delay = planet N-1's custom delay, or the global wait, 24h by default).
 * Admin overrides ('unlock' / 'lock') win over the natural schedule.
 */
export function computePlanets(now = Date.now()) {
  const rows = db.prepare('SELECT id,name,override,opened_at,delay_ms FROM planets ORDER BY id').all()
  const wait = getWaitMs()
  return rows.map((p, i) => {
    let availableAt = null
    if (p.id === 1) availableAt = 0
    else {
      const prev = rows[i - 1]
      if (prev.opened_at != null) availableAt = prev.opened_at + (prev.delay_ms ?? wait)
    }
    const natural = availableAt !== null && now >= availableAt
    const unlocked = p.override === 'lock' ? false : p.override === 'unlock' ? true : natural
    const opened = p.opened_at != null
    const status = !unlocked ? 'locked' : opened ? 'opened' : 'unlocked'
    return {
      id: p.id, name: p.name, status, override: p.override,
      openedAt: p.opened_at, delayMs: p.delay_ms,
      // when a locked planet will unlock on its own (null = waiting for the previous planet to be opened)
      unlockAt: !unlocked && availableAt ? availableAt : null,
      availableAt
    }
  })
}

export function publicState(now = Date.now()) {
  const planets = computePlanets(now)
  const discovered = planets.filter((p) => p.status === 'opened').length
  const upcoming = planets.filter((p) => p.status === 'locked' && p.unlockAt).map((p) => p.unlockAt)
  const finaleReady = planets[PLANET_COUNT - 1].status === 'opened'
  return {
    now,
    welcomed: getSetting('welcomed', '0') === '1',
    total: PLANET_COUNT,
    discovered,
    nextUnlockAt: upcoming.length ? Math.min(...upcoming) : null,
    finaleReady,
    planets: planets.map((p) => ({ id: p.id, name: p.name, status: p.status, unlockAt: p.unlockAt }))
  }
}

export const planetStatus = (id, now = Date.now()) => computePlanets(now).find((p) => p.id === id)

export function giftsState() {
  return db.prepare('SELECT id,kind,label,title,body,enabled,opened_at FROM gifts ORDER BY id').all()
}

export function allEnabledGiftsOpened() {
  const g = giftsState().filter((x) => x.enabled)
  return g.every((x) => x.opened_at != null)
}
