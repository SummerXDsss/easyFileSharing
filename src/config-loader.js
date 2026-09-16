const fs = require('fs');
const path = require('path');

function readConfigFile(filePath) {
  if (!filePath) return {};
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) return {};
  const raw = fs.readFileSync(absolute, 'utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function pickConfigValue(env, fileConfig, envName, fileName, fallback) {
  if (Object.prototype.hasOwnProperty.call(env, envName) && env[envName] !== '') return env[envName];
  if (Object.prototype.hasOwnProperty.call(fileConfig, envName) && fileConfig[envName] !== '') return fileConfig[envName];
  if (Object.prototype.hasOwnProperty.call(fileConfig, fileName) && fileConfig[fileName] !== '') return fileConfig[fileName];
  return fallback;
}

function hasConfiguredValue(env, fileConfig, envName, fileName) {
  return (
    (Object.prototype.hasOwnProperty.call(env, envName) && env[envName] !== '')
    || (Object.prototype.hasOwnProperty.call(fileConfig, envName) && fileConfig[envName] !== '')
    || (Object.prototype.hasOwnProperty.call(fileConfig, fileName) && fileConfig[fileName] !== '')
  );
}

function resolveConfigFile(rootDir, env = process.env) {
  if (env.CONFIG_FILE) return path.resolve(rootDir, env.CONFIG_FILE);
  if (env.EFS_CONFIG_FILE) return path.resolve(rootDir, env.EFS_CONFIG_FILE);
  const defaultPath = path.join(rootDir, 'config.json');
  return fs.existsSync(defaultPath) ? defaultPath : '';
}

module.exports = {
  hasConfiguredValue,
  pickConfigValue,
  readConfigFile,
  resolveConfigFile,
};
