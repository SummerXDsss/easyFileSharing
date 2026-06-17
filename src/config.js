const path = require('path');

const rootDir = path.resolve(__dirname, '..');

module.exports = {
  rootDir,
  publicDir: path.join(rootDir, 'public'),
  storageDir: path.join(rootDir, 'storage'),
  dataDir: path.join(rootDir, 'data'),
  thumbsDir: path.join(rootDir, 'data', 'thumbs'),
  dbPath: path.join(rootDir, 'data', 'download-site.sqlite'),
  port: Number(process.env.PORT || 3000),
  siteTitle: process.env.SITE_TITLE || 'Mirror Download',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123456',
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
  tkSecret: process.env.TK_SECRET || 'dev-refresh-secret-change-me',
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL || '15m',
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  dynamicTokenTtlSeconds: Number(process.env.DYNAMIC_TOKEN_TTL_SECONDS || 600),
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean),
  requireAllowedOrigin: process.env.REQUIRE_ALLOWED_ORIGIN === 'true',
  enableAdminGit: process.env.ENABLE_ADMIN_GIT === 'true',
};
