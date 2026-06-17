const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const config = require('./config');

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS protected_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES admins(id)
    );

    CREATE TABLE IF NOT EXISTS download_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      protected INTEGER NOT NULL DEFAULT 0,
      user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      used_by INTEGER,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (used_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS file_meta (
      path TEXT PRIMARY KEY,
      note TEXT NOT NULL DEFAULT '',
      uploader TEXT NOT NULL DEFAULT '',
      uploader_id INTEGER,
      link_mode TEXT NOT NULL DEFAULT 'static',
      require_login INTEGER NOT NULL DEFAULT 0,
      dynamic_id TEXT UNIQUE,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploader_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS dynamic_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dynamic_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      path TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      note TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'private',
      share_id TEXT UNIQUE,
      extract_code_hash TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  const columns = db.prepare('PRAGMA table_info(download_logs)').all().map((row) => row.name);
  if (!columns.includes('user_id')) {
    db.exec('ALTER TABLE download_logs ADD COLUMN user_id INTEGER');
  }
}

function ensureAdmin() {
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(config.adminUsername);
  if (existing) return;
  const passwordHash = bcrypt.hashSync(config.adminPassword, 12);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(config.adminUsername, passwordHash);
}

function initDatabase() {
  migrate();
  ensureAdmin();
  ensureDefaults();
}

function ensureDefaults() {
  const defaults = [
    ['site_title', config.siteTitle],
    ['site_logo', ''],
    ['default_link_mode', 'static'],
    ['allowed_origins', config.allowedOrigins.join(',')],
    ['require_allowed_origin', config.requireAllowedOrigin ? '1' : '0'],
  ];
  const stmt = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  defaults.forEach(([key, value]) => stmt.run(key, value));
  const invite = db.prepare('SELECT id FROM invite_codes LIMIT 1').get();
  if (!invite) {
    db.prepare('INSERT INTO invite_codes (code) VALUES (?)').run('WELCOME');
  }
}

module.exports = {
  db,
  initDatabase,
};
