const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { db } = require('./db');
const { avatarFor, randomToken, sha256 } = require('./utils');

function signAccessToken(subject, role = 'admin') {
  return jwt.sign({ sub: String(subject.id), username: subject.username, role }, config.jwtSecret, {
    expiresIn: config.accessTokenTtl,
  });
}

function createRefreshToken(adminId) {
  const raw = randomToken(48);
  const expiresAt = Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000;
  db.prepare('INSERT INTO refresh_tokens (admin_id, token_hash, expires_at) VALUES (?, ?, ?)').run(
    adminId,
    sha256(raw),
    expiresAt,
  );
  return { token: raw, expiresAt };
}

function setRefreshCookie(res, token, expiresAt) {
  res.cookie('tk', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/',
    expires: new Date(expiresAt),
  });
}

function clearRefreshCookie(res) {
  res.clearCookie('tk', { path: '/' });
}

function authenticateBearer(req, res, next) {
  const header = req.get('authorization') || '';
  const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];
  if (!token) {
    return res.status(401).json({ error: 'Missing access token' });
  }
  try {
    req.auth = jwt.verify(token, config.jwtSecret);
    if (req.auth.role === 'admin') req.admin = req.auth;
    if (req.auth.role === 'user') req.user = req.auth;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}

function optionalBearer(req, res, next) {
  const header = req.get('authorization') || '';
  const [, token] = header.match(/^Bearer\s+(.+)$/i) || [];
  if (!token) return next();
  try {
    req.auth = jwt.verify(token, config.jwtSecret);
    if (req.auth.role === 'admin') req.admin = req.auth;
    if (req.auth.role === 'user') req.user = req.auth;
  } catch {
    req.auth = null;
  }
  return next();
}

function requireAdmin(req, res, next) {
  authenticateBearer(req, res, () => {
    if (req.auth?.role !== 'admin') return res.status(403).json({ error: 'Admin required' });
    return next();
  });
}

function requireUserOrAdmin(req, res, next) {
  authenticateBearer(req, res, () => {
    if (!['admin', 'user'].includes(req.auth?.role)) return res.status(403).json({ error: 'Login required' });
    return next();
  });
}

function verifyAdmin(username, password) {
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) return null;
  return { id: admin.id, username: admin.username };
}

function createUser({ username, password, inviteCode }) {
  const cleanUsername = String(username || '').trim();
  if (!/^[a-zA-Z0-9_-]{3,32}$/.test(cleanUsername)) {
    throw new Error('Username must be 3-32 letters, numbers, underscores, or dashes');
  }
  if (!password || String(password).length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const invite = db.prepare('SELECT * FROM invite_codes WHERE code = ?').get(String(inviteCode || '').trim());
  if (!invite || invite.used_by) throw new Error('Invalid invite code');
  const passwordHash = bcrypt.hashSync(String(password), 12);
  const avatar = avatarFor(cleanUsername);
  const tx = db.transaction(() => {
    const result = db.prepare('INSERT INTO users (username, password_hash, avatar) VALUES (?, ?, ?)').run(cleanUsername, passwordHash, avatar);
    db.prepare('UPDATE invite_codes SET used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?').run(result.lastInsertRowid, invite.id);
    return { id: result.lastInsertRowid, username: cleanUsername, avatar };
  });
  return tx();
}

function verifyUser(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || '').trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return null;
  return { id: user.id, username: user.username, avatar: user.avatar };
}

function createInviteCode(code = '') {
  const value = String(code || randomToken(8)).trim();
  db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run(value);
  return db.prepare('SELECT id, code, used_by, used_at, created_at FROM invite_codes WHERE code = ?').get(value);
}

function listInviteCodes() {
  return db.prepare('SELECT id, code, used_by, used_at, created_at FROM invite_codes ORDER BY id DESC').all();
}

function refreshAccessToken(rawToken) {
  if (!rawToken) return null;
  const row = db.prepare(`
    SELECT refresh_tokens.*, admins.username
    FROM refresh_tokens
    JOIN admins ON admins.id = refresh_tokens.admin_id
    WHERE token_hash = ?
  `).get(sha256(rawToken));
  if (!row || row.revoked_at || row.expires_at < Date.now()) return null;
  const admin = { id: row.admin_id, username: row.username };
  return { admin, accessToken: signAccessToken(admin, 'admin') };
}

function revokeRefreshToken(rawToken) {
  if (!rawToken) return;
  db.prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(
    new Date().toISOString(),
    sha256(rawToken),
  );
}

module.exports = {
  authenticateBearer,
  clearRefreshCookie,
  createInviteCode,
  createRefreshToken,
  createUser,
  listInviteCodes,
  optionalBearer,
  refreshAccessToken,
  requireAdmin,
  requireUserOrAdmin,
  revokeRefreshToken,
  setRefreshCookie,
  signAccessToken,
  verifyAdmin,
  verifyUser,
};
