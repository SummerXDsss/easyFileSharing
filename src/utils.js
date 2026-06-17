const crypto = require('crypto');
const path = require('path');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function isImageFile(filePath) {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(path.extname(filePath).toLowerCase());
}

function isVideoFile(filePath) {
  return ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'].includes(path.extname(filePath).toLowerCase());
}

function isPreviewable(filePath) {
  return isImageFile(filePath) || isVideoFile(filePath);
}

function avatarFor(username) {
  const hash = sha256(username).slice(0, 16);
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(hash)}`;
}

module.exports = {
  avatarFor,
  isImageFile,
  isPreviewable,
  isVideoFile,
  randomToken,
  sha256,
};
