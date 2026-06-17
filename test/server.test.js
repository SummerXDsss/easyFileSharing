const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStaticUrl, contentDisposition } = require('../src/download');

test('content disposition includes fallback and utf-8 filenames', () => {
  assert.equal(
    contentDisposition('安装包 1.0.zip'),
    'attachment; filename="___ 1.0.zip"; filename*=UTF-8\'\'%E5%AE%89%E8%A3%85%E5%8C%85%201.0.zip',
  );
});

test('legacy download URL redirects to a URL that includes the real filename', () => {
  assert.equal(
    buildStaticUrl('/docs/install.txt'),
    '/files/docs/install.txt',
  );
});
