const path = require('path');
require('dotenv').config();
const {
  hasConfiguredValue,
  pickConfigValue,
  readConfigFile,
  resolveConfigFile,
} = require('./config-loader');

const rootDir = path.resolve(__dirname, '..');
const configFile = resolveConfigFile(rootDir);
const fileConfig = readConfigFile(configFile);

module.exports = {
  rootDir,
  configFile,
  publicDir: path.join(rootDir, 'public'),
  storageDir: path.join(rootDir, 'storage'),
  userUploadsDir: path.join(rootDir, 'user_uploads'),
  dataDir: path.join(rootDir, 'data'),
  thumbsDir: path.join(rootDir, 'data', 'thumbs'),
  dbPath: path.join(rootDir, 'data', 'download-site.sqlite'),
  port: Number(pickConfigValue(process.env, fileConfig, 'PORT', 'port', 3000)),
  siteTitle: pickConfigValue(process.env, fileConfig, 'SITE_TITLE', 'siteTitle', 'Mirror Download'),
  adminUsername: pickConfigValue(process.env, fileConfig, 'ADMIN_USERNAME', 'adminUsername', 'admin'),
  adminPassword: pickConfigValue(process.env, fileConfig, 'ADMIN_PASSWORD', 'adminPassword', 'admin123456'),
  adminPasswordConfigured: hasConfiguredValue(process.env, fileConfig, 'ADMIN_PASSWORD', 'adminPassword'),
  jwtSecret: pickConfigValue(process.env, fileConfig, 'JWT_SECRET', 'jwtSecret', 'dev-jwt-secret-change-me'),
  tkSecret: pickConfigValue(process.env, fileConfig, 'TK_SECRET', 'tkSecret', 'dev-refresh-secret-change-me'),
  accessTokenTtl: pickConfigValue(process.env, fileConfig, 'ACCESS_TOKEN_TTL', 'accessTokenTtl', '15m'),
  refreshTokenTtlDays: Number(pickConfigValue(process.env, fileConfig, 'REFRESH_TOKEN_TTL_DAYS', 'refreshTokenTtlDays', 30)),
  dynamicTokenTtlSeconds: Number(pickConfigValue(process.env, fileConfig, 'DYNAMIC_TOKEN_TTL_SECONDS', 'dynamicTokenTtlSeconds', 600)),
  allowedOrigins: String(pickConfigValue(process.env, fileConfig, 'ALLOWED_ORIGINS', 'allowedOrigins', '')).split(',').map((item) => item.trim()).filter(Boolean),
  requireAllowedOrigin: String(pickConfigValue(process.env, fileConfig, 'REQUIRE_ALLOWED_ORIGIN', 'requireAllowedOrigin', 'false')) === 'true',
  enableAdminGit: String(pickConfigValue(process.env, fileConfig, 'ENABLE_ADMIN_GIT', 'enableAdminGit', 'false')) === 'true',
};
