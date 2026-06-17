let accessToken = '';
let currentPath = '/';
let currentFiles = [];

const $ = (selector) => document.querySelector(selector);
const loginView = $('#login-view');
const adminView = $('#admin-view');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response = await fetch(url, { ...options, headers });
  if (response.status === 401 && url !== '/api/admin/refresh') {
    const refreshed = await fetch('/api/admin/refresh', { method: 'POST' });
    if (refreshed.ok) {
      const data = await refreshed.json();
      accessToken = data.accessToken;
      headers.Authorization = `Bearer ${accessToken}`;
      response = await fetch(url, { ...options, headers });
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showAdmin() { loginView.classList.add('hidden'); adminView.classList.remove('hidden'); }
function showLogin() { adminView.classList.add('hidden'); loginView.classList.remove('hidden'); }

function icon(entry) {
  if (entry.type === 'directory') return '📁';
  if (entry.image) return '🖼️';
  if (entry.video) return '🎞️';
  return '📄';
}

function formatBytes(value) {
  if (!value) return value === 0 ? '0 B' : '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function renderCrumbs() {
  const parts = currentPath.split('/').filter(Boolean);
  const items = ['<button data-path="/">root</button>'];
  let cur = '';
  parts.forEach((part) => {
    cur += `/${part}`;
    items.push('<span>/</span>');
    items.push(`<button data-path="${escapeHtml(cur)}">${escapeHtml(part)}</button>`);
  });
  $('#admin-crumbs').innerHTML = items.join('');
}

async function loadFiles(path = currentPath) {
  const data = await api(`/api/admin/files?path=${encodeURIComponent(path)}`);
  currentPath = data.path;
  currentFiles = data.entries;
  renderCrumbs();
  $('#admin-file-list').innerHTML = data.entries.map((entry) => `
    <tr>
      <td><div class="name-cell"><span class="icon">${icon(entry)}</span>${entry.type === 'directory' ? `<button class="link-button" data-open="${escapeHtml(entry.path)}">${escapeHtml(entry.name)}</button>` : escapeHtml(entry.name)}</div></td>
      <td><input class="table-input" data-note="${escapeHtml(entry.path)}" value="${escapeHtml(entry.note || '')}"></td>
      <td>${entry.type === 'file' ? `<select data-mode="${escapeHtml(entry.path)}"><option value="static" ${entry.linkMode === 'static' ? 'selected' : ''}>静态</option><option value="dynamic" ${entry.linkMode === 'dynamic' ? 'selected' : ''}>动态</option></select>` : '-'}</td>
      <td>${entry.type === 'file' ? `<input type="checkbox" data-login="${escapeHtml(entry.path)}" ${entry.requireLogin ? 'checked' : ''}>` : '-'}</td>
      <td class="size">${entry.type === 'directory' ? '-' : formatBytes(entry.size)}</td>
      <td>
        <button class="link-button" data-rename="${escapeHtml(entry.path)}">更名</button>
        ${entry.type === 'file' ? `<button class="link-button" data-save-meta="${escapeHtml(entry.path)}">保存</button><button class="link-button" data-token="${escapeHtml(entry.path)}">动态链接</button>` : ''}
      </td>
    </tr>
  `).join('');
}

async function loadConfig() {
  const cfg = await api('/api/admin/config');
  $('#site-title-input').value = cfg.siteTitle || '';
  $('#site-logo-input').value = cfg.siteLogo || '';
  $('#default-link-mode').value = cfg.defaultLinkMode || 'static';
  $('#allowed-origins').value = (cfg.allowedOrigins || []).join(',');
  $('#require-origin').checked = Boolean(cfg.requireAllowedOrigin);
}

async function loadRules() {
  const { rules } = await api('/api/admin/rules');
  $('#rules-list').innerHTML = rules.map((rule) => `
    <tr>
      <td><span class="path-code">${escapeHtml(rule.path)}</span></td>
      <td>${escapeHtml(rule.note || '-')}</td>
      <td>${rule.enabled ? '<span class="pill locked">启用</span>' : '<span class="pill">停用</span>'}</td>
      <td><button class="link-button" data-fill-rule="${rule.id}" data-path="${escapeHtml(rule.path)}" data-note="${escapeHtml(rule.note || '')}" data-enabled="${rule.enabled}">编辑</button><button class="link-button" data-delete-rule="${rule.id}">删除</button></td>
    </tr>
  `).join('');
}

async function loadInvites() {
  const { invites } = await api('/api/admin/invites');
  $('#invites-list').innerHTML = invites.map((invite) => `
    <tr><td><span class="path-code">${escapeHtml(invite.code)}</span></td><td>${invite.used_by || '-'}</td><td>${invite.used_at || '-'}</td><td>${invite.created_at}</td></tr>
  `).join('');
}

async function loadLogs() {
  const { logs } = await api('/api/admin/logs');
  $('#logs-list').innerHTML = logs.map((log) => `
    <tr><td><span class="path-code">${escapeHtml(log.path)}</span></td><td>${escapeHtml(log.ip || '-')}</td><td>${log.protected ? '是' : '否'}</td><td>${log.user_id || '-'}</td><td class="time">${escapeHtml(log.created_at)}</td></tr>
  `).join('');
}

async function bootstrap() {
  try {
    const data = await api('/api/admin/refresh', { method: 'POST' });
    accessToken = data.accessToken;
    showAdmin();
    await Promise.all([loadFiles('/'), loadConfig(), loadRules(), loadInvites(), loadLogs()]);
  } catch {
    showLogin();
  }
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#login-error').textContent = '';
  try {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: $('#username').value, password: $('#password').value }),
    });
    accessToken = data.accessToken;
    showAdmin();
    await Promise.all([loadFiles('/'), loadConfig(), loadRules(), loadInvites(), loadLogs()]);
  } catch (error) {
    $('#login-error').textContent = error.message;
  }
});

