const fs = require('fs');
const path = require('path');
const { normalizeVirtualPath, resolveStoragePath } = require('./paths');
const { isImageFile, isPreviewable, isVideoFile } = require('./utils');
const { getMeta } = require('./meta');
const { isProtected } = require('./protection');

function formatEntryStats(stats) {
  return {
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
}

function listDirectory(virtualPath = '/') {
  const { clean, absolute } = resolveStoragePath(virtualPath);
  const stats = fs.statSync(absolute);
  if (!stats.isDirectory()) {
    const error = new Error('Path is not a directory');
    error.status = 400;
    throw error;
  }
  const entries = fs.readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => {
      const childVirtual = normalizeVirtualPath(path.posix.join(clean, entry.name));
      const childAbsolute = path.join(absolute, entry.name);
      const childStats = fs.statSync(childAbsolute);
      const meta = entry.isFile() ? getMeta(childVirtual) : null;
      return {
        name: entry.name,
        path: childVirtual,
        type: entry.isDirectory() ? 'directory' : 'file',
        protected: entry.isFile() ? isProtected(childVirtual) : false,
        note: meta?.note || '',
        uploader: meta?.uploader || '',
        linkMode: meta?.link_mode || 'static',
        requireLogin: Boolean(meta?.require_login),
        dynamicId: meta?.dynamic_id || '',
        previewable: entry.isFile() ? isPreviewable(childVirtual) : false,
        image: entry.isFile() ? isImageFile(childVirtual) : false,
        video: entry.isFile() ? isVideoFile(childVirtual) : false,
        thumbnailUrl: entry.isFile() && isPreviewable(childVirtual) ? `/thumb${childVirtual}` : '',
        previewUrl: entry.isFile() && isPreviewable(childVirtual) ? `/preview${childVirtual}` : '',
        ...formatEntryStats(childStats),
      };
    })
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' });
    });

  return {
    path: clean,
    parent: clean === '/' ? null : normalizeVirtualPath(path.posix.dirname(clean)),
    entries,
  };
}

module.exports = {
  formatEntryStats,
  listDirectory,
};
