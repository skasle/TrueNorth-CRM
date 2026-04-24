import { useState, useEffect, useMemo } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db, auth } from './firebase'

const PARTNER_EMAILS = ['dmcmaster@munichre.com']
const INTERNAL_EMAILS = ['sam@eightbyzero.com','jp@eightbyzero.com','samkasle@gmail.com','jpcarmona7@gmail.com']

const statusColor = (s) => {
  if (!s) return { bg:'#f9fafb', text:'#6b7280', label:'—' }
  if (s.includes('Agreement')) return { bg:'#dbeafe', text:'#1e40af', label:'Agreement' }
  if (s.includes('SIP')) return { bg:'#fef3c7', text:'#92400e', label:'In Progress' }
  if (s.includes('Intro')) return { bg:'#e0e7ff', text:'#3730a3', label:'Intro' }
  if (s.includes('TOF')) return { bg:'#f3f4f6', text:'#374151', label:'Top of Funnel' }
  if (s.includes('Outreach')) return { bg:'#f3f4f6', text:'#374151', label:'Outreach' }
  if (s.includes('WON')) return { bg:'#dcfce7', text:'#166534', label:'Won' }
  if (s.includes('Nurture')) return { bg:'#fce7f3', text:'#9d174d', label:'Nurture' }
  if (s.includes('Research')) return { bg:'#f5f5f4', text:'#78716c', label:'Research' }
  return { bg:'#f9fafb', text:'#6b7280', label:s }
}
const fmtFU = (d) => { if (!d) return '—'; const p=d.split('/'); if(p.length>=2){const mo=['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${mo[parseInt(p[0])]||''} ${parseInt(p[1])}`} return d }
const isOverdue = (d) => { if(!d) return false; const p=d.split('/'); if(p.length!==3) return false; return new Date(parseInt(p[2]),parseInt(p[0])-1,parseInt(p[1]))<new Date() }
const fmtMtgDate = (d) => { if(!d) return ''; const[,m,day]=d.split('-'); const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${mo[parseInt(m)-1]} ${parseInt(day)}` }
const isFuture = (d) => d && new Date(d) >= new Date(new Date().toISOString().split('T')[0])
const todayTag = () => { const d=new Date(); return `${d.getMonth()+1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}` }

export default function Partner() {
  const [user,setUser]=useState(null)
  const [authLoading,setAuthLoading]=useState(true)
  const [deals,setDeals]=useState([])
  const [meetings,setMeetings]=useState([])
  const [loading,setLoading]=useState(true)
  const [tab,setTab]=useState('deals')
  const [expanded,setExpanded]=useState(null)
  const [mtgFilter,setMtgFilter]=useState('all')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loginError,setLoginError]=useState('')
  const [loggingIn,setLoggingIn]=useState(false)

  useEffect(()=>onAuthStateChanged(auth,u=>{setUser(u);setAuthLoading(false)}),[])
  const isPartner=user&&PARTNER_EMAILS.includes(user.email?.toLowerCase())
  const isInternal=user&&INTERNAL_EMAILS.includes(user.email?.toLowerCase())
  const hasAccess=isPartner||isInternal
  const canEditNotes=isPartner||isInternal

  const handleLogin = async (e) => {
    e.preventDefault(); setLoginError(''); setLoggingIn(true)
    try { await signInWithEmailAndPassword(auth, email, password) }
    catch (err) { setLoginError(err.code==='auth/invalid-credential'?'Invalid email or password.':err.message) }
    setLoggingIn(false)
  }

  const handleSaveNote = async (dealId, newNote) => {
    const deal = deals.find(d=>d.id===dealId)
    if (!deal || !newNote.trim()) return
    const updated = (deal.notes||'') + '\n[' + todayTag() + ' Dawn] ' + newNote.trim()
    try {
      await updateDoc(doc(db,'commercial',dealId), { notes: updated, updatedAt: Timestamp.now(), updatedBy: 'dawn' })
      setDeals(prev=>prev.map(d=>d.id===dealId?{...d,notes:updated}:d))
    } catch(e) { console.error('Note save error:',e); alert('Could not save note. Please try again.') }
  }

  useEffect(()=>{
    if(!hasAccess) return
    ;(async()=>{
      setLoading(true)
      try {
        const dSnap=await getDocs(query(collection(db,'commercial'),where('activeIntro','==','MunichRE')))
        setDeals(dSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(parseInt(a.priority)||99)-(parseInt(b.priority)||99)))
        const mSnap=await getDocs(collection(db,'meetings'))
        setMeetings(mSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||'').localeCompare(a.date||'')))
      } catch(e){console.error('Partner load error:',e)}
      setLoading(false)
    })()
  },[hasAccess])

  const filteredMtgs=useMemo(()=>{
    if(mtgFilter==='upcoming') return meetings.filter(m=>isFuture(m.date))
    if(mtgFilter==='munich') return meetings.filter(m=>m.munichOwned)
    return meetings
  },[meetings,mtgFilter])

  if(authLoading) return <Center>Loading...</Center>

  if(!user) return (
    <div style={{fontFamily:"'Söhne','Helvetica Neue',-apple-system,sans-serif",minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#fafaf9'}}>
      <div style={{width:360,padding:40,background:'#fff',borderRadius:12,boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
          <div style={{fontSize:20,fontWeight:700,letterSpacing:'-0.5px'}}>8/0</div>
          <div style={{width:1,height:16,background:'#d4d4d4'}}/>
          <div style={{fontSize:13,color:'#737373'}}>Partner Portal</div>
        </div>
        <p style={{fontSize:13,color:'#a3a3a3',margin:'0 0 28px'}}>Sign in to view pipeline activity</p>
        <form onSubmit={handleLogin}>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%',padding:'10px 12px',fontSize:14,border:'1px solid #e5e5e5',borderRadius:6,marginBottom:10,outline:'none',boxSizing:'border-box'}}/>
          <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%',padding:'10px 12px',fontSize:14,border:'1px solid #e5e5e5',borderRadius:6,marginBottom:16,outline:'none',boxSizing:'border-box'}}/>
          {loginError && <div style={{color:'#dc2626',fontSize:12,marginBottom:12}}>{loginError}</div>}
          <button type="submit" disabled={loggingIn} style={{width:'100%',padding:'10px 0',fontSize:14,fontWeight:600,background:'#1a1a1a',color:'#fff',border:'none',borderRadius:6,cursor:loggingIn?'wait':'pointer',opacity:loggingIn?0.7:1}}>{loggingIn?'Signing in...':'Sign In'}</button>
        </form>
      </div>
    </div>
  )

  if(!hasAccess) return (
    <Center>
      <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>Access Denied</div>
      <div style={{color:'#737373',fontSize:13,marginBottom:16}}>{user.email} does not have access.</div>
      <button onClick={()=>signOut(auth)} style={{padding:'8px 16px',fontSize:13,background:'#f5f5f4',border:'1px solid #e5e5e5',borderRadius:6,cursor:'pointer'}}>Sign Out</button>
    </Center>
  )
  if(loading) return <Center>Loading pipeline data...</Center>

  return (
    <div style={{fontFamily:"'Söhne','Helvetica Neue',-apple-system,sans-serif",background:'#fafaf9',minHeight:'100vh',color:'#1a1a1a'}}>
      <div style={{background:'#1a1a1a',color:'#fafaf9',padding:'16px 28px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <div style={{fontSize:18,fontWeight:700,letterSpacing:'-0.5px'}}>8/0</div>
          <div style={{width:1,height:18,background:'#444'}}/>
          <div style={{fontSize:13,color:'#a3a3a3'}}>Partner Portal</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{fontSize:12,color:'#737373'}}>{user.email}</div>
          <button onClick={()=>signOut(auth)} style={{fontSize:11,color:'#737373',background:'transparent',border:'1px solid #444',borderRadius:4,padding:'4px 10px',cursor:'pointer'}}>Sign Out</button>
          <div style={{width:30,height:30,borderRadius:'50%',background:'#0066cc',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:600,color:'#fff'}}>{isPartner?'DM':user.email?.charAt(0).toUpperCase()}</div>
        </div>
      </div>
      <div style={{borderBottom:'1px solid #e5e5e5',background:'#fff',padding:'0 28px',display:'flex'}}>
        <TabBtn label="My Deals" count={deals.length} active={tab==='deals'} onClick={()=>setTab('deals')}/>
        <TabBtn label="All Meetings" count={meetings.length} active={tab==='meetings'} onClick={()=>setTab('meetings')}/>
      </div>
      <div style={{padding:'20px 28px',maxWidth:1280}}>
        {tab==='deals'&&<>
          <div style={{marginBottom:14}}><h2 style={{fontSize:17,fontWeight:600,margin:0}}>MunichRE Pipeline</h2><p style={{fontSize:12,color:'#737373',margin:'3px 0 0'}}>{deals.length} deals · Click a row for details</p></div>
          <div style={{display:'flex',flexDirection:'column',gap:1,background:'#e5e5e5',borderRadius:8,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            <div style={{display:'grid',gridTemplateColumns:'170px 100px 60px 80px 140px 140px 1fr',padding:'9px 14px',fontSize:10,fontWeight:600,color:'#737373',background:'#f5f5f4',textTransform:'uppercase',letterSpacing:'.5px'}}><div>Company</div><div>Status</div><div>Owner</div><div>Follow Up</div><div>Next Mtg</div><div>Last Mtg</div><div>Notes</div></div>
            {deals.map(d=><DealRow key={d.id} d={d} open={expanded===d.id} toggle={()=>setExpanded(expanded===d.id?null:d.id)} canEdit={canEditNotes} onSaveNote={handleSaveNote}/>)}
          </div>
        </>}
        {tab==='meetings'&&<>
          <div style={{marginBottom:14,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div><h2 style={{fontSize:17,fontWeight:600,margin:0}}>All Commercial Meetings</h2><p style={{fontSize:12,color:'#737373',margin:'3px 0 0'}}>Full visibility across 8/0 commercial activity</p></div>
            <div style={{display:'flex',gap:3,background:'#f5f5f4',borderRadius:7,padding:3}}>
              {['all','upcoming','munich'].map(f=><Pill key={f} label={f==='munich'?'MunichRE':f.charAt(0).toUpperCase()+f.slice(1)} active={mtgFilter===f} onClick={()=>setMtgFilter(f)}/>)}
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:1,background:'#e5e5e5',borderRadius:8,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,.06)'}}>
            {filteredMtgs.length===0?<div style={{padding:'20px 14px',background:'#fff',color:'#a3a3a3',fontSize:13,textAlign:'center'}}>No meetings match the filter.</div>:filteredMtgs.map(m=><MtgRow key={m.id} m={m}/>)}
          </div>
        </>}
      </div>
      <div style={{padding:'20px 28px',borderTop:'1px solid #e5e5e5',marginTop:40,fontSize:11,color:'#a3a3a3'}}>Eight by Zero × MunichRE Partner Portal · Data synced via pipeline scans</div>
    </div>
  )
}

function Center({children}){return<div style={{fontFamily:"'Söhne',sans-serif",minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#fafaf9'}}><div style={{textAlign:'center'}}>{children}</div></div>}
function TabBtn({label,count,active,onClick}){return<button onClick={onClick} style={{padding:'12px 18px',fontSize:13,fontWeight:active?600:400,color:active?'#1a1a1a':'#737373',background:'transparent',border:'none',borderBottom:active?'2px solid #1a1a1a':'2px solid transparent',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>{label}<span style={{background:active?'#1a1a1a':'#e5e5e5',color:active?'#fff':'#737373',fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:600}}>{count}</span></button>}
function Pill({label,active,onClick}){return<button onClick={onClick} style={{padding:'5px 11px',fontSize:12,fontWeight:active?600:400,background:active?'#fff':'transparent',border:'none',borderRadius:6,cursor:'pointer',color:active?'#1a1a1a':'#737373',boxShadow:active?'0 1px 2px rgba(0,0,0,.06)':'none'}}>{label}</button>}

function DealRow({d,open,toggle,canEdit,onSaveNote}){
  const [noteText,setNoteText]=useState('')
  const [saving,setSaving]=useState(false)
  const [showInput,setShowInput]=useState(false)
  const ov=isOverdue(d.followUp),sc=statusColor(d.status),lastNote=(d.notes||'').split('\n').filter(n=>n.trim()).slice(-1)[0]||'—'

  const handleSubmit = async () => {
    if(!noteText.trim()) return
    setSaving(true)
    await onSaveNote(d.id, noteText)
    setNoteText(''); setShowInput(false); setSaving(false)
  }

  return<>
    <div onClick={toggle} style={{display:'grid',gridTemplateColumns:'170px 100px 60px 80px 140px 140px 1fr',padding:'11px 14px',fontSize:13,background:open?'#fefce8':'#fff',cursor:'pointer',alignItems:'center'}}>
      <div style={{fontWeight:600}}>{d.company}</div>
      <div><span style={{background:sc.bg,color:sc.text,padding:'2px 7px',borderRadius:4,fontSize:10,fontWeight:600}}>{sc.label}</span></div>
      <div style={{color:'#737373',fontSize:12}}>{d.owner}</div>
      <div style={{color:ov?'#dc2626':'#374151',fontWeight:ov?600:400,fontSize:12}}>{ov&&'⚠ '}{fmtFU(d.followUp)}</div>
      <div style={{fontSize:11,color:d.nextMeeting?'#0066cc':'#d4d4d4',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.nextMeeting||'—'}</div>
      <div style={{fontSize:11,color:'#737373',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.lastMeeting||'—'}</div>
      <div style={{fontSize:12,color:'#525252',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lastNote}</div>
    </div>
    {open&&<div style={{padding:'14px 14px 14px 28px',background:'#fffbeb',borderTop:'1px solid #fde68a'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:10}}>
        <div><Lbl>Next Meeting</Lbl><div style={{fontSize:13}}>{d.nextMeeting||'None scheduled'}</div></div>
        <div><Lbl>Last Meeting</Lbl><div style={{fontSize:13}}>{d.lastMeeting||'None recorded'}</div></div>
      </div>
      <div style={{marginBottom:canEdit?12:0}}>
        <Lbl>Notes History</Lbl>
        <div style={{fontSize:12,lineHeight:1.6,color:'#44403c',whiteSpace:'pre-wrap'}}>{(d.notes||'No notes').split('\n').filter(n=>n.trim()).slice(-8).join('\n')}</div>
      </div>
      {canEdit&&<div style={{borderTop:'1px solid #fde68a',paddingTop:12}}>
        {!showInput
          ? <button onClick={(e)=>{e.stopPropagation();setShowInput(true)}} style={{fontSize:12,fontWeight:600,color:'#92400e',background:'transparent',border:'1px solid #f59e0b',borderRadius:5,padding:'6px 14px',cursor:'pointer'}}>+ Add Note</button>
          : <div onClick={e=>e.stopPropagation()}>
              <textarea value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a note..." rows={3} style={{width:'100%',padding:'8px 10px',fontSize:13,border:'1px solid #e5e5e5',borderRadius:6,outline:'none',resize:'vertical',boxSizing:'border-box',fontFamily:'inherit'}}/>
              <div style={{display:'flex',gap:8,marginTop:6}}>
                <button disabled={saving||!noteText.trim()} onClick={handleSubmit} style={{fontSize:12,fontWeight:600,color:'#fff',background:saving||!noteText.trim()?'#d4d4d4':'#1a1a1a',border:'none',borderRadius:5,padding:'6px 16px',cursor:saving?'wait':'pointer'}}>{saving?'Saving...':'Save Note'}</button>
                <button onClick={()=>{setShowInput(false);setNoteText('')}} style={{fontSize:12,color:'#737373',background:'transparent',border:'1px solid #e5e5e5',borderRadius:5,padding:'6px 12px',cursor:'pointer'}}>Cancel</button>
              </div>
            </div>
        }
      </div>}
    </div>}
  </>
}

function MtgRow({m}){
  const future=isFuture(m.date)
  return<div style={{display:'grid',gridTemplateColumns:'80px 1fr 140px 60px 90px',padding:'10px 14px',fontSize:13,background:'#fff',alignItems:'center'}}>
    <div style={{fontSize:12,color:'#737373',fontFamily:'monospace'}}>{fmtMtgDate(m.date)}</div>
    <div style={{fontWeight:500}}>{m.title}</div>
    <div style={{color:'#525252',fontSize:12}}>{m.company}</div>
    <div style={{color:'#737373',fontSize:12}}>{m.owner}</div>
    <div style={{display:'flex',gap:4}}>
      <span style={{background:future?'#dcfce7':'#f3f4f6',color:future?'#166534':'#6b7280',padding:'2px 7px',borderRadius:4,fontSize:10,fontWeight:600}}>{future?'Upcoming':'Past'}</span>
      {m.munichOwned&&<span style={{background:'#dbeafe',color:'#1e40af',padding:'2px 5px',borderRadius:4,fontSize:9,fontWeight:600}}>MR</span>}
    </div>
  </div>
}

function Lbl({children}){return<div style={{fontSize:10,fontWeight:600,color:'#92400e',textTransform:'uppercase',marginBottom:3}}>{children}</div>}
