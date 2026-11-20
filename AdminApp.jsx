import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const fmtDate = (ms) => (ms ? new Date(ms).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'medium' }) : '—')
const fmtDur = (ms) => {
  if (ms == null) return '—'
  const s = Math.max(0, Math.floor(ms / 1000)), p = (n) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/* ---------- tiny hooks ---------- */
function useToast() {
  const [t, setT] = useState(null)
  const show = useCallback((msg, kind = 'ok') => { setT({ msg, kind, k: Date.now() }); setTimeout(() => setT((c) => (c && Date.now() - c.k >= 2900 ? null : c)), 3000) }, [])
  return [t, show]
}
function useLoad(url, deps = []) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const reload = useCallback(() => api.get(url).then((d) => { setData(d); setErr('') }).catch((e) => setErr(e.message)), [url])
  useEffect(() => { reload() }, [reload, ...deps]) // eslint-disable-line
  return { data, err, reload }
}
function useClock(serverNow) {
  const offset = useMemo(() => (serverNow ? serverNow - Date.now() : 0), [serverNow])
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i) }, [])
  return Date.now() + offset
}

/* ---------- login ---------- */
function Login({ onDone }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api.post('/api/admin/login', { password: pw }); setPw(''); onDone() }
    catch (x) { setErr(x.message); setPw('') }
    setBusy(false)
  }
  return (
    <div className="adm adm-login">
      <form className="adm-login-card" onSubmit={submit}>
        <div className="adm-lock" aria-hidden="true">🔐</div>
        <h1>Administrator Access</h1>
        <label htmlFor="mp">Master Password</label>
        <input id="mp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus maxLength={200} />
        {err && <div className="adm-err" role="alert">{err}</div>}
        <button className="adm-btn primary" disabled={busy || !pw}>{busy ? '...' : 'LOGIN'}</button>
        <a className="adm-back" href="#/">← Back to the website</a>
      </form>
    </div>
  )
}

/* ---------- shared UI ---------- */
const Stat = ({ label, value, sub }) => (
  <div className="adm-stat"><div className="adm-stat-label">{label}</div><div className="adm-stat-value">{value}</div>{sub && <div className="adm-stat-sub">{sub}</div>}</div>
)
const Card = ({ title, children, actions }) => (
  <section className="adm-card">{(title || actions) && <header><h3>{title}</h3><div>{actions}</div></header>}{children}</section>
)
const Badge = ({ status }) => <span className={`adm-badge ${status}`}>{status === 'opened' ? 'Opened' : status === 'unlocked' ? 'Unlocked' : 'Locked'}</span>

/* ---------- sections ---------- */
function Dashboard({ toast }) {
  const { data, err } = useLoad('/api/admin/dashboard')
  useEffect(() => { if (err) toast(err, 'err') }, [err, toast])
  const now = useClock(data?.now)
  if (!data) return <p className="adm-muted">Loading...</p>
  return (
    <>
      <div className="adm-grid stats">
        <Stat label="Unlocked planets" value={data.unlocked} sub={`of ${data.total}`} />
        <Stat label="Opened planets" value={data.opened} sub="correct password entered" />
        <Stat label="Remaining planets" value={data.remaining} />
        <Stat label="Progress" value={`${data.percent}%`} />
      </div>
      <div className="adm-bar"><div style={{ width: `${data.percent}%` }} /></div>
      <div className="adm-grid two">
        <Card title="Timeline">
          <dl className="adm-dl">
            <dt>First planet opened</dt><dd>{data.firstOpened ? `#${data.firstOpened.id} ${data.firstOpened.name} — ${fmtDate(data.firstOpened.at)}` : 'Not yet'}</dd>
            <dt>Last planet opened</dt><dd>{data.lastOpened ? `#${data.lastOpened.id} ${data.lastOpened.name} — ${fmtDate(data.lastOpened.at)}` : 'Not yet'}</dd>
            <dt>Next automatic unlock</dt><dd>{data.next ? `#${data.next.id} ${data.next.name} in ${fmtDur(data.next.at - now)}` : 'Nothing scheduled'}</dd>
            <dt>Welcome screen seen</dt><dd>{data.welcomed ? 'Yes' : 'Not yet'}</dd>
            <dt>Default waiting time</dt><dd>{data.waitHours} hours</dd>
            <dt>Server time</dt><dd>{fmtDate(now)}</dd>
          </dl>
        </Card>
      </div>
    </>
  )
}

