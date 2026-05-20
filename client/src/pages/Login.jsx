import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Lock, User } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLogin(data.token);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'radial-gradient(ellipse at top,#1a0533 0%,#050507 65%)', padding:'1rem' }}>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} className="glass"
        style={{ width:'100%', maxWidth:'360px', padding:'2rem' }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ background:'rgba(168,85,247,0.12)', border:'1px solid rgba(168,85,247,0.3)',
            borderRadius:'0.875rem', padding:'0.875rem', display:'inline-flex', marginBottom:'1rem' }}>
            <Bot size={28} color="#a855f7"/>
          </div>
          <h1 style={{ fontWeight:800, fontSize:'1.4rem', letterSpacing:'-0.02em' }}>BOTIFY X</h1>
          <p style={{ color:'#475569', fontSize:'0.75rem', marginTop:'0.25rem', textTransform:'uppercase', letterSpacing:'0.1em' }}>Admin Dashboard</p>
        </div>

        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          <div style={{ position:'relative' }}>
            <User size={14} color="#334155" style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)' }}/>
            <input className="input" placeholder="Admin username" value={username}
              onChange={e=>setUsername(e.target.value)} required style={{ paddingLeft:'2.25rem' }}/>
          </div>
          <div style={{ position:'relative' }}>
            <Lock size={14} color="#334155" style={{ position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)' }}/>
            <input className="input" type="password" placeholder="Password" value={password}
              onChange={e=>setPassword(e.target.value)} required style={{ paddingLeft:'2.25rem' }}/>
          </div>
          {err && <p style={{ fontSize:'0.78rem', color:'#f87171', textAlign:'center' }}>{err}</p>}
          <button type="submit" disabled={loading} className="btn btn-purple"
            style={{ width:'100%', marginTop:'0.5rem', padding:'0.7rem' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
