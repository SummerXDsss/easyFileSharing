const assert = require('node:assert/strict');

const base = 'http://127.0.0.1:3000';

async function json(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.error || ''}`);
  return body;
}

async function main() {
  const admin = await json('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123456' }),
  });
  const adminHeaders = { Authorization: `Bearer ${admin.accessToken}` };
  const inviteCode = `T${Date.now()}`;
  await json('/api/admin/invites', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ code: inviteCode }),
  });
  const user = await json('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username: `u${Date.now()}`, password: 'password123', inviteCode }),
  });
  await json('/api/admin/meta', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ path: '/README.txt', linkMode: 'dynamic', requireLogin: true, note: 'Root readme', uploader: 'admin' }),
  });
  const dynamic = await json('/api/admin/dynamic-token', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ path: '/README.txt' }),
  });
  const noAuth = await fetch(`${base}${dynamic.url}`);
  assert.equal(noAuth.status, 401);
  const auth = await fetch(`${base}${dynamic.url}`, {
    headers: { Authorization: `Bearer ${user.accessToken}`, Range: 'bytes=0-9' },
  });
  assert.equal(auth.status, 206);
  assert.equal(auth.headers.get('content-range'), 'bytes 0-9/107');
  console.log(JSON.stringify({
    adminLogin: Boolean(admin.accessToken),
    registered: user.user.username,
    dynamicUrl: dynamic.url,
    noAuthStatus: noAuth.status,
    authStatus: auth.status,
    range: auth.headers.get('content-range'),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
