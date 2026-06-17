const { db } = require('./db');

function getSetting(key, fallback = '') {
  const row = db.prepare('SELECT value FROM site_settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, String(value ?? ''));
}

function getSiteConfig() {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    siteTitle: settings.site_title || 'Mirror Download',
    siteLogo: settings.site_logo || '',
    defaultLinkMode: settings.default_link_mode || 'static',
    allowedOrigins: (settings.allowed_origins || '').split(',').map((item) => item.trim()).filter(Boolean),
    requireAllowedOrigin: settings.require_allowed_origin === '1',
  };
}

function updateSiteConfig(patch) {
  if (patch.siteTitle !== undefined) setSetting('site_title', patch.siteTitle);
  if (patch.siteLogo !== undefined) setSetting('site_logo', patch.siteLogo);
  if (patch.defaultLinkMode !== undefined) setSetting('default_link_mode', patch.defaultLinkMode === 'dynamic' ? 'dynamic' : 'static');
  if (patch.allowedOrigins !== undefined) {
    const value = Array.isArray(patch.allowedOrigins) ? patch.allowedOrigins.join(',') : String(patch.allowedOrigins || '');
    setSetting('allowed_origins', value);
  }
  if (patch.requireAllowedOrigin !== undefined) setSetting('require_allowed_origin', patch.requireAllowedOrigin ? '1' : '0');
  return getSiteConfig();
}

module.exports = {
  getSetting,
  getSiteConfig,
  setSetting,
  updateSiteConfig,
};
