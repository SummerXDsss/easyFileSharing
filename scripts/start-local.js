const { spawnSync } = require('child_process');

function readArg(name, fallback) {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

const env = { ...process.env };
env.PORT = readArg('port', env.PORT || '3000');

const result = spawnSync(process.execPath, ['src/server.js'], {
  env,
  stdio: 'inherit',
  shell: false,
});

process.exit(result.status ?? 1);
