const { spawnSync } = require('child_process');

function readArg(name, fallback) {
  const flag = `--${name}`;
  const equalsPrefix = `${flag}=`;
  const equalsArg = process.argv.find((arg) => arg.startsWith(equalsPrefix));
  if (equalsArg) return equalsArg.slice(equalsPrefix.length);
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const env = { ...process.env };
env.PORT = readArg('container-port', env.PORT || '3000');
env.HOST_PORT = readArg('port', env.HOST_PORT || '3001');
env.ADMIN_USERNAME = readArg('admin-username', env.ADMIN_USERNAME || 'admin');
env.ADMIN_PASSWORD = readArg('admin-password', env.ADMIN_PASSWORD || 'admin123456');

const args = ['compose', 'up', '-d', '--build'];
const result = spawnSync('docker', args, {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
