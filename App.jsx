import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, setDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore'
import {
  signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged,
} from 'firebase/auth'
import Papa from 'papaparse'
import { db, auth } from './firebase'

// ── Auth ─────────────────────────────────────────────────────────────────────

const ALLOWED_EMAILS = [
  'samkasle@gmail.com',
  'agustin@truenorth.co',
  'agonikman@truenorth.co',
  'cyrus@truenorth.co',
  'matt@valtnetwork.com',
  'soul.htite@gmail.com',
]

const ADMIN_EMAILS = [
  'samkasle@gmail.com',
]

// Team members shown in the Owner dropdown and filter pills
const OWNERS = ['Sam', 'Cyrus', 'Matt', 'Soul', 'Alex']

// ── Theme ────────────────────────────────────────────────────────────────────

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tn-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('tn-theme', theme)
  }, [theme])
  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light')
  return [theme, toggle]
}

// ── Config ───────────────────────────────────────────────────────────────────

const TIERS = ['A', 'B', 'C', 'D']
const TIER_COLORS = { 'A': '#43d981', 'B': '#4f8ef7', 'C': '#f2b84b', 'D': '#7a8ba8' }
const TIER_ORDER = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 }

const COMPANY_TYPES = [
  'Bank', 'Credit Union', 'Fintech Lender', 'BaaS Platform',
  'Embedded Finance', 'Specialty Finance', 'Wealth Platform',
  'Consultant', 'Partner', 'Other',
]

