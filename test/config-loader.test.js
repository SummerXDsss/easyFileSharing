const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasConfiguredValue,
  pickConfigValue,
} = require('../src/config-loader');

test('environment variables override config file values', () => {
  const env = { ADMIN_PASSWORD: 'from-env' };
  const file = { adminPassword: 'from-file', ADMIN_PASSWORD: 'from-file-env-name' };
  assert.equal(pickConfigValue(env, file, 'ADMIN_PASSWORD', 'adminPassword', 'fallback'), 'from-env');
});

test('config file supports camelCase and environment-style keys', () => {
  assert.equal(pickConfigValue({}, { adminPassword: 'camel' }, 'ADMIN_PASSWORD', 'adminPassword', 'fallback'), 'camel');
  assert.equal(pickConfigValue({}, { ADMIN_PASSWORD: 'upper' }, 'ADMIN_PASSWORD', 'adminPassword', 'fallback'), 'upper');
});

test('configured value detection ignores empty values', () => {
  assert.equal(hasConfiguredValue({ ADMIN_PASSWORD: '' }, {}, 'ADMIN_PASSWORD', 'adminPassword'), false);
  assert.equal(hasConfiguredValue({}, { adminPassword: 'secret' }, 'ADMIN_PASSWORD', 'adminPassword'), true);
});
