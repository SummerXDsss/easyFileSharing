const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { storageDir } = require('../src/config');
const { normalizeVirtualPath, resolveStoragePath } = require('../src/paths');

test('normalizes virtual paths to rooted posix paths', () => {
  assert.equal(normalizeVirtualPath('releases/app.zip'), '/releases/app.zip');
  assert.equal(normalizeVirtualPath('/docs/install.txt'), '/docs/install.txt');
  assert.equal(normalizeVirtualPath('/'), '/');
});

test('rejects traversal outside storage root', () => {
  assert.throws(() => resolveStoragePath('/../../secret.txt'), /Invalid path|escapes/);
});

test('resolves paths inside storage root', () => {
  const resolved = resolveStoragePath('/releases/app.zip');
  assert.equal(resolved.clean, '/releases/app.zip');
  assert.equal(resolved.absolute, path.join(storageDir, 'releases', 'app.zip'));
});
