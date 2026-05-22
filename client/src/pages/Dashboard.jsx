import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { makeApi } from '../hooks/useApi';
import {
  Bot, LogOut, Users, CheckCircle2, XCircle, Clock,
  Plus, RefreshCw, Power, PowerOff, Trash2, X, RotateCcw,
  Copy, ExternalLink, Search, AlertCircle, Zap
} from 'lucide-react';

const PLAN_OPTIONS = ['basic','standard','premium','vip'];

const RUNTIME_STATUS_META = {
  created:    { label: 'CREATED',    color: '#64748b' },
  inactive:   { label: 'INACTIVE',   color: '#64748b' },
  validating: { label: 'VALIDATING', color: '#fbbf24' },
  starting:   { label: 'STARTING',   color: '#a855f7' },
  active:     { label: 'ACTIVE',     color: '#4ade80' },
  stopped:    { label: 'STOPPED',    color: '#f87171' },
  offline:    { label: 'OFFLINE',    color: '#f87171' },
  expired:    { label: 'EXPIRED',    color: '#fbbf24' },
  disabled:   { label: 'DISABLED',   color: '#ef4444' },
};

function StatCard({ label, value, color, icon: Icon }) {
  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
      style={{
        background:'rgba(255,255,255,0.028)',
        border:'1px solid rgba(255,255,255,0.065)',
        borderRadius:'0.875rem',
        backdropFilter:'blur(8px)',
        padding:'0.875rem 1rem',
        display:'flex',
        alignItems:'center',
        gap:'0.875rem',
      }}>
      <div style={{
        background: color + '18',
        border: '1px solid ' + color + '30',
        borderRadius: '0.6rem',
        padding: '0.5rem',
        display: 'flex',
        flexShrink: 0,
      }}>
        <Icon size={16} color={color}/>
      </div>
      <div style={{minWidth:0}}>
        <p style={{fontSize:'0.6rem',fontWeight:700,letterSpacing:'0.12em',color:'#475569',textTransform:'uppercase',marginBottom:'0.2rem'}}>{label}</p>
        <p style={{fontSize:'1.6rem',fontWeight:800,color,lineHeight:1}}>{value ?? '—'}</p>
      </div>
    </motion.div>
  );
}

