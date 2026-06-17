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
  const registerResponse = await fetch(`${base}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `u${Date.now()}`, password: 'password123', inviteCode }),
  });
  assert.equal(registerResponse.status, 201);
  const user = await registerResponse.json();
  const loginResponse = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user.user.username, password: 'password123' }),
  });
  assert.equal(loginResponse.status, 200);
  const cookieHeader = loginResponse.headers.get('set-cookie');
  assert.ok(cookieHeader, 'login should set a user_token cookie');
  const cookie = cookieHeader.split(';')[0];
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
  const cookieAuth = await fetch(`${base}${dynamic.url}`, {
    headers: { Cookie: cookie, Range: 'bytes=0-9' },
  });
  assert.equal(cookieAuth.status, 206);
  const form = new FormData();
  form.append('file', new Blob(['hello user space']), 'hello.txt');
  form.append('note', 'personal note');
  form.append('visibility', 'public');
  form.append('extractCode', 'pickme');
  const upload = await fetch(`${base}/api/me/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.accessToken}` },
    body: form,
  });
  assert.equal(upload.status, 201);
  const uploaded = await upload.json();
  const badShare = await fetch(`${base}/s/${uploaded.file.share_id}?code=wrong`);
  assert.equal(badShare.status, 403);
  const goodShare = await fetch(`${base}/s/${uploaded.file.share_id}?code=pickme`);
  assert.equal(goodShare.status, 200);
  console.log(JSON.stringify({
    adminLogin: Boolean(admin.accessToken),
    registered: user.user.username,
    dynamicUrl: dynamic.url,
    noAuthStatus: noAuth.status,
    authStatus: auth.status,
    cookieAuthStatus: cookieAuth.status,
    uploaded: uploaded.file.name,
    badShareStatus: badShare.status,
    goodShareStatus: goodShare.status,
    range: auth.headers.get('content-range'),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
