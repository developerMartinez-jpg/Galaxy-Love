// Builds client/src/generated/vault.json for the static (GitHub Pages) version.
// Every letter is ENCRYPTED (AES-256-GCM, key = PBKDF2 of its planet password), so the published site
// never contains the letters in plain text and a planet only opens with its own password.
// Passwords come from PLANET_PASSWORD_PREFIX / ADMIN_PASSWORD (.env locally, or GitHub Actions secrets).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import '../server/env.js'
import { ROOT } from '../server/env.js'
import { PLANET_COUNT, PLANET_NAMES, LETTERS, GIFTS, FINALE_TEXT } from '../server/content/index.js'

export const ITER = 200_000
const prefix = process.env.PLANET_PASSWORD_PREFIX
const admin = process.env.ADMIN_PASSWORD
if (!prefix || !admin) {
  console.error('\n✗ Faltan PLANET_PASSWORD_PREFIX y/o ADMIN_PASSWORD.\n  En local: ponlas en .env (copia .env.example).\n  En GitHub: Settings → Secrets and variables → Actions → New repository secret.\n')
  process.exit(1)
}

function seal(password, obj) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12)
  const key = crypto.pbkdf2Sync(password, salt, ITER, 32, 'sha256')
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final(), c.getAuthTag()])
  return { s: salt.toString('base64'), i: iv.toString('base64'), c: ct.toString('base64') }
}

const planets = []
for (let n = 1; n <= PLANET_COUNT; n++) {
  const payload = { letter: LETTERS[n - 1] }
  if (n === PLANET_COUNT) payload.gifts = GIFTS.map((g) => ({ id: g.id, title: g.title, body: g.body }))
  planets.push(seal(`${prefix}${n}`, payload))
}
const vault = {
  iter: ITER,
  names: PLANET_NAMES,
  finale: FINALE_TEXT,
  giftMeta: GIFTS.map((g) => ({ id: g.id, kind: g.kind, label: g.label })),
  planets,
  admin: seal(admin, { letters: LETTERS, gifts: GIFTS }),
  builtAt: Date.now()
}
const out = path.join(ROOT, 'client/src/generated')
fs.mkdirSync(out, { recursive: true })
fs.writeFileSync(path.join(out, 'vault.json'), JSON.stringify(vault))
console.log('✓ vault cifrado generado (50 planetas)')