const CRM = {
  label: 'TrueNorth Pipeline',
  collection: 'commercial',
  statuses: ['7 - WON!', '4 - Agreement', '3 - SIP', '2 - Pitch', '1 - Intro Meeting', '0 - Outreach', '-1 - Research', '5 - Nurture', '-6 - Lost'],
  statusOrder: { '7 - WON!':0, '4 - Agreement':1, '3 - SIP':2, '2 - Pitch':3, '1 - Intro Meeting':4, '0 - Outreach':5, '-1 - Research':6, '5 - Nurture':7, '-6 - Lost':8 },
  statusColors: {
    '7 - WON!':'#43d981', '4 - Agreement':'#26c4aa', '3 - SIP':'#f2b84b', '2 - Pitch':'#4f8ef7',
    '1 - Intro Meeting':'#a155e8', '0 - Outreach':'#f28b4b', '-1 - Research':'#7a8ba8',
    '5 - Nurture':'#a155e8', '-6 - Lost':'#e85454',
  },
  pipelineStages: [
    { key: '-1 - Research', color: '#7a8ba8' }, { key: '0 - Outreach', color: '#f28b4b' },
    { key: '1 - Intro Meeting', color: '#a155e8' }, { key: '2 - Pitch', color: '#4f8ef7' },
    { key: '3 - SIP', color: '#f2b84b' }, { key: '4 - Agreement', color: '#26c4aa' },
    { key: '7 - WON!', color: '#43d981' },
  ],
  categoryPills: ['Bank', 'Credit Union', 'Fintech Lender', 'BaaS Platform'],
  categoryField: 'type',
  categoryLabel: 'type',
  getName: (inv) => inv.company || inv.Company || '(unnamed)',
  columns: [
    { key: 'tier', label: 'Tier', sort: 'tierPriority' },
    { key: 'priority', label: 'Pri', sort: 'priority' },
    { key: 'company', label: 'Company', sort: 'company' },
    { key: 'targetNames', label: 'Contacts', sort: 'targetNames' },
    { key: 'type', label: 'Type', sort: 'type' },
    { key: 'status', label: 'Next Steps', sort: 'status' },
    { key: 'followUp', label: 'Follow Up', sort: 'followUp' },
    { key: 'owner', label: 'Owner', sort: 'owner' },
    { key: 'notes', label: 'Notes' },
  ],
  csvFieldMap: {
    'ContactID':'contactId', 'Tier':'tier', 'Priority':'priority',
    'Company':'company', 'Target names':'targetNames', 'Type':'type', 'Geo':'geo',
    'Owner':'owner', 'Next Steps':'status', 'Follow-up due':'followUp',
    'Intro':'intro', 'Actively working an intro':'activeIntro',
    'Org description':'orgDescription', 'Opportunity':'opportunity', 'Notes':'notes',
  },
  csvDocIdFields: ['ContactID', 'contactId'],
  csvSkipCheck: (row) => !(row['Company'] || row['company'] || '').trim() && !(row['Target names'] || row['targetNames'] || '').trim(),
  exportHeaders: ['contactId','tier','priority','company','targetNames','type','geo','owner','status','followUp','intro','activeIntro','orgDescription','notes'],
  editFields: (form, set) => (<>
    <FG label="Company"><input value={form.company||''} onChange={e=>set('company',e.target.value)} placeholder="Acme Bank" /></FG>
    <div className="field-row">
      <FG label="Target Names"><input value={form.targetNames||''} onChange={e=>set('targetNames',e.target.value)} placeholder="Jane Smith, Bob Jones" /></FG>
      <FG label="Type">
        <select value={form.type||''} onChange={e=>set('type',e.target.value)}>
          <option value="">— Unset —</option>
          {COMPANY_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </FG>
    </div>
    <div className="field-row">
      <FG label="Geo">
        <select value={form.geo||''} onChange={e=>set('geo',e.target.value)}>
          <option value="">—</option><option value="US">US</option><option value="CAN">CAN</option>
        </select>
      </FG>
      <FG label="Org Description"><input value={form.orgDescription||''} onChange={e=>set('orgDescription',e.target.value)} placeholder="Description..." /></FG>
    </div>
  </>),
  editFields2: (form, set) => (<>
    <div className="field-row">
      <FG label="Intro"><input value={form.intro||''} onChange={e=>set('intro',e.target.value)} placeholder="Who's making the intro" /></FG>
      <FG label="Actively Working Intro"><input value={form.activeIntro||''} onChange={e=>set('activeIntro',e.target.value)} placeholder="Who's working it" /></FG>
    </div>
  </>),
  initForm: (inv) => ({
    company: inv.company || '',
    targetNames: inv.targetNames || '',
    type: inv.type || '',
    geo: inv.geo || '',
    status: inv.status || '',
    followUp: inv.followUp || '',
    owner: inv.owner || '',
    tier: inv.tier || '',
    priority: inv.priority || '',
    intro: inv.intro || '',
    activeIntro: inv.activeIntro || '',
    orgDescription: inv.orgDescription || '',
    notes: inv.notes || '',
  }),
  renderCell: (inv, col, cfg) => {
    if (col.key === 'tier') {
      const tc = TIER_COLORS[inv.tier] || '#3d4a5f'
      return inv.tier ? <span className="tier-badge" style={{color:tc,borderColor:tc+'44',background:tc+'14'}}>{inv.tier}</span> : <span className="td-muted">—</span>
    }
    if (col.key === 'priority') return inv.priority || <span className="td-muted">—</span>
    if (col.key === 'company') return inv.company || '—'
    if (col.key === 'targetNames') return inv.targetNames || '—'
    if (col.key === 'type') return inv.type || '—'
    if (col.key === 'status') {
      const c = cfg.statusColors[inv.status] || '#7a8ba8'
      return <span className="badge" style={{color:c,background:c+'18',borderColor:c+'44'}}>{inv.status||'Unset'}</span>
    }
    if (col.key === 'followUp') return inv.followUp || '—'
    if (col.key === 'owner') return (inv.owner||'') || '—'
    if (col.key === 'notes') { const n = inv.notes||''; return n.length > 50 ? n.slice(0,50)+'…' : n || '—' }
    return inv[col.key] || '—'
  },
}

// ── Utilities ────────────────────────────────────────────────────────────────

function FG({ label, children }) {
  return <div className="field-group"><label>{label}</label>{children}</div>
}

function getStaleDays(log) {
  if (!log) return 999
  const match = log.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/m)
  if (!match) return 999
  let year = match[3] ? parseInt(match[3]) : new Date().getFullYear()
  if (year < 100) year += 2000
  return Math.floor((Date.now() - new Date(year, parseInt(match[1])-1, parseInt(match[2])).getTime()) / 86400000)
}

