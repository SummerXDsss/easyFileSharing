require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const express = require('express');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { db, initDatabase } = require('./db');
const {
  clearRefreshCookie,
  clearUserCookie,
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
  setUserCookie,
  signAccessToken,
  verifyAdmin,
  verifyUser,
} = require('./auth');
const { createDynamicToken, buildStaticUrl, contentDisposition, sendFileStream, verifyDynamicToken } = require('./download');
const { listDirectory, searchFiles } = require('./files');
const { getMeta, listMeta, moveMeta, updateMeta } = require('./meta');
const { deleteRule, isProtected, listRules, moveRules, updateRule, upsertRule, verifyDownloadPassword } = require('./protection');
const { getSiteConfig, updateSiteConfig } = require('./settings');
const { assertStorageExists, normalizeVirtualPath, resolveStoragePath } = require('./paths');
const { ensureThumbnail } = require('./thumbs');
const { isImageFile, isPreviewable, isVideoFile } = require('./utils');
const { createUserFile, getOwnFile, getShare, listUserFiles, updateUserFile, verifyShareCode } = require('./user-space');

initDatabase();
assertStorageExists();
fs.mkdirSync(config.thumbsDir, { recursive: true });
fs.mkdirSync(config.userUploadsDir, { recursive: true });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 * 1024 } });

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
}));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

function validateEntryName(name) {
  const value = String(name || '').trim();
  if (!value) throw new Error('Name is required');
  if (value === '.' || value === '..') throw new Error('Invalid name');
  if (value.includes('/') || value.includes('\\') || value.includes('\0')) throw new Error('Invalid name');
  if (/[<>:"|?*]/.test(value)) throw new Error('Invalid Windows filename character');
  return value;
}

function originAllowed(req) {
  const site = getSiteConfig();
  const allowed = site.allowedOrigins.length ? site.allowedOrigins : config.allowedOrigins;
  const origin = req.get('origin');
  const referer = req.get('referer');
  if (!allowed.length) return true;
  if (!origin && !referer) return !site.requireAllowedOrigin;
  const source = origin || referer;
  return allowed.some((item) => source === item || source.startsWith(`${item}/`));
}

function enforceOrigin(req, res, next) {
  if (!originAllowed(req)) return res.status(403).json({ error: 'Origin is not allowed' });
  return next();
}

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Download-Options', 'noopen');
  next();
});

app.use(express.static(config.publicDir, {
  etag: true,
  maxAge: '0',
}));

app.get('/api/config', (req, res) => {
  const site = getSiteConfig();
  res.json({
    ...site,
    adminVisible: false,
  });
});

