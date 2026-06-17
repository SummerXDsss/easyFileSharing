const state = {
  path: '/',
  entries: [],
  images: [],
  pendingDownload: null,
  authMode: 'login',
  user: JSON.parse(localStorage.getItem('efs_user') || 'null'),
  token: localStorage.getItem('efs_token') || '',
};

const els = {
  title: document.querySelector('#site-title'),
  logo: document.querySelector('#site-logo'),
  authArea: document.querySelector('#auth-area'),
  crumbs: document.querySelector('#crumbs'),
  search: document.querySelector('#search'),
  list: document.querySelector('#file-list'),
  empty: document.querySelector('#empty'),
  imageGrid: document.querySelector('#image-grid'),
  passwordModal: document.querySelector('#password-modal'),
  passwordForm: document.querySelector('#password-form'),
  password: document.querySelector('#download-password'),
  passwordTarget: document.querySelector('#password-target'),
  passwordError: document.querySelector('#password-error'),
  authModal: document.querySelector('#auth-modal'),
  authForm: document.querySelector('#auth-form'),
  authTitle: document.querySelector('#auth-title'),
  inviteField: document.querySelector('#invite-field'),
  authError: document.querySelector('#auth-error'),
  previewModal: document.querySelector('#preview-modal'),
  previewBody: document.querySelector('#preview-body'),
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}), ...authHeaders() };
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}

function fileIcon(entry) {
  if (entry.type === 'directory') return '📁';
  if (entry.image && entry.thumbnailUrl) return `<img class="thumb-mini" src="${entry.thumbnailUrl}" alt="">`;
  if (entry.video) return '🎞️';
  if (entry.protected) return '🔒';
  const ext = entry.name.split('.').pop().toLowerCase();
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '🗜️';
  if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return '🎵';
  if (['js', 'ts', 'css', 'html', 'json', 'py', 'go', 'java'].includes(ext)) return '⌘';
  if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(ext)) return '📄';
  return '📦';
}

function formatBytes(value) {
  if (value === null || value === undefined) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function staticUrl(filePath, password = '') {
  const segments = filePath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return `/files/${segments}${password ? `?password=${encodeURIComponent(password)}` : ''}`;
}

async function getDownloadUrl(entry, password = '') {
  if (entry.linkMode !== 'dynamic') return staticUrl(entry.path, password);
  const data = await api('/api/dynamic-link', {
    method: 'POST',
    body: JSON.stringify({ path: entry.path, password }),
  });
  return data.url;
}

function renderAuth() {
  if (!state.user) {
    els.authArea.innerHTML = `
      <button class="button secondary" id="login-open">登录</button>
      <button class="button" id="register-open">注册</button>
    `;
    document.querySelector('#login-open').addEventListener('click', () => openAuth('login'));
    document.querySelector('#register-open').addEventListener('click', () => openAuth('register'));
    return;
  }
  els.authArea.innerHTML = `
    <img class="avatar" src="${state.user.avatar}" alt="">
    <span>${escapeHtml(state.user.username)}</span>
    <button class="button secondary" id="logout">退出</button>
  `;
  document.querySelector('#logout').addEventListener('click', () => {
    state.user = null;
    state.token = '';
    localStorage.removeItem('efs_user');
    localStorage.removeItem('efs_token');
    renderAuth();
  });
}

function renderCrumbs() {
  const parts = state.path.split('/').filter(Boolean);
  const items = ['<button data-path="/">root</button>'];
  let current = '';
  parts.forEach((part) => {
    current += `/${part}`;
    items.push('<span>/</span>');
    items.push(`<button data-path="${escapeHtml(current)}">${escapeHtml(part)}</button>`);
  });
  els.crumbs.innerHTML = items.join('');
}

function statusPills(entry) {
  const pills = [];
  pills.push(entry.protected ? '<span class="pill locked">需要密码</span>' : '<span class="pill">公开</span>');
  if (entry.requireLogin) pills.push('<span class="pill locked">需登录</span>');
  if (entry.linkMode === 'dynamic') pills.push('<span class="pill">动态链接</span>');
  return pills.join(' ');
}

function renderRows() {
  const query = els.search.value.trim().toLowerCase();
  const entries = state.entries.filter((entry) => entry.name.toLowerCase().includes(query));
  els.empty.classList.toggle('hidden', entries.length > 0);
  els.list.innerHTML = entries.map((entry) => {
    const name = escapeHtml(entry.name);
    const itemPath = escapeHtml(entry.path);
    const icon = fileIcon(entry);
    const nameControl = entry.type === 'directory'
      ? `<button class="link-button" data-open="${itemPath}">${name}</button>`
      : `<button class="link-button" data-download="${itemPath}">${name}</button>`;
    const preview = entry.previewable ? `<button class="link-button" data-preview="${itemPath}" data-kind="${entry.video ? 'video' : 'image'}">预览</button>` : '';
    const action = entry.type === 'directory'
      ? `<button class="link-button" data-open="${itemPath}">进入</button>`
      : `<button class="button secondary" data-download="${itemPath}">下载</button> ${preview}`;
    return `
      <tr>
        <td><div class="name-cell"><span class="icon">${icon}</span>${nameControl}</div></td>
        <td>${escapeHtml(entry.note || '-')}</td>
        <td>${escapeHtml(entry.uploader || '-')}</td>
        <td class="size">${entry.type === 'directory' ? '-' : formatBytes(entry.size)}</td>
        <td class="time">${formatTime(entry.modifiedAt)}</td>
        <td>${entry.type === 'directory' ? '-' : statusPills(entry)}</td>
        <td>${action}</td>
      </tr>
    `;
  }).join('');
}

function renderImages() {
  els.imageGrid.innerHTML = state.images.map((entry) => `
    <button class="image-card" data-preview="${escapeHtml(entry.path)}" data-kind="image">
      <img src="${entry.thumbnailUrl}" alt="">
      <span>${escapeHtml(entry.name)}</span>
      <small>${escapeHtml(entry.note || entry.uploader || '')}</small>
    </button>
  `).join('') || '<div class="empty">暂无图片</div>';
}

async function loadConfig() {
  const config = await api('/api/config');
  document.title = config.siteTitle;
  els.title.textContent = config.siteTitle;
  if (config.siteLogo) {
    els.logo.src = config.siteLogo;
    els.logo.classList.remove('hidden');
  }
}

async function loadDirectory(path = '/') {
  const data = await api(`/api/list?path=${encodeURIComponent(path)}`);
  state.path = data.path;
  state.entries = data.entries;
  renderCrumbs();
  renderRows();
}

async function loadImages() {
  const data = await api('/api/images');
  state.images = data.images;
  renderImages();
}

function openPasswordModal(filePath) {
  state.pendingDownload = filePath;
  els.password.value = '';
  els.passwordError.textContent = '';
  els.passwordTarget.textContent = filePath;
  els.passwordModal.classList.add('open');
  els.password.focus();
}

function closePasswordModal() {
  els.passwordModal.classList.remove('open');
  state.pendingDownload = null;
}

function openAuth(mode) {
  state.authMode = mode;
  els.authTitle.textContent = mode === 'login' ? '登录' : '注册';
  els.inviteField.classList.toggle('hidden', mode === 'login');
  els.authError.textContent = '';
  els.authForm.reset();
  els.authModal.classList.add('open');
}

function closeAuth() {
  els.authModal.classList.remove('open');
}

async function startDownload(filePath, password = '') {
  const entry = state.entries.find((item) => item.path === filePath) || state.images.find((item) => item.path === filePath);
  if (!entry) return;
  if (entry.requireLogin && !state.user) {
    openAuth('login');
    return;
  }
  if (entry.protected && !password) {
    openPasswordModal(filePath);
    return;
  }
  const url = await getDownloadUrl(entry, password);
  window.location.href = url;
}

function openPreview(filePath, kind) {
  els.previewBody.innerHTML = kind === 'video'
    ? `<video controls autoplay src="/preview${filePath}"></video>`
    : `<img src="/preview${filePath}" alt="">`;
  els.previewModal.classList.add('open');
}

document.querySelectorAll('.nav-link').forEach((button) => {
  button.addEventListener('click', async () => {
    document.querySelectorAll('.nav-link').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    document.querySelector('#files-view').classList.toggle('hidden', button.dataset.view !== 'files');
    document.querySelector('#images-view').classList.toggle('hidden', button.dataset.view !== 'images');
    if (button.dataset.view === 'images') await loadImages();
  });
});

els.crumbs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-path]');
  if (button) loadDirectory(button.dataset.path);
});

