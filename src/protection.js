const bcrypt = require('bcryptjs');
const { db } = require('./db');
const { normalizeVirtualPath } = require('./paths');

function getRule(path) {
  const clean = normalizeVirtualPath(path);
  return db.prepare('SELECT * FROM protected_paths WHERE path = ? AND enabled = 1').get(clean);
}

function isProtected(path) {
  return Boolean(getRule(path));
}

function verifyDownloadPassword(path, password) {
  const rule = getRule(path);
  if (!rule) return true;
  return bcrypt.compareSync(String(password || ''), rule.password_hash);
}

function listRules() {
  return db.prepare(`
    SELECT id, path, note, enabled, created_at, updated_at
    FROM protected_paths
    ORDER BY path COLLATE NOCASE
  `).all();
}

function upsertRule({ path, password, note = '', enabled = true }) {
  const clean = normalizeVirtualPath(path);
  if (!password || String(password).length < 1) {
    throw new Error('Password is required');
  }
  const passwordHash = bcrypt.hashSync(String(password), 12);
  db.prepare(`
    INSERT INTO protected_paths (path, password_hash, note, enabled, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(path) DO UPDATE SET
      password_hash = excluded.password_hash,
      note = excluded.note,
      enabled = excluded.enabled,
      updated_at = CURRENT_TIMESTAMP
  `).run(clean, passwordHash, String(note || ''), enabled ? 1 : 0);
  return db.prepare('SELECT id, path, note, enabled, created_at, updated_at FROM protected_paths WHERE path = ?').get(clean);
}

function updateRule(id, patch) {
  const current = db.prepare('SELECT * FROM protected_paths WHERE id = ?').get(id);
  if (!current) return null;
  const clean = patch.path ? normalizeVirtualPath(patch.path) : current.path;
  const passwordHash = patch.password
    ? bcrypt.hashSync(String(patch.password), 12)
    : current.password_hash;
  const note = patch.note === undefined ? current.note : String(patch.note || '');
  const enabled = patch.enabled === undefined ? current.enabled : patch.enabled ? 1 : 0;
  db.prepare(`
    UPDATE protected_paths
    SET path = ?, password_hash = ?, note = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(clean, passwordHash, note, enabled, id);
  return db.prepare('SELECT id, path, note, enabled, created_at, updated_at FROM protected_paths WHERE id = ?').get(id);
}

function deleteRule(id) {
  return db.prepare('DELETE FROM protected_paths WHERE id = ?').run(id).changes > 0;
}

function moveRules(oldPath, newPath, isDirectory) {
  const oldClean = normalizeVirtualPath(oldPath);
  const newClean = normalizeVirtualPath(newPath);
  const rows = isDirectory
    ? db.prepare('SELECT id, path FROM protected_paths WHERE path = ? OR path LIKE ?').all(oldClean, `${oldClean}/%`)
    : db.prepare('SELECT id, path FROM protected_paths WHERE path = ?').all(oldClean);

  const update = db.prepare('UPDATE protected_paths SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const tx = db.transaction(() => {
    rows.forEach((row) => {
      const nextPath = isDirectory
        ? `${newClean}${row.path.slice(oldClean.length)}`
        : newClean;
      update.run(nextPath, row.id);
    });
  });
  tx();
  return rows.length;
}

module.exports = {
  deleteRule,
  getRule,
  isProtected,
  listRules,
  moveRules,
  updateRule,
  upsertRule,
  verifyDownloadPassword,
};