function Planets({ toast }) {
  const { data, reload, err } = useLoad('/api/admin/planets')
  const [filter, setFilter] = useState('all')
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload() } catch (e) { toast(e.message, 'err') } }
  if (err) return <p className="adm-err">{err}</p>
  if (!data) return <p className="adm-muted">Loading...</p>
  const rows = data.planets.filter((p) => filter === 'all' || p.status === filter)
  return (
    <Card title="All 50 planets" actions={
      <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
        <option value="all">All</option><option value="opened">Opened</option><option value="unlocked">Unlocked, not opened</option><option value="locked">Locked</option>
      </select>}>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>#</th><th>Name</th><th>Status</th><th>Opened at</th><th>Manual override</th><th>Actions</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.name}</td><td><Badge status={p.status} /></td><td>{fmtDate(p.openedAt)}</td>
                <td>{p.override === 'unlock' ? 'Forced unlocked' : p.override === 'lock' ? 'Forced locked' : 'Automatic'}</td>
                <td className="adm-actions">
                  <button className="adm-btn" onClick={() => act(() => api.post(`/api/admin/planets/${p.id}/override`, { mode: 'unlock' }), `Planet ${p.id} unlocked`)}>Unlock</button>
                  <button className="adm-btn" onClick={() => act(() => api.post(`/api/admin/planets/${p.id}/override`, { mode: 'lock' }), `Planet ${p.id} locked`)}>Lock</button>
                  {p.override && <button className="adm-btn ghost" onClick={() => act(() => api.post(`/api/admin/planets/${p.id}/override`, { mode: 'auto' }), `Planet ${p.id} is automatic again`)}>Auto</button>}
                  {p.openedAt && <button className="adm-btn ghost" onClick={() => confirm(`Mark planet ${p.id} as not opened?`) && act(() => api.post(`/api/admin/planets/${p.id}/unopen`), `Planet ${p.id} marked as not opened`)}>Un-open</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="adm-note">“Lock” hides the planet behind its padlock again. “Auto” returns it to the normal 24-hour schedule.</p>
    </Card>
  )
}

function Letters({ toast }) {
  const { data, reload } = useLoad('/api/admin/letters')
  const planets = useLoad('/api/admin/planets')
  const [sel, setSel] = useState(1)
  const [form, setForm] = useState({ title: '', body: '' })
  const [dirty, setDirty] = useState(false)
  const current = data?.letters.find((l) => l.id === sel)
  useEffect(() => { if (current) { setForm({ title: current.title, body: current.body }); setDirty(false) } }, [current?.id, current?.updatedAt]) // eslint-disable-line
  if (!data) return <p className="adm-muted">Loading...</p>
  const words = form.body.trim() ? form.body.trim().split(/\s+/).length : 0
  const save = async () => {
    try { await api.put(`/api/admin/letters/${sel}`, form); toast(`Letter ${sel} saved`); setDirty(false); reload() } catch (e) { toast(e.message, 'err') }
  }
  const go = (id) => { if (dirty && !confirm('Discard unsaved changes?')) return; setSel(id) }
  const name = planets.data?.planets.find((p) => p.id === sel)?.name
  return (
    <div className="adm-split">
      <Card title="Letters">
        <ul className="adm-list">
          {data.letters.map((l) => <li key={l.id}><button className={l.id === sel ? 'active' : ''} onClick={() => go(l.id)}><b>{l.id}</b><span>{l.title}</span></button></li>)}
        </ul>
      </Card>
      <Card title={`Planet ${sel}${name ? ` · ${name}` : ''}`} actions={<span className="adm-muted">{words} words</span>}>
        <label className="adm-label">Title</label>
        <input className="adm-input" value={form.title} maxLength={120} onChange={(e) => { setForm({ ...form, title: e.target.value }); setDirty(true) }} />
        <label className="adm-label">Letter text <small>(leave a blank line between paragraphs)</small></label>
        <textarea className="adm-input" rows={16} value={form.body} onChange={(e) => { setForm({ ...form, body: e.target.value }); setDirty(true) }} />
        <div className="adm-row"><button className="adm-btn primary" onClick={save} disabled={!dirty}>Save letter</button>{dirty && <span className="adm-muted">Unsaved changes</span>}</div>
        {sel === 50 && <p className="adm-note">Letter 50 is the final letter shown after the three gifts are opened.</p>}
      </Card>
    </div>
  )
}

