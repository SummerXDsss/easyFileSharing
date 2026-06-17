const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const sharp = require('sharp');
const config = require('./config');
const { resolveStoragePath } = require('./paths');
const { isImageFile, isVideoFile, sha256 } = require('./utils');

fs.mkdirSync(config.thumbsDir, { recursive: true });

function thumbPath(filePath) {
  return path.join(config.thumbsDir, `${sha256(filePath)}.jpg`);
}

async function ensureThumbnail(filePath) {
  const { absolute } = resolveStoragePath(filePath);
  const target = thumbPath(filePath);
  if (fs.existsSync(target)) return target;
  if (isImageFile(filePath)) {
    await sharp(absolute).rotate().resize(320, 220, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(target);
    return target;
  }
  if (isVideoFile(filePath)) {
    const result = spawnSync('ffmpeg', ['-y', '-ss', '00:00:01', '-i', absolute, '-frames:v', '1', '-vf', 'scale=320:-1', target], {
      stdio: 'ignore',
    });
    if (result.status === 0 && fs.existsSync(target)) return target;
  }
  return null;
}

module.exports = {
  ensureThumbnail,
};
