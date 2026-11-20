import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from './env.js'
import { hashPassword } from './security.js'
import { PLANET_COUNT, PLANET_NAMES, LETTERS, GIFTS } from './content/index.js'

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true })
export const db = new DatabaseSync(config.dbPath)
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')

db.exec(`
CREATE TABLE IF NOT EXISTS planets (
  id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND ${PLANET_COUNT}),
  name TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  pw_changed_at INTEGER NOT NULL,
  override TEXT CHECK (override IN ('unlock','lock')),   -- manual admin override
  opened_at INTEGER,                                      -- server time (ms) of first correct password
  delay_ms INTEGER                                        -- custom wait before the NEXT planet unlocks (NULL = default)
);
CREATE TABLE IF NOT EXISTS letters (
  planet_id INTEGER PRIMARY KEY REFERENCES planets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gifts (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  opened_at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
`)

export const getSetting = (key, fallback = null) => {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return r ? r.value : fallback
}
export const setSetting = (key, value) =>
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value))

export function tx(fn) {
  db.exec('BEGIN IMMEDIATE')
  try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { db.exec('ROLLBACK'); throw e }
}

/**
 * First-run seeding. Passwords are read from the environment ONCE, hashed (scrypt) and never stored in plain text.
 *   PLANET_PASSWORD_PREFIX  -> planet N password = prefix + N
 *   ADMIN_PASSWORD          -> administrator master password
 */
export async function seed() {
  const now = Date.now()

  if (db.prepare('SELECT COUNT(*) c FROM planets').get().c === 0) {
    const prefix = process.env.PLANET_PASSWORD_PREFIX
    if (!prefix) throw new Error('PLANET_PASSWORD_PREFIX is not set (see .env.example). It is needed once, to create the planet password hashes.')
    const hashes = []
    for (let i = 1; i <= PLANET_COUNT; i++) hashes.push(await hashPassword(`${prefix}${i}`))
    tx(() => {
      const ins = db.prepare('INSERT INTO planets(id,name,pw_hash,pw_changed_at) VALUES(?,?,?,?)')
      const insL = db.prepare('INSERT INTO letters(planet_id,title,body,updated_at) VALUES(?,?,?,?)')
      for (let i = 1; i <= PLANET_COUNT; i++) {
        ins.run(i, PLANET_NAMES[i - 1], hashes[i - 1], now)
        insL.run(i, LETTERS[i - 1].title, LETTERS[i - 1].body, now)
      }
    })
  }

  if (db.prepare('SELECT COUNT(*) c FROM gifts').get().c === 0) {
    tx(() => {
      const ins = db.prepare('INSERT INTO gifts(id,kind,label,title,body,enabled) VALUES(?,?,?,?,?,1)')
      for (const g of GIFTS) ins.run(g.id, g.kind, g.label, g.title, g.body)
    })
  }

  if (!getSetting('admin_hash')) {
    const pw = process.env.ADMIN_PASSWORD
    if (!pw) throw new Error('ADMIN_PASSWORD is not set (see .env.example). It is needed once, to create the admin password hash.')
    setSetting('admin_hash', await hashPassword(pw))
  }
  if (getSetting('wait_ms') === null) setSetting('wait_ms', Math.round(config.defaultWaitHours * 3600_000))
  if (getSetting('welcomed') === null) setSetting('welcomed', '0')
}