function followUpStatus(dateStr) {
  if (!dateStr || dateStr === 'NA') return ''
  const parts = dateStr.split('/')
  if (parts.length < 2) return ''
  const fuDate = new Date(parts[2] ? parseInt(parts[2]) : new Date().getFullYear(), parseInt(parts[0])-1, parseInt(parts[1]))
  const today = new Date(); today.setHours(0,0,0,0); fuDate.setHours(0,0,0,0)
  if (fuDate < today) return 'overdue'
  if (fuDate <= new Date(today.getTime() + 3*86400000)) return 'upcoming'
  return ''
}

function tierPrioritySort(a, b) {
  const at = TIER_ORDER[a.tier] ?? 99, bt = TIER_ORDER[b.tier] ?? 99
  if (at !== bt) return at - bt
  return (parseInt(a.priority)||9999) - (parseInt(b.priority)||9999)
}

// ── Layout constants ─────────────────────────────────────────────────────────

const PANEL_WIDTH = 440  // px, docked right side panel

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [theme, toggleTheme] = useTheme()

  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (u && ALLOWED_EMAILS.includes(u.email)) setUser(u)
    else if (u) { signOut(auth); setUser(null) }
    else setUser(null)
    setAuthLoading(false)
  }), [])

  if (authLoading) return <div className="auth-loading"><div className="spinner" /></div>
  if (!user) return <AuthScreen theme={theme} toggleTheme={toggleTheme} />

  const initials = (user.displayName || user.email).split(/[\s@]+/).filter(Boolean).map(s=>s[0]).join('').slice(0,2).toUpperCase()

  return (
    <div className="app">
      <nav className="crm-nav">
        <div className="crm-nav-brand">TrueNorth CRM</div>
        <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:6}}>
          <div className="user-chip">
            {user.photoURL ? <img className="user-avatar" src={user.photoURL} width={26} height={26} style={{borderRadius:'50%'}} /> : <div className="user-initials">{initials}</div>}
            <span>{user.displayName || user.email.split('@')[0]}</span>
          </div>
          <button className="btn-theme" onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark' : 'Switch to light'} aria-label="Toggle theme">
            {theme === 'light' ? '☾' : '☀︎'}
          </button>
          <button className="btn-sm" onClick={() => signOut(auth)}>Sign out</button>
        </div>
      </nav>
      <CRMView cfg={CRM} user={user} />
    </div>
  )
}

// ── CRM View ─────────────────────────────────────────────────────────────────

