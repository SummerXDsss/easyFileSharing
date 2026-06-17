const fs = require('fs');
const path = require('path');
const { db } = require('./db');
const config = require('./config');
const { getMeta } = require('./meta');
const { resolveStoragePath } = require('./paths');
const { verifyDownloadPassword, isProtected } = require('./protection');
const { randomToken, sha256 } = require('./utils');

function contentDisposition(filename) {
  const fallback = String(filename || 'download')
    .replace(/[\\"]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function buildStaticUrl(filePath, password = '') {
  const { clean } = resolveStoragePath(filePath);
  const query = password ? `?password=${encodeURIComponent(password)}` : '';
  return `/files${clean.split('/').map(encodeURIComponent).join('/')}${query}`;
}

function createDynamicToken(filePath) {
  const meta = getMeta(filePath);
  const token = randomToken(32);
  const expiresAt = Date.now() + config.dynamicTokenTtlSeconds * 1000;
  db.prepare('INSERT INTO dynamic_tokens (dynamic_id, token_hash, path, expires_at) VALUES (?, ?, ?, ?)').run(
    meta.dynamic_id,
    sha256(token),
    meta.path,
    expiresAt,
  );
  return {
    url: `/dl/${encodeURIComponent(meta.dynamic_id)}?token=${encodeURIComponent(token)}`,
    expiresAt,
  };
}

function verifyDynamicToken(dynamicId, token) {
  const row = db.prepare('SELECT * FROM dynamic_tokens WHERE dynamic_id = ? AND token_hash = ?').get(dynamicId, sha256(token || ''));
  if (!row || row.expires_at < Date.now()) return null;
  return row.path;
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
}

function sendFileStream(req, res, filePath, options = {}) {
  const { clean, absolute } = resolveStoragePath(filePath);
  const stats = fs.statSync(absolute);
  if (!stats.isFile()) return res.status(404).send('File not found');
  const meta = getMeta(clean);
  const protectedFile = isProtected(clean);
  if (protectedFile && !verifyDownloadPassword(clean, req.query.password)) {
    return res.status(403).send('Password required or incorrect');
  }
  if (meta.require_login && !req.auth) {
    return res.status(401).send('Login required');
  }
  if (meta.link_mode === 'dynamic' && !options.dynamicVerified) {
    return res.status(403).send('Dynamic link token required');
  }

  db.prepare('INSERT INTO download_logs (path, ip, user_agent, protected, user_id) VALUES (?, ?, ?, ?, ?)').run(
    clean,
    getClientIp(req),
    req.get('user-agent') || '',
    protectedFile ? 1 : 0,
    req.auth?.role === 'user' ? Number(req.auth.sub) : null,
  );

  const total = stats.size;
  const range = req.headers.range;
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', contentDisposition(path.basename(absolute)));
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    if (!match) return res.status(416).send('Invalid range');
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : total - 1;
    if (start >= total || end >= total || start > end) {
      res.setHeader('Content-Range', `bytes */${total}`);
      return res.status(416).end();
    }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
    res.setHeader('Content-Length', end - start + 1);
    return fs.createReadStream(absolute, { start, end }).pipe(res);
  }

  res.setHeader('Content-Length', total);
  return fs.createReadStream(absolute).pipe(res);
}

module.exports = {
  buildStaticUrl,
  contentDisposition,
  createDynamicToken,
  sendFileStream,
  verifyDynamicToken,
};
