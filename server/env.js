// Tiny .env loader (no dependency). Real environment variables always win over the file.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const file = path.join(ROOT, '.env')
if (fs.existsSync(file)) {
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i)
    if (!m || line.trim().startsWith('#')) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || path.join(ROOT, 'data', 'galaxy.db'),
  production: process.env.NODE_ENV === 'production',
  trustProxy: process.env.TRUST_PROXY === '1',
  defaultWaitHours: Number(process.env.UNLOCK_WAIT_HOURS || 24)
}
