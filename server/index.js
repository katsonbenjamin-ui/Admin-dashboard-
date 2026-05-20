require('dotenv').config();
const express   = require('express');
const path      = require('path');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) { console.error('[FATAL] Missing env vars:', missing.join(', ')); process.exit(1); }

const { query }   = require('./db');
const authRoutes  = require('./routes/auth');
const usersRoutes = require('./routes/users');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use('/api/',      rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth/', rateLimit({ windowMs: 15*60*1000, max: 30,  standardHeaders: true, legacyHeaders: false }));

app.use('/api/auth',  authRoutes);
app.use('/api/users', usersRoutes);
app.get('/api/healthz', (_, res) => res.json({ ok: true }));

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, '../client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return;
    res.sendFile(path.join(dist, 'index.html'));
  });
}

async function migrate() {
  const sql = require('fs').readFileSync(path.join(__dirname, 'migrations/001_init.sql'), 'utf8');
  try { await query(sql); console.log('[db] migrated'); }
  catch (err) { console.error('[db] migration error:', err.message); }
}

const PORT = Number(process.env.PORT || 3000);
migrate().then(() => app.listen(PORT, () => console.log('[admin] port ' + PORT)));

function shutdown(sig) {
  console.log('[admin] ' + sig); process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err => console.error('[admin] Uncaught:', err.message));
process.on('unhandledRejection', r   => console.error('[admin] Rejection:', r instanceof Error ? r.message : String(r)));