function StatusPill({ user }) {
  const now = new Date();
  const isExpired  = user.expiry_date && new Date(user.expiry_date) < now;
  const isDisabled = !user.is_active;

  if (isDisabled) return <Pill label="DISABLED" color="#ef4444"/>;
  if (isExpired)  return <Pill label="EXPIRED"  color="#fbbf24"/>;

  const status = user.runtime_status || 'created';
  const meta   = RUNTIME_STATUS_META[status] || RUNTIME_STATUS_META.created;
  const pulse  = ['validating','starting','active'].includes(status);

  return (
    <span style={{
      display:'inline-flex',alignItems:'center',gap:'0.35rem',
      padding:'0.15rem 0.6rem',borderRadius:'999px',fontSize:'0.6rem',
      fontWeight:700,letterSpacing:'0.08em',color:meta.color,
      background:meta.color+'18',border:'1px solid '+meta.color+'30'
    }}>
      <span style={{
        width:'5px',height:'5px',borderRadius:'50%',
        background:meta.color,flexShrink:0,
        boxShadow: pulse ? `0 0 6px ${meta.color}` : 'none',
        animation: pulse ? 'bxpulse 2s infinite' : 'none',
      }}/>
      {meta.label}
    </span>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{display:'inline-block',padding:'0.15rem 0.6rem',borderRadius:'999px',fontSize:'0.6rem',
      fontWeight:700,letterSpacing:'0.08em',color,background:color+'18',border:'1px solid '+color+'30'}}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(4px)',
        zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
        className="glass" style={{width:'100%',maxWidth:'420px',padding:'1.5rem',position:'relative'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
          <span style={{fontWeight:700,fontSize:'0.9rem'}}>{title}</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',padding:'0.25rem'}}><X size={16}/></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export default function Dashboard({ token, onLogout }) {
  const api = makeApi(token);
  const [stats, setStats]     = useState({});
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [toast, setToast]     = useState({ text:'', ok:true });
  const [modal, setModal]     = useState(null);
  const [newUser, setNewUser] = useState({ username:'', expiresInDays:'30', plan:'basic' });
  const [renewDays, setRenewDays] = useState('30');

  const showToast = (text, ok=true) => { setToast({text,ok}); setTimeout(()=>setToast({text:'',ok:true}),4500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([api.stats(), api.getUsers()]);
      setStats(s); setUsers(u.users || []);
    } catch(e) { showToast(e.message, false); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 10s for real-time status
  useEffect(() => {
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = users.filter(u =>
    !search || u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.session_id||'').toLowerCase().includes(search.toLowerCase())
  );

  const createUser = async () => {
    if (!newUser.username.trim()) return showToast('Username is required', false);
    try {
      const d = await api.createUser({
        username: newUser.username.trim(),
        expiresInDays: newUser.expiresInDays ? Number(newUser.expiresInDays) : null,
        plan: newUser.plan,
      });
      showToast(`Created @${d.user.username} — password: "${d.password}"`, true);
      setModal(null); setNewUser({ username:'', expiresInDays:'30', plan:'basic' });
      load();
    } catch(e) { showToast(e.message, false); }
  };

  const renewUser = async (user) => {
    try {
      await api.updateUser(user.id, { expiresInDays: Number(renewDays) || 30 });
      showToast(`@${user.username} renewed for ${renewDays} days.`, true);
      setModal(null); load();
    } catch(e) { showToast(e.message, false); }
  };

  const toggleActive = async (user) => {
    try {
      await api.updateUser(user.id, { is_active: !user.is_active });
      showToast(`@${user.username} ${user.is_active?'disabled':'enabled'}.`, true);
      load();
    } catch(e) { showToast(e.message, false); }
  };

  const deleteUser = async (user) => {
    try {
      await api.deleteUser(user.id);
      showToast(`@${user.username} deleted.`, true);
      setModal(null); load();
    } catch(e) { showToast(e.message, false); }
  };

  const resetPw = async (user) => {
    try {
      await api.updateUser(user.id, { resetPassword: true });
      showToast(`Password reset to "user" for @${user.username}.`, true);
    } catch(e) { showToast(e.message, false); }
  };

  const panelUrl = (user) => {
    const base = import.meta.env.VITE_CLIENT_PANEL_URL || '';
    if (!base) return `[Set VITE_CLIENT_PANEL_URL env var]/?token=${user.panel_token}`;
    return `${base.replace(/\/$/,'')}/?token=${user.panel_token}`;
  };

  const copyText = (text, label) => { navigator.clipboard.writeText(text); showToast(label + ' copied!', true); };

  const expiryStr = (u) => {
    if (!u.expiry_date) return <span style={{color:'#334155'}}>—</span>;
    const d = new Date(u.expiry_date);
    const expired = d < new Date();
    return <span style={{color:expired?'#f87171':'#94a3b8',fontSize:'0.72rem'}}>{d.toLocaleDateString()}</span>;
  };

  return (
    <div style={{minHeight:'100vh',background:'radial-gradient(ellipse at top,#1a0533 0%,#050507 65%)'}}>
      <style>{`
        @keyframes bxspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes bxpulse{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      {/* Toast */}
      <AnimatePresence>
        {toast.text && (
          <motion.div initial={{opacity:0,y:-24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-24}}
            style={{position:'fixed',top:'1rem',left:'50%',transform:'translateX(-50%)',
              zIndex:200,background:toast.ok?'rgba(74,222,128,0.12)':'rgba(248,113,113,0.12)',
              border:'1px solid '+(toast.ok?'rgba(74,222,128,0.3)':'rgba(248,113,113,0.3)'),
              borderRadius:'0.75rem',padding:'0.625rem 1.25rem',fontSize:'0.82rem',
              color:toast.ok?'#4ade80':'#f87171',maxWidth:'480px',textAlign:'center',backdropFilter:'blur(8px)'}}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header style={{borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(0,0,0,0.5)',
        backdropFilter:'blur(12px)',position:'sticky',top:0,zIndex:40}}>
        <div style={{maxWidth:'1200px',margin:'0 auto',padding:'0.75rem 1.25rem',
          display:'flex',alignItems:'center',justifyContent:'space-between',gap:'1rem'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.625rem'}}>
            <div style={{background:'rgba(168,85,247,0.12)',border:'1px solid rgba(168,85,247,0.3)',
              borderRadius:'0.6rem',padding:'0.375rem'}}>
              <Bot size={18} color="#a855f7"/>
            </div>
            <div>
              <p style={{fontWeight:800,fontSize:'0.9rem',letterSpacing:'-0.01em'}}>BOTIFY X</p>
              <p style={{fontSize:'0.58rem',color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em'}}>Admin Console</p>
            </div>
          </div>
          <div style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
            <button onClick={load} disabled={loading} className="btn btn-ghost" style={{padding:'0.45rem 0.75rem'}}>
              <RefreshCw size={13} style={loading?{animation:'bxspin 1s linear infinite'}:undefined}/>
            </button>
            <button onClick={()=>setModal('create')} className="btn btn-purple">
              <Plus size={14}/> New Client
            </button>
            <button onClick={onLogout} className="btn btn-ghost" style={{padding:'0.45rem 0.6rem'}}>
              <LogOut size={14}/>
            </button>
          </div>
        </div>
      </header>

      <main style={{maxWidth:'1200px',margin:'0 auto',padding:'1.25rem',display:'flex',flexDirection:'column',gap:'1.25rem'}}>

        {/* Stats — horizontal row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:'0.75rem'}}>
          <StatCard label="Total Clients" value={stats.total}    color="#a855f7" icon={Users}/>
          <StatCard label="Active"        value={stats.active}   color="#4ade80" icon={CheckCircle2}/>
          <StatCard label="Created"       value={stats.created}  color="#64748b" icon={Zap}/>
          <StatCard label="Expired"       value={stats.expired}  color="#fbbf24" icon={Clock}/>
          <StatCard label="Disabled"      value={stats.disabled} color="#ef4444" icon={XCircle}/>
        </div>

        {/* Users table */}
        <div className="glass" style={{overflow:'hidden'}}>
          <div style={{padding:'0.875rem 1rem',borderBottom:'1px solid rgba(255,255,255,0.06)',
            display:'flex',alignItems:'center',gap:'0.75rem'}}>
            <Search size={14} color="#334155" style={{flexShrink:0}}/>
            <input className="input" placeholder="Search by username or session ID..."
              value={search} onChange={e=>setSearch(e.target.value)}
              style={{border:'none',background:'none',padding:'0',fontSize:'0.82rem',outline:'none'}}/>
            <span style={{fontSize:'0.7rem',color:'#334155',whiteSpace:'nowrap'}}>{filtered.length} client{filtered.length!==1?'s':''}</span>
          </div>

          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.8rem'}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                  {['Username','Status','Plan','Expires','Session ID','Actions'].map(h => (
                    <th key={h} style={{padding:'0.625rem 1rem',textAlign:'left',fontSize:'0.6rem',
                      fontWeight:700,letterSpacing:'0.1em',color:'#475569',textTransform:'uppercase',whiteSpace:'nowrap'}}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{padding:'2.5rem',textAlign:'center',color:'#1e293b'}}>
                    {search ? 'No results.' : 'No clients yet. Create your first one above.'}
                  </td></tr>
                ) : filtered.map((u,i) => (
                  <motion.tr key={u.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
                    transition={{delay:i*0.02}}
                    style={{borderBottom:'1px solid rgba(255,255,255,0.04)',transition:'background 0.1s'}}
                    onMouseEnter={e=>e.currentTarget.style.background='rgba(255,255,255,0.025)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <td style={{padding:'0.75rem 1rem',fontWeight:600,color:'#e2e8f0'}}>@{u.username}</td>
                    <td style={{padding:'0.75rem 1rem'}}><StatusPill user={u}/></td>
                    <td style={{padding:'0.75rem 1rem'}}>
                      <span style={{fontSize:'0.72rem',color:'#94a3b8',textTransform:'capitalize'}}>{u.plan}</span>
                    </td>
                    <td style={{padding:'0.75rem 1rem'}}>{expiryStr(u)}</td>
                    <td style={{padding:'0.75rem 1rem',maxWidth:'160px'}}>
                      {u.session_id ? (
                        <span style={{fontFamily:'monospace',fontSize:'0.68rem',color:'#a855f7',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block'}}>
                          {u.session_id}
                        </span>
                      ) : <span style={{color:'#1e293b',fontSize:'0.72rem'}}>No session</span>}
                    </td>
                    <td style={{padding:'0.75rem 1rem'}}>
                      <div style={{display:'flex',gap:'0.3rem',flexWrap:'wrap'}}>
                        {/* Renew */}
                        <button onClick={()=>{setRenewDays('30');setModal({type:'renew',user:u});}}
                          className="btn btn-green" style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem',gap:'0.25rem'}}
                          title="Renew subscription">
                          <RefreshCw size={11}/> Renew
                        </button>
                        {/* Pause / Resume */}
                        <button onClick={()=>toggleActive(u)}
                          className={u.is_active?'btn btn-amber':'btn btn-ghost'}
                          style={{padding:'0.3rem 0.6rem',fontSize:'0.7rem',gap:'0.25rem'}}
                          title={u.is_active ? 'Disable access' : 'Enable access'}>
                          {u.is_active ? <><PowerOff size={11}/> Pause</> : <><Power size={11}/> Resume</>}
                        </button>
                        {/* Copy panel link */}
                        <button onClick={()=>setModal({type:'panel',user:u})}
                          className="btn btn-ghost" style={{padding:'0.3rem 0.5rem',fontSize:'0.7rem'}}
                          title="Panel link">
                          <ExternalLink size={11}/>
                        </button>
                        {/* Delete */}
                        <button onClick={()=>setModal({type:'delete',user:u})}
                          className="btn btn-red" style={{padding:'0.3rem 0.5rem',fontSize:'0.7rem'}}
                          title="Delete client">
                          <Trash2 size={11}/>
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <AnimatePresence>

        {/* Create */}
        {modal === 'create' && (
          <Modal title="Create Client Panel" onClose={()=>setModal(null)}>
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div>
                <label style={{fontSize:'0.7rem',color:'#475569',fontWeight:600,display:'block',marginBottom:'0.35rem'}}>Username</label>
                <input className="input" placeholder="e.g. john_doe" value={newUser.username}
                  onChange={e=>setNewUser(p=>({...p,username:e.target.value}))}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                <div>
                  <label style={{fontSize:'0.7rem',color:'#475569',fontWeight:600,display:'block',marginBottom:'0.35rem'}}>Expiry (days)</label>
                  <input className="input" type="number" min="1" placeholder="30"
                    value={newUser.expiresInDays}
                    onChange={e=>setNewUser(p=>({...p,expiresInDays:e.target.value}))}/>
                </div>
                <div>
                  <label style={{fontSize:'0.7rem',color:'#475569',fontWeight:600,display:'block',marginBottom:'0.35rem'}}>Plan</label>
                  <select className="input" value={newUser.plan}
                    onChange={e=>setNewUser(p=>({...p,plan:e.target.value}))}
                    style={{cursor:'pointer'}}>
                    {PLAN_OPTIONS.map(p=><option key={p} value={p} style={{background:'#0f0a1a'}}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{fontSize:'0.72rem',color:'#334155',padding:'0.625rem 0.75rem',
                background:'rgba(0,0,0,0.35)',borderRadius:'0.5rem',lineHeight:1.6}}>
                Default password: <strong style={{color:'#a855f7'}}>user</strong><br/>
                A unique panel link will be generated. Share it with the client so they can log in automatically.
              </div>
              <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end',marginTop:'0.25rem'}}>
                <button onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
                <button onClick={createUser} className="btn btn-purple"><Plus size={13}/> Create</button>
              </div>
            </div>
          </Modal>
        )}

        {/* Renew */}
        {modal?.type === 'renew' && (
          <Modal title={`Renew @${modal.user.username}`} onClose={()=>setModal(null)}>
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div>
                <label style={{fontSize:'0.7rem',color:'#475569',fontWeight:600,display:'block',marginBottom:'0.35rem'}}>Add days from today</label>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'0.375rem',marginBottom:'0.5rem'}}>
                  {['7','14','30','90'].map(d => (
                    <button key={d} onClick={()=>setRenewDays(d)}
                      className={renewDays===d?'btn btn-purple':'btn btn-ghost'}
                      style={{padding:'0.4rem',fontSize:'0.78rem'}}>
                      {d}d
                    </button>
                  ))}
                </div>
                <input className="input" type="number" min="1" value={renewDays}
                  onChange={e=>setRenewDays(e.target.value)} placeholder="Custom days"/>
              </div>
              <p style={{fontSize:'0.72rem',color:'#4ade80',padding:'0.5rem 0.75rem',
                background:'rgba(74,222,128,0.06)',borderRadius:'0.5rem',border:'1px solid rgba(74,222,128,0.15)'}}>
                WhatsApp notification will be sent if the client's bot is currently running.
              </p>
              <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
                <button onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
                <button onClick={()=>renewUser(modal.user)} className="btn btn-green">
                  <RefreshCw size={13}/> Renew {renewDays}d
                </button>
              </div>
            </div>
          </Modal>
        )}

        {/* Panel link */}
        {modal?.type === 'panel' && (
          <Modal title={`Panel Link — @${modal.user.username}`} onClose={()=>setModal(null)}>
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <p style={{fontSize:'0.75rem',color:'#475569'}}>Share this link with the client. It auto-logs them in.</p>
              <div style={{background:'rgba(0,0,0,0.5)',borderRadius:'0.5rem',padding:'0.75rem',
                fontFamily:'monospace',fontSize:'0.72rem',color:'#a855f7',wordBreak:'break-all',lineHeight:1.6}}>
                {panelUrl(modal.user)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                <button onClick={()=>copyText(panelUrl(modal.user),'Panel link')} className="btn btn-purple">
                  <Copy size={12}/> Copy Link
                </button>
                <button onClick={()=>resetPw(modal.user)} className="btn btn-ghost">
                  <RotateCcw size={12}/> Reset Password
                </button>
              </div>
              <div style={{fontSize:'0.7rem',color:'#334155',lineHeight:1.55}}>
                Username: <strong style={{color:'#fff'}}>@{modal.user.username}</strong> &nbsp;|&nbsp;
                Password: <strong style={{color:'#fff'}}>user</strong>
              </div>
            </div>
          </Modal>
        )}

        {/* Delete */}
        {modal?.type === 'delete' && (
          <Modal title="Delete Client" onClose={()=>setModal(null)}>
            <p style={{color:'#94a3b8',fontSize:'0.82rem',marginBottom:'1.25rem',lineHeight:1.6}}>
              Permanently delete <strong style={{color:'#fff'}}>@{modal.user.username}</strong>?
              Their bot session will be stopped and all data removed. This cannot be undone.
            </p>
            <div style={{display:'flex',gap:'0.5rem',justifyContent:'flex-end'}}>
              <button onClick={()=>setModal(null)} className="btn btn-ghost">Cancel</button>
              <button onClick={()=>deleteUser(modal.user)} className="btn btn-red">
                <Trash2 size={13}/> Delete
              </button>
            </div>
          </Modal>
        )}

      </AnimatePresence>
    </div>
  );
}
