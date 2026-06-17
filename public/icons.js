window.EFSIcons = (() => {
  const paths = {
    folder: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H9l2 2h7.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-10Z"/>',
    file: '<path d="M7 3h6l4 4v14H7V3Z"/><path d="M13 3v5h5"/>',
    image: '<path d="M4 5h16v14H4V5Z"/><path d="m7 16 3.5-4 2.5 3 2-2.5 3 3.5"/><circle cx="9" cy="9" r="1.3"/>',
    video: '<path d="M4 6h11v12H4V6Z"/><path d="m15 10 5-3v10l-5-3v-4Z"/>',
    archive: '<path d="M7 3h10v18H7V3Z"/><path d="M10 3v18M14 3v18M10 7h4M10 11h4M10 15h4"/>',
    audio: '<path d="M9 18a3 3 0 1 1-2-2.83V6l10-2v11a3 3 0 1 1-2-2.83V7.2l-6 1.2V18Z"/>',
    code: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4M13 5l-2 14"/>',
    pdf: '<path d="M7 3h7l3 3v15H7V3Z"/><path d="M14 3v4h4"/><path d="M8.8 16.5c1.7-.5 3.5-2.5 4-6 .6 2.8 1.7 4.7 3.2 5.5-2-.6-4.7-.5-7.2.5Z"/>',
    word: '<path d="M5 4h14v16H5V4Z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
    sheet: '<path d="M5 4h14v16H5V4Z"/><path d="M5 10h14M5 15h14M10 4v16M15 4v16"/>',
    presentation: '<path d="M4 5h16v11H4V5Z"/><path d="M12 16v4M9 20h6M8 9h8M8 12h5"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
    exe: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/>',
    text: '<path d="M7 3h10v18H7V3Z"/><path d="M10 8h4M10 12h4M10 16h3"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    back: '<path d="M15 18 9 12l6-6"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
  };
  function icon(name, className = '') {
    return `<svg class="svg-icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
  }
  function file(entry = {}) {
    if (entry.type === 'directory') return icon('folder', 'kind-folder');
    if (entry.image) return icon('image', 'kind-image');
    if (entry.video) return icon('video', 'kind-video');
    if (entry.protected) return icon('lock', 'kind-lock');
    const ext = String(entry.name || '').split('.').pop().toLowerCase();
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return icon('archive', 'kind-archive');
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext)) return icon('audio', 'kind-audio');
    if (['js', 'ts', 'tsx', 'jsx', 'css', 'scss', 'html', 'json', 'xml', 'yml', 'yaml', 'py', 'go', 'java', 'c', 'cpp', 'cs', 'php', 'rs', 'sh', 'ps1'].includes(ext)) return icon('code', 'kind-code');
    if (ext === 'pdf') return icon('pdf', 'kind-pdf');
    if (['doc', 'docx'].includes(ext)) return icon('word', 'kind-word');
    if (['xls', 'xlsx', 'csv'].includes(ext)) return icon('sheet', 'kind-sheet');
    if (['ppt', 'pptx'].includes(ext)) return icon('presentation', 'kind-presentation');
    if (['db', 'sqlite', 'sql'].includes(ext)) return icon('database', 'kind-database');
    if (['exe', 'msi', 'bat', 'cmd'].includes(ext)) return icon('exe', 'kind-exe');
    if (['txt', 'md', 'log', 'ini', 'conf'].includes(ext)) return icon('text', 'kind-text');
    return icon('file', 'kind-file');
  }
  return { icon, file };
})();