$('#logout').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  accessToken = '';
  showLogin();
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', async () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
    tab.classList.add('active');
    ['files', 'config', 'rules', 'invites', 'logs', 'git', 'password'].forEach((name) => {
      $(`#${name}-tab`).classList.toggle('hidden', tab.dataset.tab !== name);
    });
    if (tab.dataset.tab === 'logs') await loadLogs();
  });
});

$('#admin-crumbs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-path]');
  if (button) loadFiles(button.dataset.path);
});

$('#admin-file-list').addEventListener('click', async (event) => {
  const open = event.target.closest('[data-open]');
  const rename = event.target.closest('[data-rename]');
  const save = event.target.closest('[data-save-meta]');
  const token = event.target.closest('[data-token]');
  if (open) await loadFiles(open.dataset.open);
  if (rename) {
    const newName = prompt('新名称');
    if (newName) {
      await api('/api/admin/rename', { method: 'POST', body: JSON.stringify({ path: rename.dataset.rename, newName }) });
      await Promise.all([loadFiles(), loadRules()]);
    }
  }
  if (save) {
    const path = save.dataset.saveMeta;
    await api('/api/admin/meta', {
      method: 'PUT',
      body: JSON.stringify({
        path,
        note: document.querySelector(`[data-note="${CSS.escape(path)}"]`).value,
        linkMode: document.querySelector(`[data-mode="${CSS.escape(path)}"]`).value,
        requireLogin: document.querySelector(`[data-login="${CSS.escape(path)}"]`).checked,
      }),
    });
    await loadFiles();
  }
  if (token) {
    const data = await api('/api/admin/dynamic-token', { method: 'POST', body: JSON.stringify({ path: token.dataset.token }) });
    prompt('10 分钟动态链接', `${location.origin}${data.url}`);
  }
});

$('#upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData();
  form.append('dir', currentPath);
  form.append('note', $('#upload-note').value);
  form.append('file', $('#upload-file').files[0]);
  try {
    await api('/api/admin/upload', { method: 'POST', body: form, headers: {} });
    $('#upload-file').value = '';
    $('#upload-note').value = '';
    await loadFiles();
  } catch (error) {
    $('#file-error').textContent = error.message;
  }
});

$('#config-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({
        siteTitle: $('#site-title-input').value,
        siteLogo: $('#site-logo-input').value,
        defaultLinkMode: $('#default-link-mode').value,
        allowedOrigins: $('#allowed-origins').value,
        requireAllowedOrigin: $('#require-origin').checked,
      }),
    });
    $('#config-error').textContent = '已保存';
  } catch (error) {
    $('#config-error').textContent = error.message;
  }
});

$('#rule-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/rules', {
      method: 'POST',
      body: JSON.stringify({ path: $('#rule-path').value, password: $('#rule-password').value, note: $('#rule-note').value, enabled: $('#rule-enabled').value === '1' }),
    });
    $('#rule-password').value = '';
    await Promise.all([loadRules(), loadFiles()]);
  } catch (error) {
    $('#rule-error').textContent = error.message;
  }
});

$('#rules-list').addEventListener('click', async (event) => {
  const fill = event.target.closest('[data-fill-rule]');
  const del = event.target.closest('[data-delete-rule]');
  if (fill) {
    $('#rule-path').value = fill.dataset.path;
    $('#rule-note').value = fill.dataset.note;
    $('#rule-enabled').value = fill.dataset.enabled === '1' ? '1' : '0';
    $('#rule-password').focus();
  }
  if (del && confirm('删除这条保护规则？')) {
    await api(`/api/admin/rules/${del.dataset.deleteRule}`, { method: 'DELETE' });
    await Promise.all([loadRules(), loadFiles()]);
  }
});

$('#invite-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/invites', { method: 'POST', body: JSON.stringify({ code: $('#invite-code').value }) });
    $('#invite-code').value = '';
    await loadInvites();
  } catch (error) {
    $('#invite-error').textContent = error.message;
  }
});

document.querySelectorAll('[data-git]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      const body = button.dataset.git === 'commit' ? JSON.stringify({ message: $('#git-message').value }) : '{}';
      const data = await api(`/api/admin/git/${button.dataset.git}`, { method: 'POST', body });
      $('#git-output').textContent = data.output || 'OK';
    } catch (error) {
      $('#git-output').textContent = error.message;
    }
  });
});

$('#password-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ currentPassword: $('#current-password').value, newPassword: $('#new-password').value }) });
    $('#password-error').textContent = '密码已更新';
  } catch (error) {
    $('#password-error').textContent = error.message;
  }
});

bootstrap();
