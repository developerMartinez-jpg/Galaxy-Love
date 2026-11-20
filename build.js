// Bundles the React client with esbuild into /public.
//   node scripts/build.js            -> STATIC build (GitHub Pages: no server, data kept in the browser)
//   node scripts/build.js --server   -> build that talks to server/index.js (Node + SQLite)
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const isStatic = !process.argv.includes('--server')
fs.mkdirSync(path.join(root, 'public'), { recursive: true })

if (isStatic) execFileSync(process.execPath, [path.join(root, 'scripts/make-vault.js')], { stdio: 'inherit' })
else {
  // the server build never imports the vault, but the import must still resolve
  const g = path.join(root, 'client/src/generated')
  fs.mkdirSync(g, { recursive: true })
  if (!fs.existsSync(path.join(g, 'vault.json'))) fs.writeFileSync(path.join(g, 'vault.json'), '{}')
}

await build({
  entryPoints: { app: path.join(root, 'client/src/main.jsx') },
  outdir: path.join(root, 'public'),
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['es2020'],
  jsx: 'automatic',
  loader: { '.jsx': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"', __STATIC__: String(isStatic) },
  logLevel: 'info'
})
fs.copyFileSync(path.join(root, 'client/index.html'), path.join(root, 'public/index.html'))
fs.writeFileSync(path.join(root, 'public/.nojekyll'), '')
if (isStatic) {
  // GitHub Pages "Deploy from a branch" serves the repo root: publish the site there too.
  // (Only ciphertext is inside app.js, so committing it is safe.)
  for (const f of ['index.html', 'app.js', 'app.css', '.nojekyll']) fs.copyFileSync(path.join(root, 'public', f), path.join(root, f))
}
console.log(`✓ client built into /public (${isStatic ? 'static / GitHub Pages' : 'server mode'})`)
