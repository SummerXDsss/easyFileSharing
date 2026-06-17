const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { db } = require('./db');
const { randomToken } = require('./utils');

function userRoot(userId) {
  const root = path.join(config.userUploadsDir, String(userId));
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function safeUploadName(name) {
  const clean = path.basename(String(name || '').replace(/\\/g, '/')).trim();
  if (!clean || clean === '.' || clean === '..') throw new Error('Invalid file name');
  if (/[<>:"|?*\0]/.test(clean)) throw new Error('Invalid file name');
  return clean;
}

function createUserFile({ userId, originalName, buffer, note = '', visibility = 'private', extractCode = '' }) {
  const name = safeUploadName(originalName);
  const isPublic = visibility === 'public';
  if (isPublic && !extractCode) throw new Error('Public shares require an extract code');
  const shareId = isPublic ? randomToken(10) : null;
  const extractHash = isPublic ? bcrypt.hashSync(String(extractCode), 12) : null;
  const diskName = `${Date.now()}-${randomToken(6)}-${name}`;
  const absolute = path.join(userRoot(userId), diskName);
  fs.writeFileSync(absolute, buffer, { flag: 'wx' });
  const result = db.prepare(`
    INSERT INTO user_files (user_id, name, stored_path, size, note, visibility, share_id, extract_code_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, absolute, buffer.length, String(note || ''), isPublic ? 'public' : 'private', shareId, extractHash);
  return getUserFile(result.lastInsertRowid, userId);
}

function getUserFile(id, userId) {
  return db.prepare('SELECT id, user_id, name, size, note, visibility, share_id, created_at, updated_at FROM user_files WHERE id = ? AND user_id = ?').get(id, userId);
}

function listUserFiles(userId) {
  return db.prepare('SELECT id, user_id, name, size, note, visibility, share_id, created_at, updated_at FROM user_files WHERE user_id = ? ORDER BY id DESC').all(userId);
}

function getOwnFile(id, userId) {
  return db.prepare('SELECT * FROM user_files WHERE id = ? AND user_id = ?').get(id, userId);
}

function getShare(shareId) {
  return db.prepare('SELECT * FROM user_files WHERE share_id = ? AND visibility = ?').get(shareId, 'public');
}

function updateUserFile(id, userId, patch) {
  const current = getOwnFile(id, userId);
  if (!current) return null;
  const visibility = patch.visibility === 'public' ? 'public' : 'private';
  if (visibility === 'public' && !patch.extractCode && !current.extract_code_hash) {
    throw new Error('Public shares require an extract code');
  }
  const shareId = visibility === 'public' ? current.share_id || randomToken(10) : null;
  const extractHash = patch.extractCode ? bcrypt.hashSync(String(patch.extractCode), 12) : visibility === 'public' ? current.extract_code_hash : null;
  db.prepare(`
    UPDATE user_files
    SET note = ?, visibility = ?, share_id = ?, extract_code_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(String(patch.note ?? current.note), visibility, shareId, extractHash, id, userId);
  return getUserFile(id, userId);
}

function verifyShareCode(file, code) {
  return Boolean(file?.extract_code_hash && bcrypt.compareSync(String(code || ''), file.extract_code_hash));
}

module.exports = {
  createUserFile,
  getOwnFile,
  getShare,
  listUserFiles,
  updateUserFile,
  verifyShareCode,
};
