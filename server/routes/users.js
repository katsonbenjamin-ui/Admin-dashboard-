const express = require('express');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query }        = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { callCore }     = require('../middleware/coreProxy');

const router = express.Router();
const DEFAULT_PASSWORD = 'user';

// GET /api/users/stats — real-time counts by runtime_status
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        COUNT(*)::int                                                                         AS total,
        COUNT(*) FILTER (WHERE runtime_status = 'active')::int                               AS active,
        COUNT(*) FILTER (WHERE expiry_date IS NOT NULL AND expiry_date <= NOW())::int         AS expired,
        COUNT(*) FILTER (WHERE NOT is_active)::int                                           AS disabled,
        COUNT(*) FILTER (WHERE runtime_status = 'created' AND is_active)::int                AS created,
        COUNT(*) FILTER (WHERE runtime_status IN ('stopped','offline','inactive') AND is_active AND (expiry_date IS NULL OR expiry_date > NOW()))::int AS inactive
      FROM panel_users
    `);
    return res.json(rows[0]);
  } catch (err) {
    console.error('[stats]', err.message);
    return res.status(500).json({ error: 'Stats failed' });
  }
});

// GET /api/users
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, username, session_id, is_active, runtime_status, expiry_date, plan, panel_token, created_at, updated_at
       FROM panel_users ORDER BY created_at DESC`
    );
    return res.json({ users: rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — create client
router.post('/', requireAdmin, async (req, res) => {
  const { username, expiresInDays, plan } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username is required' });

  try {
    const hash  = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    const token = uuidv4();
    const expiry = expiresInDays
      ? new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString()
      : null;

    const { rows } = await query(
      `INSERT INTO panel_users (username, password_hash, expiry_date, plan, panel_token, is_active, runtime_status)
       VALUES ($1, $2, $3, $4, $5, TRUE, 'created')
       RETURNING id, username, expiry_date, plan, panel_token, is_active, runtime_status, created_at`,
      [username.trim(), hash, expiry, plan || 'basic', token]
    );
    return res.status(201).json({ user: rows[0], password: DEFAULT_PASSWORD });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/users/:id
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active, expiresInDays, plan, resetPassword, runtime_status } = req.body || {};

  const sets = [];
  const vals = [];
  let i = 1;

  if (typeof is_active === 'boolean') { sets.push(`is_active = $${i++}`); vals.push(is_active); }
  if (expiresInDays !== undefined) {
    const expiry = expiresInDays === null ? null
      : new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString();
    sets.push(`expiry_date = $${i++}`); vals.push(expiry);
  }
  if (plan)           { sets.push(`plan = $${i++}`); vals.push(plan); }
  if (runtime_status) { sets.push(`runtime_status = $${i++}`); vals.push(runtime_status); }
  if (resetPassword) {
    const hash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
    sets.push(`password_hash = $${i++}`); vals.push(hash);
  }
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
  sets.push('updated_at = NOW()');
  vals.push(id);

  try {
    const { rows } = await query(
      `UPDATE panel_users SET ${sets.join(', ')} WHERE id = $${i} RETURNING id, username, is_active, runtime_status, expiry_date, plan, session_id`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    // Auto-notify via WhatsApp on renew
    if (expiresInDays !== undefined && user.session_id && process.env.CORE_URL) {
      const panelUrl  = process.env.CLIENT_PANEL_URL || '[your panel link]';
      const newExpiry = user.expiry_date
        ? new Date(user.expiry_date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
        : 'No expiry';

      const message = [
        '✅ *BOTIFY X — Subscription Renewed*',
        '',
        `👤 Username: *${user.username}*`,
        `📅 New Expiry: *${newExpiry}*`,
        `🔗 Panel: ${panelUrl}`,
        '',
        '💡 If your bot is running, restart it from your panel to apply the renewal.',
        '',
        '_Powered by BOTIFY X_',
      ].join('\n');

      callCore('POST', '/runtime/' + user.session_id + '/notify', { message })
        .catch(err => console.error('[notify] failed:', err.message));
    }

    return res.json({ user });
  } catch (err) {
    console.error('[users/patch]', err.message);
    return res.status(500).json({ error: 'Update failed' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { rows } = await query('SELECT session_id FROM panel_users WHERE id=$1', [req.params.id]);
    if (rows[0]?.session_id && process.env.CORE_URL) {
      callCore('POST', '/runtime/' + rows[0].session_id + '/stop', {}).catch(() => {});
    }
    const { rowCount } = await query('DELETE FROM panel_users WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    return res.json({ ok: true });
  } catch (err) { return res.status(500).json({ error: 'Delete failed' }); }
});

// POST /api/users/internal/runtime-callback
// Called by BOTIFY X CORE when session runtime status changes
router.post('/internal/runtime-callback', async (req, res) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.CORE_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { sessionId, status } = req.body || {};
  if (!sessionId || !status) {
    return res.status(400).json({ error: 'sessionId and status are required' });
  }

  const VALID = ['created', 'validating', 'starting', 'active', 'stopped', 'offline', 'inactive'];
  if (!VALID.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const { rowCount } = await query(
      `UPDATE panel_users SET runtime_status = $1, updated_at = NOW() WHERE session_id = $2`,
      [status, sessionId]
    );
    return res.json({ ok: true, updated: rowCount });
  } catch (err) {
    console.error('[runtime-callback]', err.message);
    return res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