function Gifts({ toast }) {
  const { data, reload } = useLoad('/api/admin/gifts')
  const [edits, setEdits] = useState({})
  if (!data) return <p className="adm-muted">Loading...</p>
  const val = (g) => ({ title: g.title, body: g.body, enabled: !!g.enabled, ...(edits[g.id] || {}) })
  const set = (g, patch) => setEdits({ ...edits, [g.id]: { ...val(g), ...patch } })
  const save = async (g) => {
    try { await api.put(`/api/admin/gifts/${g.id}`, val(g)); toast(`${g.label.split('—')[0].trim()} saved`); setEdits((e) => { const n = { ...e }; delete n[g.id]; return n }); reload() } catch (e) { toast(e.message, 'err') }
  }
  return (
    <div className="adm-grid three">
      {data.gifts.map((g) => {
        const v = val(g)
        return (
          <Card key={g.id} title={g.label}>
            <p className="adm-muted">{g.opened_at ? `Opened on ${fmtDate(g.opened_at)}` : 'Not opened yet'}</p>
            <label className="adm-label">Title</label>
            <input className="adm-input" value={v.title} maxLength={120} onChange={(e) => set(g, { title: e.target.value })} />
            <label className="adm-label">Description</label>
            <textarea className="adm-input" rows={6} value={v.body} onChange={(e) => set(g, { body: e.target.value })} />
            <label className="adm-check"><input type="checkbox" checked={v.enabled} onChange={(e) => set(g, { enabled: e.target.checked })} /> Gift is active</label>
            <div className="adm-row">
              <button className="adm-btn primary" disabled={!edits[g.id]} onClick={() => save(g)}>Save</button>
              {g.opened_at && <button className="adm-btn ghost" onClick={async () => { await api.post(`/api/admin/gifts/${g.id}/reset`); toast('Gift closed again'); reload() }}>Close again</button>}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function Countdown({ toast }) {
  const { data, reload, err } = useLoad('/api/admin/countdown')
  const now = useClock(data?.now)
  const [hours, setHours] = useState({})
  if (err) return <p className="adm-err">{err}</p>
  if (!data) return <p className="adm-muted">Loading...</p>
  const run = async (id, body, msg) => { try { await api.post(`/api/admin/countdown/${id}`, body); toast(msg); reload() } catch (e) { toast(e.message, 'err') } }
  return (
    <Card title="Countdowns" actions={<span className="adm-muted">Default wait: {data.waitHours} h</span>}>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Planet</th><th>Status</th><th>Time left</th><th>Unlocks at</th><th>Wait after previous</th><th>Adjust</th></tr></thead>
          <tbody>
            {data.rows.filter((r) => r.status !== 'opened' || r.unlockAt).map((r) => (
              <tr key={r.id}>
                <td>{r.id} · {r.name}</td>
                <td><Badge status={r.status} /></td>
                <td className="mono">{r.unlockAt ? fmtDur(r.unlockAt - now) : r.status === 'locked' ? <span className="adm-muted">Waiting for planet {r.previousId}</span> : '—'}</td>
                <td>{r.unlockAt ? fmtDate(r.unlockAt) : '—'}</td>
                <td>{r.customDelayHours == null ? 'Default' : `${r.customDelayHours} h (custom)`}</td>
                <td className="adm-actions">
                  <input className="adm-input tiny" type="number" min="0" step="0.5" placeholder="hours" value={hours[r.id] ?? ''} onChange={(e) => setHours({ ...hours, [r.id]: e.target.value })} aria-label={`Hours for planet ${r.id}`} />
                  <button className="adm-btn" disabled={!hours[r.id]} onClick={() => run(r.id, { action: 'add', hours: hours[r.id] }, `Added ${hours[r.id]} h`)}>+ Add</button>
                  <button className="adm-btn" disabled={hours[r.id] === undefined || hours[r.id] === ''} onClick={() => run(r.id, { action: 'set', hours: hours[r.id] }, 'Waiting time changed')}>Set total</button>
                  <button className="adm-btn" disabled={r.previousOpenedAt == null} onClick={() => run(r.id, { action: 'restart' }, 'Timer restarted')}>Restart</button>
                  {r.customDelayHours != null && <button className="adm-btn ghost" onClick={() => run(r.id, { action: 'default' }, 'Back to the default wait')}>Default</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="adm-note"><b>+ Add</b> extends the wait by that many hours · <b>Set total</b> replaces the wait (counted from when the previous planet was opened) · <b>Restart</b> starts the full wait again from now.</p>
    </Card>
  )
}

function Passwords({ toast }) {
  const { data, reload } = useLoad('/api/admin/planets')
  const [vals, setVals] = useState({})
  const [tests, setTests] = useState({})
  const [res, setRes] = useState({})
  if (!data) return <p className="adm-muted">Loading...</p>
  const setPw = async (id) => {
    try { await api.post(`/api/admin/passwords/${id}`, { password: vals[id] }); toast(`Password of planet ${id} changed`); setVals({ ...vals, [id]: '' }); reload() } catch (e) { toast(e.message, 'err') }
  }
  const test = async (id) => {
    try { const r = await api.post(`/api/admin/passwords/${id}/check`, { password: tests[id] }); setRes({ ...res, [id]: r.match ? 'match' : 'nomatch' }) } catch (e) { toast(e.message, 'err') }
  }
  return (
    <Card title="Planet passwords">
      <p className="adm-note top">Passwords are stored only as salted scrypt hashes, so they cannot be displayed. You can <b>replace</b> any password, or <b>test</b> a guess against a planet. Each password opens only its own planet and can never open the admin panel.</p>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>#</th><th>Planet</th><th>Last changed</th><th>New password</th><th>Test a password</th></tr></thead>
          <tbody>
            {data.planets.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td><td>{p.name}</td><td>{fmtDate(p.pwChangedAt)}</td>
                <td className="adm-actions"><input className="adm-input small" type="text" autoComplete="off" value={vals[p.id] ?? ''} onChange={(e) => setVals({ ...vals, [p.id]: e.target.value })} placeholder="min. 6 characters" />
                  <button className="adm-btn" disabled={(vals[p.id] || '').length < 6} onClick={() => setPw(p.id)}>Change</button></td>
                <td className="adm-actions"><input className="adm-input small" type="text" autoComplete="off" value={tests[p.id] ?? ''} onChange={(e) => { setTests({ ...tests, [p.id]: e.target.value }); setRes({ ...res, [p.id]: null }) }} />
                  <button className="adm-btn ghost" disabled={!tests[p.id]} onClick={() => test(p.id)}>Check</button>
                  {res[p.id] && <span className={res[p.id] === 'match' ? 'ok' : 'bad'}>{res[p.id] === 'match' ? '✓ matches' : '✗ no match'}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Settings({ toast }) {
  const { data, reload } = useLoad('/api/admin/settings')
  const [wait, setWait] = useState('')
  const [pw, setPw] = useState({ current: '', next: '', again: '' })
  const [confirmReset, setConfirmReset] = useState(false)
  const [typed, setTyped] = useState('')
  useEffect(() => { if (data) setWait(String(data.waitHours)) }, [data])
  if (!data) return <p className="adm-muted">Loading...</p>
  const saveWait = async () => { try { await api.put('/api/admin/settings', { waitHours: wait }); toast('Default waiting time saved'); reload() } catch (e) { toast(e.message, 'err') } }
  const changePw = async () => {
    if (pw.next !== pw.again) return toast('The new passwords do not match', 'err')
    try { await api.post('/api/admin/settings/admin-password', { current: pw.current, next: pw.next }); setPw({ current: '', next: '', again: '' }); toast('Admin password changed') } catch (e) { toast(e.message, 'err') }
  }
  const reset = async () => {
    try { await api.post('/api/admin/reset', { confirm: 'RESET' }); setConfirmReset(false); setTyped(''); toast('The whole experience has been reset'); reload() } catch (e) { toast(e.message, 'err') }
  }
  return (
    <div className="adm-grid two">
      <Card title="Unlock schedule">
        <label className="adm-label">Default waiting time between planets (hours)</label>
        <div className="adm-row"><input className="adm-input small" type="number" min="0.02" step="0.5" value={wait} onChange={(e) => setWait(e.target.value)} /><button className="adm-btn primary" onClick={saveWait}>Save</button></div>
        <p className="adm-note">Applies to every planet without a custom wait. Use a tiny value (for example 0.05 h = 3 minutes) to test the whole journey.</p>
      </Card>
      <Card title="Administrator password">
        <label className="adm-label">Current password</label><input className="adm-input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        <label className="adm-label">New password (min. 10 characters)</label><input className="adm-input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
        <label className="adm-label">Repeat new password</label><input className="adm-input" type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
        <div className="adm-row"><button className="adm-btn primary" disabled={!pw.current || !pw.next} onClick={changePw}>Change password</button></div>
      </Card>
      <Card title="Reset experience">
        <p className="adm-note top">Closes every planet and gift, clears all timers and manual overrides, and shows the welcome screen again. Letters, gifts and passwords are kept.</p>
        <button className="adm-btn danger" onClick={() => setConfirmReset(true)}>Reset the whole experience…</button>
      </Card>
      {confirmReset && (
        <div className="adm-modal" role="dialog" aria-modal="true">
          <div className="adm-modal-card">
            <h3>Reset everything?</h3>
            <p>All progress will be lost. This cannot be undone. Type <b>RESET</b> to confirm.</p>
            <input className="adm-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
            <div className="adm-row"><button className="adm-btn" onClick={() => { setConfirmReset(false); setTyped('') }}>Cancel</button><button className="adm-btn danger" disabled={typed !== 'RESET'} onClick={reset}>Yes, reset</button></div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- shell ---------- */
const MENU = [['dashboard', 'Dashboard', '▦'], ['planets', 'Planets', '◍'], ['letters', 'Love Letters', '✉'], ['gifts', 'Gifts', '❖'], ['countdown', 'Countdown', '◔'], ['passwords', 'Passwords', '✱'], ['settings', 'Settings', '⚙']]
const VIEWS = { dashboard: Dashboard, planets: Planets, letters: Letters, gifts: Gifts, countdown: Countdown, passwords: Passwords, settings: Settings }

export default function AdminApp() {
  const [authed, setAuthed] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [toastState, toast] = useToast()

  useEffect(() => { api.get('/api/admin/me').then((r) => setAuthed(r.admin)).catch(() => setAuthed(false)) }, [])
  useEffect(() => { document.title = 'Admin'; return () => { document.title = '50 Planets, 50 Reasons to Love You' } }, [])

  // if the session expires mid-use, the server answers 401 and we go back to the login screen
  const guardedToast = useCallback((msg, kind) => { if (/authentication required/i.test(msg)) setAuthed(false); else toast(msg, kind) }, [toast])

  if (authed === null) return <div className="adm adm-login"><p className="adm-muted">Loading...</p></div>
  if (!authed) return <Login onDone={() => { setAuthed(true); setTab('dashboard') }} />

  const View = VIEWS[tab]
  const logout = async () => { await api.post('/api/admin/logout').catch(() => {}); setAuthed(false) }
  return (
    <div className="adm adm-shell">
      <aside className="adm-side">
        <div className="adm-brand">Control Center</div>
        <nav>{MENU.map(([k, label, icon]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}><span aria-hidden="true">{icon}</span>{label}</button>)}</nav>
        <div className="adm-side-foot"><a href="#/">← Website</a><button onClick={logout}>Log out</button></div>
      </aside>
      <main className="adm-main">
        <h2 className="adm-h">{MENU.find((m) => m[0] === tab)[1]}</h2>
        <View key={tab} toast={guardedToast} />
      </main>
      {toastState && <div className={`adm-toast ${toastState.kind}`} role="status">{toastState.msg}</div>}
    </div>
  )
}