function CRMView({ cfg, user }) {
  const [investors, setInvestors] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [ownerFilter, setOwnerFilter] = useState('ANY')
  const [tierFilter, setTierFilter] = useState('ANY')
  const [catFilter, setCatFilter] = useState('ANY')
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState(1)
  const [editInv, setEditInv] = useState(null)  // null = empty state, {} = new contact, {id, ...} = existing
  const [toasts, setToasts] = useState([])
  const searchRef = useRef(null)

  const toast = useCallback((msg, type='success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    setLoading(true)
    getDocs(collection(db, cfg.collection))
      .then(snap => setInvestors(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(e => toast('Load error: ' + e.message, 'error'))
      .finally(() => setLoading(false))
  }, [cfg.collection, toast])

  useEffect(() => {
    const fn = (e) => { if ((e.metaKey||e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() } }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const filtered = useMemo(() => {
    let data = investors.filter(inv => {
      const q = search.toLowerCase()
      const text = JSON.stringify(inv).toLowerCase()
      const matchSearch = !q || text.includes(q)
      const matchStatus = statusFilter === 'ALL' ||
        (statusFilter === 'Unset' ? !inv.status || !cfg.statuses.includes(inv.status) : inv.status === statusFilter)
      const owner = (inv.owner||'').toLowerCase()
      const matchOwner = ownerFilter === 'ANY' ||
        (ownerFilter === 'Unowned' ? !inv.owner : owner === ownerFilter.toLowerCase())
      const matchTier = tierFilter === 'ANY' || (tierFilter === 'Untiered' ? !inv.tier : inv.tier === tierFilter)
      const catVal = (inv[cfg.categoryField]||'').toLowerCase()
      const matchCat = catFilter === 'ANY' ||
        (catFilter === 'Other' ? !cfg.categoryPills.some(s => s.toLowerCase() === catVal) && catVal : catVal === catFilter.toLowerCase())
      return matchSearch && matchStatus && matchOwner && matchTier && matchCat
    })
    if (sortKey) {
      data = [...data].sort((a, b) => {
        if (sortKey === 'tierPriority') return sortDir * tierPrioritySort(a, b)
        if (sortKey === 'priority') return sortDir * ((parseInt(a.priority)||9999) - (parseInt(b.priority)||9999))
        if (sortKey === 'status') return sortDir * ((cfg.statusOrder[a.status]??99) - (cfg.statusOrder[b.status]??99))
        const av = (sortKey === 'name' ? cfg.getName(a) : a[sortKey]||'').toString().toLowerCase()
        const bv = (sortKey === 'name' ? cfg.getName(b) : b[sortKey]||'').toString().toLowerCase()
        return av < bv ? -sortDir : av > bv ? sortDir : 0
      })
    }
    return data
  }, [investors, search, statusFilter, ownerFilter, tierFilter, catFilter, sortKey, sortDir, cfg])

  const counts = useMemo(() => {
    const c = { ALL: investors.length, Unset: 0 }
    cfg.statuses.forEach(s => (c[s] = 0))
    investors.forEach(inv => { if (!inv.status || !cfg.statuses.includes(inv.status)) c.Unset++; else c[inv.status]++ })
    return c
  }, [investors, cfg])

  const tierCounts = useMemo(() => {
    const c = { ANY: investors.length, Untiered: 0 }
    TIERS.forEach(t => (c[t] = 0))
    investors.forEach(inv => { if (!inv.tier || !TIERS.includes(inv.tier)) c.Untiered++; else c[inv.tier]++ })
    return c
  }, [investors])

  const catCounts = useMemo(() => {
    const c = { ANY: investors.length, Other: 0 }
    cfg.categoryPills.forEach(s => (c[s] = 0))
    investors.forEach(inv => {
      const v = (inv[cfg.categoryField]||'').trim()
      if (cfg.categoryPills.includes(v)) c[v]++; else c.Other++
    })
    return c
  }, [investors, cfg])

  const saveInvestor = async (data) => {
    const { id, ...fields } = data
    try {
      if (id) {
        await updateDoc(doc(db, cfg.collection, id), { ...fields, updatedAt: serverTimestamp() })
        setInvestors(prev => prev.map(inv => inv.id === id ? { ...inv, ...fields } : inv))
        setEditInv({ id, ...fields })  // keep panel showing the saved record
        toast('Saved')
      } else {
        const ref = await addDoc(collection(db, cfg.collection), { ...fields, createdAt: serverTimestamp() })
        const created = { id: ref.id, ...fields }
        setInvestors(prev => [created, ...prev])
        setEditInv(created)  // keep panel showing the newly created record
        toast('Contact added')
      }
    } catch (e) { toast('Error: ' + e.message, 'error') }
  }

  const deleteInvestor = async (id) => {
    if (!confirm('Delete this contact?')) return
    try {
      await deleteDoc(doc(db, cfg.collection, id))
      setInvestors(prev => prev.filter(inv => inv.id !== id))
      setEditInv(null); toast('Deleted')
    } catch (e) { toast('Error: ' + e.message, 'error') }
  }

  const exportCSV = (prefix) => {
    const label = prefix || 'truenorth-pipeline'
    const rows = investors.map(inv => cfg.exportHeaders.map(h => `"${(inv[h]||'').toString().replace(/"/g,'""')}"`).join(','))
    const csv = [cfg.exportHeaders.join(','), ...rows].join('\n')
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
      download: `${label}-${new Date().toISOString().slice(0,10)}.csv`,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const importCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (investors.length > 0) exportCSV('backup')
    toast('Importing...')
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        try {
          let count = 0, skipped = 0, batch = writeBatch(db), bc = 0
          for (const row of data) {
            if (cfg.csvSkipCheck(row)) { skipped++; continue }
            const inv = {}
            for (const [csvKey, fsKey] of Object.entries(cfg.csvFieldMap)) {
              if (row[csvKey] !== undefined && row[csvKey] !== '') inv[fsKey] = row[csvKey]
            }
            let docId = null
            for (const f of cfg.csvDocIdFields) { if (row[f]) { docId = row[f]; break } }
            if (!docId) docId = String(Date.now() + count)
            batch.set(doc(db, cfg.collection, docId), { ...inv, updatedAt: serverTimestamp() }, { merge: true })
            count++; bc++
            if (bc >= 400) { await batch.commit(); batch = writeBatch(db); bc = 0; toast(`Writing... ${count}`) }
          }
          if (bc > 0) await batch.commit()
          const snap = await getDocs(collection(db, cfg.collection))
          setInvestors(snap.docs.map(d => ({ id: d.id, ...d.data() })))
          toast(`Merged ${count} contacts` + (skipped ? `, skipped ${skipped} empty` : ''))
        } catch (err) { toast('Import error: ' + err.message, 'error'); console.error(err) }
      },
      error: (err) => toast('CSV error: ' + err.message, 'error'),
    })
    e.target.value = ''
  }

  const sortBy = (key) => { setSortDir(prev => sortKey === key ? prev * -1 : 1); setSortKey(key) }
  const openEdit = (inv) => setEditInv(inv)
  const openNew = () => setEditInv({})
  const clearPanel = () => setEditInv(null)
  const selectedId = editInv?.id || null

  return (
    <>
      <header className="header">
        <div className="header-logo">{cfg.label}</div>
        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" /></svg>
          <input ref={searchRef} type="text" className="search-input" placeholder="Search... (⌘K)" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={openNew}>+ Add Contact</button>
          <button className={`btn-sm ${view==='table'?'btn-active':''}`} onClick={()=>setView('table')}>Table</button>
          <button className={`btn-sm ${view==='pipeline'?'btn-active':''}`} onClick={()=>setView('pipeline')}>Pipeline</button>
          {ADMIN_EMAILS.includes(user?.email) && (<>
            <label className="btn-sm" style={{cursor:'pointer'}}>Import CSV<input type="file" accept=".csv" style={{display:'none'}} onChange={importCSV} /></label>
            <button className="btn-sm" onClick={()=>exportCSV()}>Export CSV</button>
          </>)}
        </div>
      </header>

      <div className="filter-bar">
        <div className="status-pills">
          {['ALL', ...cfg.statuses, 'Unset'].map(s => (
            <button key={s} className={`pill ${statusFilter===s?'pill-active':''}`}
              style={cfg.statusColors[s]?{color:cfg.statusColors[s]}:{}} onClick={()=>setStatusFilter(s)}>
              {s} {counts[s]??0}
            </button>
          ))}
        </div>
        <div className="source-pills">
          {cfg.categoryPills.map(s => (
            <button key={s} className={`pill ${catFilter===s?'pill-active':''}`}
              onClick={()=>setCatFilter(prev=>prev===s?'ANY':s)}>{s} {catCounts[s]||0}</button>
          ))}
          <button className={`pill ${catFilter==='Other'?'pill-active':''}`}
            onClick={()=>setCatFilter(prev=>prev==='Other'?'ANY':'Other')}>Other {catCounts.Other||0}</button>
          <button className={`pill pill-any ${catFilter==='ANY'?'pill-active':''}`}
            onClick={()=>setCatFilter('ANY')}>Any {cfg.categoryLabel}</button>
        </div>
        <div className="tier-pills">
          {TIERS.map(t => (
            <button key={t} className={`pill ${tierFilter===t?'pill-active':''}`} style={{color:TIER_COLORS[t]}}
              onClick={()=>setTierFilter(prev=>prev===t?'ANY':t)}>{t} {tierCounts[t]||0}</button>
          ))}
          <button className={`pill ${tierFilter==='Untiered'?'pill-active':''}`}
            onClick={()=>setTierFilter(prev=>prev==='Untiered'?'ANY':'Untiered')}>Untiered {tierCounts.Untiered||0}</button>
          <button className={`pill pill-any ${tierFilter==='ANY'?'pill-active':''}`}
            onClick={()=>setTierFilter('ANY')}>Any tier</button>
        </div>
        <div className="owner-pills">
          {[...OWNERS, 'Unowned'].map(o => (
            <button key={o} className={`pill ${ownerFilter===o?'pill-active':''}`}
              onClick={()=>setOwnerFilter(prev=>prev===o?'ANY':o)}>{o}</button>
          ))}
          <button className={`pill pill-any ${ownerFilter==='ANY'?'pill-active':''}`}
            onClick={()=>setOwnerFilter('ANY')}>Any owner</button>
        </div>
        <div className="filter-count">{filtered.length} shown &nbsp; {investors.length} total</div>
      </div>

      <div className="workspace" style={{display:'flex', flex:1, minHeight:0, overflow:'hidden'}}>
        <div className="main-content" style={{flex:1, minWidth:0, overflow:'auto'}}>
          {loading ? <div className="loading-state"><div className="spinner" /> Loading...</div>
            : view === 'table'
              ? <TableView investors={filtered} cfg={cfg} onEdit={openEdit} onSort={sortBy} sortKey={sortKey} sortDir={sortDir} selectedId={selectedId} />
              : <PipelineView investors={filtered} allInvestors={investors} cfg={cfg} onEdit={openEdit} selectedId={selectedId} />}
        </div>
        <aside
          className="side-panel"
          style={{
            width: PANEL_WIDTH,
            flexShrink: 0,
            borderLeft: '1px solid var(--border, #2a3344)',
            background: 'var(--bg-panel, var(--bg, #0e1420))',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {editInv
            ? <EditPanel investor={editInv} cfg={cfg} onSave={saveInvestor} onDelete={deleteInvestor} onClose={clearPanel} docked />
            : <EmptyPanel onNew={openNew} />}
        </aside>
      </div>

      <div className="toast-container">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>
    </>
  )
}

// ── Empty Panel State ─────────────────────────────────────────────────────────

function EmptyPanel({ onNew }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      height:'100%', padding:'40px 24px', textAlign:'center', gap:14,
    }}>
      <div style={{fontSize:40, opacity:0.3}}>◧</div>
      <div style={{fontSize:14, fontWeight:600, opacity:0.8}}>No contact selected</div>
      <div style={{fontSize:13, opacity:0.55, lineHeight:1.5, maxWidth:280}}>
        Click any row to view and edit details here. Or add a new contact to get started.
      </div>
      <button className="btn-primary" onClick={onNew} style={{marginTop:8}}>+ Add Contact</button>
    </div>
  )
}

// ── Auth Screen ───────────────────────────────────────────────────────────────

function AuthScreen({ theme, toggleTheme }) {
  const [err, setErr] = useState('')
  const signIn = async () => {
    setErr('')
    try { await signInWithPopup(auth, new GoogleAuthProvider()) }
    catch (e) {
      if (e.code==='auth/popup-blocked') setErr('Popup blocked.')
      else if (e.code==='auth/unauthorized-domain') setErr('Add this URL to Firebase Auth > Authorized Domains.')
      else setErr(e.message)
    }
  }
  return (
    <div className="auth-screen">
      {toggleTheme && (
        <button
          className="btn-theme"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
          aria-label="Toggle theme"
          style={{position:'absolute', top:16, right:16}}
        >
          {theme === 'light' ? '☾' : '☀︎'}
        </button>
      )}
      <div className="auth-card">
        <div className="auth-logo">TrueNorth CRM</div>
        <p className="auth-sub">Sign in with your TrueNorth Google account.</p>
        <button className="btn-google" onClick={signIn}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>
        {err && <p className="auth-err">{err}</p>}
        <p className="auth-note">Restricted to TrueNorth team accounts.</p>
      </div>
    </div>
  )
}

// ── Table View ────────────────────────────────────────────────────────────────

function TableView({ investors, cfg, onEdit, onSort, sortKey, sortDir, selectedId }) {
  if (!investors.length) return <div className="empty-state">No contacts match your filters.</div>
  const si = (key) => sortKey === key ? (sortDir > 0 ? ' ↑' : ' ↓') : ''
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>
          {cfg.columns.map(col => (
            <th key={col.key} onClick={col.sort ? ()=>onSort(col.sort) : undefined}
              style={col.sort?{}:{cursor:'default'}}>{col.label}{col.sort ? si(col.sort) : ''}</th>
          ))}
        </tr></thead>
        <tbody>
          {investors.map(inv => {
            const fuClass = followUpStatus(inv.followUp || '')
            const isSelected = inv.id === selectedId
            return (
              <tr
                key={inv.id}
                onClick={()=>onEdit(inv)}
                className={isSelected ? 'row-selected' : ''}
                style={isSelected ? {background:'var(--row-selected-bg, rgba(79,142,247,0.12))', boxShadow:'inset 3px 0 0 var(--accent, #4f8ef7)'} : {}}
              >
                {cfg.columns.map(col => (
                  <td key={col.key} className={
                    col.key==='tier'?'td-tier': col.key==='priority'?'td-priority':
                    col.key==='followUp'?`td-followup ${fuClass}`: col.key==='owner'?'td-owner':
                    col.key==='company'?'td-name': col.key==='type'?'td-source':
                    col.key==='notes'?'td-log': ''
                  }>{cfg.renderCell(inv, col, cfg)}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Pipeline View ─────────────────────────────────────────────────────────────

function PipelineView({ investors, allInvestors, cfg, onEdit, selectedId }) {
  const columns = useMemo(() => {
    const cols = {}
    for (const stage of cfg.pipelineStages) {
      const cards = allInvestors.filter(i => i.status === stage.key).sort(tierPrioritySort)
      const tiered = []
      for (const t of TIERS) {
        const group = cards.filter(i => i.tier === t)
        if (group.length) tiered.push({ tier: t, color: TIER_COLORS[t], cards: group })
      }
      const untiered = cards.filter(i => !i.tier || !TIERS.includes(i.tier))
      if (untiered.length) tiered.push({ tier: 'Untiered', color: '#3d4a5f', cards: untiered })
      cols[stage.key] = { tiered, total: cards.length }
    }
    return cols
  }, [allInvestors, cfg])

  const visibleIds = useMemo(() => new Set(investors.map(i => i.id)), [investors])

  return (
    <div className="pipeline">
      {cfg.pipelineStages.map(stage => {
        const col = columns[stage.key] || { tiered: [], total: 0 }
        return (
          <div key={stage.key} className="pipeline-col">
            <div className="pipeline-col-header" style={{borderTopColor:stage.color}}>
              <span className="pipeline-col-title">{stage.key.toUpperCase()}</span>
              <span className="pipeline-col-count">{col.total}</span>
            </div>
            <div className="pipeline-cards">
              {col.tiered.map(({tier, color, cards}) => {
                const visible = cards.filter(inv => visibleIds.has(inv.id))
                if (!visible.length) return null
                return (
                  <div key={tier} className="tier-group">
                    <div className="tier-label" style={{color}}><span className="tier-dot" style={{background:color}} />Tier {tier}<span className="tier-count">{visible.length}</span></div>
                    {visible.map(inv => {
                      const log = inv.notes
                      const stale = getStaleDays(log)
                      const fu = inv.followUp || ''
                      const fuC = followUpStatus(fu)
                      const tc = TIER_COLORS[inv.tier] || null
                      const isSelected = inv.id === selectedId
                      return (
                        <div
                          key={inv.id}
                          className={`pipeline-card ${stale>7?'stale':''} ${isSelected?'card-selected':''}`}
                          onClick={()=>onEdit(inv)}
                          style={isSelected ? {outline:'2px solid var(--accent, #4f8ef7)', outlineOffset:'-2px'} : {}}
                        >
                          <div className="pipeline-card-top">
                            <div className="pipeline-card-name">{cfg.getName(inv)}</div>
                            {inv.tier && <span className="tier-badge-sm" style={{color:tc,borderColor:tc+'44',background:tc+'14'}}>{inv.tier}</span>}
                          </div>
                          {inv.targetNames && <div className="pipeline-card-firm">{inv.targetNames}</div>}
                          {fu && <div className={`pipeline-card-fu ${fuC}`}>Follow up: {fu}</div>}
                          {stale < 999 && <div className={`pipeline-card-stale ${stale>7?'stale-red':''}`}>{stale}d since last touch</div>}
                          <div className="pipeline-card-owner">{(inv[cfg.categoryField]||'').toUpperCase()}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Edit Panel ────────────────────────────────────────────────────────────────

function EditPanel({ investor, cfg, onSave, onDelete, onClose, docked }) {
  const isNew = !investor.id
  const [form, setForm] = useState(cfg.initForm(investor))
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Re-sync form whenever a different record is selected
  useEffect(() => { setForm(cfg.initForm(investor)) }, [investor.id, investor])

  const handleSave = async () => {
    setSaving(true)
    try { await onSave({ id: investor.id, ...form }) }
    finally { setSaving(false) }
  }

  // When docked (always-open mode), render without fixed positioning so it sits inside the layout flex
  const panelStyle = docked ? {
    position: 'static',
    width: '100%',
    height: '100%',
    transform: 'none',
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  } : {}

  const bodyStyle = docked ? { flex: 1, overflowY: 'auto', minHeight: 0 } : {}

  return (
    <div className="edit-panel" style={panelStyle}>
      <div className="panel-header">
        <div>
          <div className="panel-title">{isNew ? 'New Contact' : cfg.getName(investor)}</div>
          {!isNew && investor.id && <div className="panel-meta">ID: {investor.id}</div>}
        </div>
        <button className="btn-x" onClick={onClose} title="Clear panel">
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg>
        </button>
      </div>
      <div className="panel-body" style={bodyStyle}>
        {cfg.editFields(form, set)}
        <div className="field-row">
          <FG label="Next Steps">
            <select value={form.status||''} onChange={e=>set('status',e.target.value)}>
              <option value="">— Unset —</option>
              {cfg.statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FG>
          <FG label="Owner">
            <select value={form.owner||''} onChange={e=>set('owner',e.target.value)}>
              <option value="">Unowned</option>
              {OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </FG>
        </div>
        <div className="field-row">
          <FG label="Tier (quality)">
            <select value={form.tier||''} onChange={e=>set('tier',e.target.value)}>
              <option value="">— Untiered —</option>
              {TIERS.map(t => <option key={t} value={t}>Tier {t}</option>)}
            </select>
          </FG>
          <FG label="Priority (action order)"><input type="number" value={form.priority||''} onChange={e=>set('priority',e.target.value)} placeholder="1, 2, 3..." min="1" /></FG>
        </div>
        <div className="field-row">
          <FG label="Follow Up"><input value={form.followUp||''} onChange={e=>set('followUp',e.target.value)} placeholder="4/10/2026" /></FG>
        </div>
        {cfg.editFields2(form, set, cfg.statuses)}
        <FG label="Notes">
          <textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}
            placeholder="Notes..." rows={7} />
        </FG>
      </div>
      <div className="panel-footer">
        {!isNew && <button className="btn-danger" onClick={()=>onDelete(investor.id)}>Delete</button>}
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Add Contact' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