app.post('/api/register', (req, res) => {
  try {
    const user = createUser(req.body);
    const accessToken = signAccessToken(user, 'user');
    setUserCookie(res, accessToken);
    res.status(201).json({ user, accessToken });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/login', (req, res) => {
  const user = verifyUser(req.body.username, req.body.password);
  if (!user) return res.status(401).json({ error: 'Invalid username or password' });
  const accessToken = signAccessToken(user, 'user');
  setUserCookie(res, accessToken);
  res.json({ user, accessToken });
});

app.post('/api/logout', (req, res) => {
  clearUserCookie(res);
  res.json({ ok: true });
});

app.get('/api/me/files', requireUserOrAdmin, (req, res) => {
  if (req.auth.role !== 'user') return res.status(403).json({ error: 'User space is for normal users' });
  res.json({ files: listUserFiles(Number(req.auth.sub)) });
});

app.post('/api/me/upload', requireUserOrAdmin, upload.single('file'), (req, res) => {
  try {
    if (req.auth.role !== 'user') return res.status(403).json({ error: 'User upload requires a user account' });
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const file = createUserFile({
      userId: Number(req.auth.sub),
      originalName: req.file.originalname,
      buffer: req.file.buffer,
      note: req.body.note || '',
      visibility: req.body.visibility || 'private',
      extractCode: req.body.extractCode || '',
    });
    res.status(201).json({ file });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/me/files/:id', requireUserOrAdmin, (req, res) => {
  try {
    if (req.auth.role !== 'user') return res.status(403).json({ error: 'User space is for normal users' });
    const file = updateUserFile(Number(req.params.id), Number(req.auth.sub), req.body);
    if (!file) return res.status(404).json({ error: 'File not found' });
    res.json({ file });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/u/file/:id', requireUserOrAdmin, (req, res) => {
  const file = getOwnFile(Number(req.params.id), Number(req.auth.sub));
  if (!file) return res.status(404).send('File not found');
  res.setHeader('Content-Disposition', contentDisposition(file.name));
  res.sendFile(file.stored_path);
});

app.post('/api/share/:shareId/check', (req, res) => {
  const file = getShare(req.params.shareId);
  if (!file || !verifyShareCode(file, req.body.extractCode)) {
    return res.status(403).json({ error: 'Invalid extract code' });
  }
  res.json({ ok: true, file: { name: file.name, size: file.size, note: file.note } });
});

app.get('/s/:shareId', (req, res) => {
  const file = getShare(req.params.shareId);
  if (!file || !verifyShareCode(file, req.query.code)) return res.status(403).send('Invalid extract code');
  res.setHeader('Content-Disposition', contentDisposition(file.name));
  res.sendFile(file.stored_path);
});

app.get('/api/list', optionalBearer, (req, res) => {
  try {
    res.json(listDirectory(req.query.path || '/'));
  } catch (error) {
    res.status(error.status || 404).json({ error: error.message || 'Directory not found' });
  }
});

app.get('/api/search', optionalBearer, (req, res) => {
  try {
    res.json({ query: String(req.query.q || ''), results: searchFiles(req.query.q) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/images', optionalBearer, (req, res) => {
  const images = [];
  function walk(virtualPath) {
    if (images.length >= 500) return;
    const { entries } = listDirectory(virtualPath);
    entries.forEach((entry) => {
      if (images.length >= 500) return;
      if (entry.type === 'directory') walk(entry.path);
      else if (entry.image) images.push(entry);
    });
  }
  try {
    walk('/');
    res.json({ images });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/check-password', (req, res) => {
  try {
    const clean = normalizeVirtualPath(req.body.path);
    if (!isProtected(clean)) return res.json({ ok: true, protected: false });
    const ok = verifyDownloadPassword(clean, req.body.password);
    if (!ok) return res.status(403).json({ error: 'Password is incorrect' });
    res.json({ ok: true, protected: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/dynamic-link', optionalBearer, enforceOrigin, (req, res) => {
  try {
    const meta = getMeta(req.body.path);
    if (meta.require_login && !req.auth) return res.status(401).json({ error: 'Login required' });
    if (meta.link_mode !== 'dynamic') return res.status(400).json({ error: 'File is not in dynamic mode' });
    if (isProtected(meta.path) && !verifyDownloadPassword(meta.path, req.body.password)) {
      return res.status(403).json({ error: 'Password is incorrect' });
    }
    res.json(createDynamicToken(meta.path));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get(/^\/files(\/.*)$/, optionalBearer, enforceOrigin, (req, res) => {
  sendFileStream(req, res, req.params[0]);
});

app.get('/dl/:id', optionalBearer, enforceOrigin, (req, res) => {
  const filePath = verifyDynamicToken(req.params.id, req.query.token);
  if (!filePath) return res.status(403).send('Invalid or expired token');
  sendFileStream(req, res, filePath, { dynamicVerified: true });
});

app.get(/^\/preview(\/.*)$/, optionalBearer, (req, res) => {
  try {
    const filePath = req.params[0];
    if (!isPreviewable(filePath)) return res.status(404).send('Preview not available');
    const { absolute } = resolveStoragePath(filePath);
    res.sendFile(absolute);
  } catch {
    res.status(404).send('Preview not found');
  }
});

app.get(/^\/thumb(\/.*)$/, async (req, res) => {
  try {
    const filePath = req.params[0];
    if (!isImageFile(filePath) && !isVideoFile(filePath)) return res.status(404).send('Thumbnail not available');
    const thumb = await ensureThumbnail(filePath);
    if (!thumb) return res.status(404).send('Thumbnail not available');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(thumb);
  } catch {
    res.status(404).send('Thumbnail not available');
  }
});

app.get('/download/:filename', optionalBearer, enforceOrigin, (req, res) => {
  sendFileStream(req, res, req.query.path);
});

app.get('/download', (req, res) => {
  try {
    res.redirect(302, buildStaticUrl(req.query.path, req.query.password));
  } catch {
    res.status(404).send('File not found');
  }
});

app.post('/api/admin/login', (req, res) => {
  const admin = verifyAdmin(req.body.username, req.body.password);
  if (!admin) return res.status(401).json({ error: 'Invalid username or password' });
  const accessToken = signAccessToken(admin, 'admin');
  const refresh = createRefreshToken(admin.id);
  setRefreshCookie(res, refresh.token, refresh.expiresAt);
  res.json({ accessToken, admin });
});

app.post('/api/admin/refresh', (req, res) => {
  const refreshed = refreshAccessToken(req.cookies.tk);
  if (!refreshed) return res.status(401).json({ error: 'Invalid refresh token' });
  res.json(refreshed);
});

app.post('/api/admin/logout', (req, res) => {
  revokeRefreshToken(req.cookies.tk);
  clearRefreshCookie(res);
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

app.get('/api/admin/config', requireAdmin, (req, res) => {
  res.json(getSiteConfig());
});

app.put('/api/admin/config', requireAdmin, (req, res) => {
  res.json(updateSiteConfig(req.body));
});

app.get('/api/admin/files', requireAdmin, (req, res) => {
  try {
    res.json(listDirectory(req.query.path || '/'));
  } catch (error) {
    res.status(error.status || 404).json({ error: error.message || 'Directory not found' });
  }
});

app.post('/api/admin/rename', requireAdmin, (req, res) => {
  try {
    const { clean, absolute } = resolveStoragePath(req.body.path || '');
    if (clean === '/') return res.status(400).json({ error: 'Cannot rename storage root' });
    const stats = fs.statSync(absolute);
    const newName = validateEntryName(req.body.newName);
    const parentPath = normalizeVirtualPath(path.posix.dirname(clean));
    const nextVirtual = normalizeVirtualPath(path.posix.join(parentPath, newName));
    const next = resolveStoragePath(nextVirtual);
    if (fs.existsSync(next.absolute)) return res.status(409).json({ error: 'Target already exists' });
    fs.renameSync(absolute, next.absolute);
    const movedRules = moveRules(clean, next.clean, stats.isDirectory());
    const movedMeta = moveMeta(clean, next.clean, stats.isDirectory());
    res.json({ oldPath: clean, newPath: next.clean, type: stats.isDirectory() ? 'directory' : 'file', movedRules, movedMeta });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/rules', requireAdmin, (req, res) => {
  res.json({ rules: listRules() });
});

app.post('/api/admin/rules', requireAdmin, (req, res) => {
  try {
    res.status(201).json({ rule: upsertRule(req.body) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/admin/rules/:id', requireAdmin, (req, res) => {
  try {
    const rule = updateRule(Number(req.params.id), req.body);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/admin/rules/:id', requireAdmin, (req, res) => {
  if (!deleteRule(Number(req.params.id))) return res.status(404).json({ error: 'Rule not found' });
  res.json({ ok: true });
});

app.get('/api/admin/meta', requireAdmin, (req, res) => {
  res.json({ meta: listMeta() });
});

app.put('/api/admin/meta', requireAdmin, (req, res) => {
  try {
    res.json({ meta: updateMeta(req.body.path, req.body) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/admin/dynamic-token', requireAdmin, (req, res) => {
  try {
    res.json(createDynamicToken(req.body.path));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/invites', requireAdmin, (req, res) => {
  res.json({ invites: listInviteCodes() });
});

app.post('/api/admin/invites', requireAdmin, (req, res) => {
  try {
    res.status(201).json({ invite: createInviteCode(req.body.code) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const logs = db.prepare('SELECT * FROM download_logs ORDER BY id DESC LIMIT 100').all();
  res.json({ logs });
});

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const current = db.prepare('SELECT * FROM admins WHERE id = ?').get(Number(req.admin.sub));
  if (!current || !bcrypt.compareSync(String(req.body.currentPassword || ''), current.password_hash)) {
    return res.status(403).json({ error: 'Current password is incorrect' });
  }
  if (!req.body.newPassword || String(req.body.newPassword).length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  }
  const nextHash = bcrypt.hashSync(String(req.body.newPassword), 12);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(nextHash, current.id);
  res.json({ ok: true });
});

app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });
    const dir = resolveStoragePath(req.body.dir || '/');
    if (!fs.statSync(dir.absolute).isDirectory()) return res.status(400).json({ error: 'Target is not a directory' });
    const fileName = validateEntryName(req.file.originalname);
    const target = path.join(dir.absolute, fileName);
    fs.writeFileSync(target, req.file.buffer, { flag: 'wx' });
    const filePath = normalizeVirtualPath(path.posix.join(dir.clean, fileName));
    updateMeta(filePath, { uploader: 'admin', note: req.body.note || '' });
    res.status(201).json({ path: filePath });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

function gitResult(args) {
  if (!config.enableAdminGit) {
    const error = new Error('Admin git is disabled');
    error.status = 403;
    throw error;
  }
  const output = execFileSync('git', args, {
    cwd: config.storageDir,
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  return output.trim();
}

app.get('/api/admin/git/status', requireAdmin, (req, res) => {
  try {
    res.json({ enabled: config.enableAdminGit, output: config.enableAdminGit ? gitResult(['status', '--short']) : '' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post('/api/admin/git/:action', requireAdmin, (req, res) => {
  try {
    const action = req.params.action;
    let output = '';
    if (action === 'init') output = gitResult(['init']);
    else if (action === 'pull') output = gitResult(['pull', '--ff-only']);
    else if (action === 'push') output = gitResult(['push']);
    else if (action === 'commit') {
      const message = String(req.body.message || '').trim();
      if (!message) return res.status(400).json({ error: 'Commit message is required' });
      gitResult(['add', '.']);
      output = gitResult(['commit', '-m', message]);
    } else if (action === 'log') output = gitResult(['log', '--oneline', '-10']);
    else return res.status(404).json({ error: 'Unknown git action' });
    res.json({ output });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.stderr?.toString() || error.message });
  }
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(config.publicDir, 'admin.html'));
});

app.use((req, res) => {
  res.sendFile(path.join(config.publicDir, 'index.html'));
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`${getSiteConfig().siteTitle} listening on http://localhost:${config.port}`);
    console.log(`Default admin: ${config.adminUsername} / ${config.adminPassword}`);
  });
}

module.exports = {
  app,
  contentDisposition,
};
