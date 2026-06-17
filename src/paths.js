const fs = require('fs');
const path = require('path');
const { storageDir } = require('./config');

function normalizeVirtualPath(input = '/') {
  const raw = String(input || '/').replace(/\\/g, '/');
  if (raw.includes('\0')) {
    throw new Error('Invalid path');
  }
  if (raw.split('/').includes('..')) {
    throw new Error('Invalid path');
  }
  const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
  const normalized = path.posix.normalize(prefixed);
  return normalized === '.' ? '/' : normalized;
}

function resolveStoragePath(virtualPath = '/') {
  const clean = normalizeVirtualPath(virtualPath);
  const relative = clean.slice(1).split('/').filter(Boolean).join(path.sep);
  const absolute = path.resolve(storageDir, relative);
  const storageRoot = path.resolve(storageDir);
  if (absolute !== storageRoot && !absolute.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error('Path escapes storage root');
  }
  return { clean, absolute };
}

function assertStorageExists() {
  fs.mkdirSync(storageDir, { recursive: true });
}

module.exports = {
  normalizeVirtualPath,
  resolveStoragePath,
  assertStorageExists,
};