els.list.addEventListener('click', (event) => {
  const openButton = event.target.closest('button[data-open]');
  const downloadButton = event.target.closest('button[data-download]');
  const previewButton = event.target.closest('button[data-preview]');
  if (openButton) loadDirectory(openButton.dataset.open);
  if (downloadButton) startDownload(downloadButton.dataset.download);
  if (previewButton) openPreview(previewButton.dataset.preview, previewButton.dataset.kind);
});

els.imageGrid.addEventListener('click', (event) => {
  const previewButton = event.target.closest('[data-preview]');
  if (previewButton) openPreview(previewButton.dataset.preview, previewButton.dataset.kind);
});

els.search.addEventListener('input', renderRows);
document.querySelector('#cancel-password').addEventListener('click', closePasswordModal);
document.querySelector('#auth-cancel').addEventListener('click', closeAuth);
document.querySelector('#preview-close').addEventListener('click', () => els.previewModal.classList.remove('open'));
document.querySelector('#refresh-images').addEventListener('click', loadImages);

els.passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await api('/api/check-password', {
      method: 'POST',
      body: JSON.stringify({ path: state.pendingDownload, password: els.password.value }),
    });
    const filePath = state.pendingDownload;
    const password = els.password.value;
    closePasswordModal();
    await startDownload(filePath, password);
  } catch {
    els.passwordError.textContent = '密码不正确';
  }
});

els.authForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.authError.textContent = '';
  try {
    const endpoint = state.authMode === 'login' ? '/api/login' : '/api/register';
    const data = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        username: document.querySelector('#auth-username').value,
        password: document.querySelector('#auth-password').value,
        inviteCode: document.querySelector('#auth-invite').value,
      }),
    });
    state.user = data.user;
    state.token = data.accessToken;
    localStorage.setItem('efs_user', JSON.stringify(state.user));
    localStorage.setItem('efs_token', state.token);
    closeAuth();
    renderAuth();
  } catch (error) {
    els.authError.textContent = error.message;
  }
});

loadConfig();
renderAuth();
loadDirectory().catch((error) => {
  els.empty.classList.remove('hidden');
  els.empty.textContent = error.message;
});
