// NW.js integration fixtures export a function; standalone Node tests use -test.cjs.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');
const directory = join(__dirname, '../tests');
for (const file of readdirSync(directory).filter(file => file.endsWith('-test.cjs')).sort()) {
  const result = spawnSync(process.execPath, [join(directory, file)], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
