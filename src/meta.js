const { db } = require('./db');
const { normalizeVirtualPath } = require('./paths');
const { randomToken } = require('./utils');

function ensureMeta(filePath) {
  const clean = normalizeVirtualPath(filePath);
  const existing = db.prepare('SELECT * FROM file_meta WHERE path = ?').get(clean);
  if (existing) return existing;
  const dynamicId = randomToken(12);
  db.prepare('INSERT INTO file_meta (path, dynamic_id) VALUES (?, ?)').run(clean, dynamicId);
  return db.prepare('SELECT * FROM file_meta WHERE path = ?').get(clean);
}

function getMeta(filePath) {
  return ensureMeta(filePath);
}

function listMeta() {
  return db.prepare('SELECT * FROM file_meta ORDER BY path COLLATE NOCASE').all();
}

function updateMeta(filePath, patch) {
  const clean = normalizeVirtualPath(filePath);
  const current = ensureMeta(clean);
  const note = patch.note === undefined ? current.note : String(patch.note || '');
  const uploader = patch.uploader === undefined ? current.uploader : String(patch.uploader || '');
  const uploaderId = patch.uploaderId === undefined ? current.uploader_id : patch.uploaderId || null;
  const linkMode = patch.linkMode === undefined ? current.link_mode : patch.linkMode === 'dynamic' ? 'dynamic' : 'static';
  const requireLogin = patch.requireLogin === undefined ? current.require_login : patch.requireLogin ? 1 : 0;
  const dynamicId = current.dynamic_id || randomToken(12);
  db.prepare(`
    UPDATE file_meta
    SET note = ?, uploader = ?, uploader_id = ?, link_mode = ?, require_login = ?, dynamic_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE path = ?
  `).run(note, uploader, uploaderId, linkMode, requireLogin, dynamicId, clean);
  return getMeta(clean);
}

function moveMeta(oldPath, newPath, isDirectory) {
  const oldClean = normalizeVirtualPath(oldPath);
  const newClean = normalizeVirtualPath(newPath);
  const rows = isDirectory
    ? db.prepare('SELECT path FROM file_meta WHERE path = ? OR path LIKE ?').all(oldClean, `${oldClean}/%`)
    : db.prepare('SELECT path FROM file_meta WHERE path = ?').all(oldClean);
  const update = db.prepare('UPDATE file_meta SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE path = ?');
  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const nextPath = isDirectory ? `${newClean}${row.path.slice(oldClean.length)}` : newClean;
      update.run(nextPath, row.path);
    });
  });
  tx();
  return rows.length;
}

module.exports = {
  ensureMeta,
  getMeta,
  listMeta,
  moveMeta,
  updateMeta,
};
