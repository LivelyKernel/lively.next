/*global process*/
import path from 'node:path';

const majorVersion = Number(process.versions.node.split('.')[0]);
if (majorVersion < 24) {
  console.error('Your node.js version %s is not supported by lively.next. Please use Node.js 24.', process.versions.node);
  process.exit(1);
}

if (!process.argv[2]) {
  console.error('No installation dir specified!');
  process.exit(1);
}

global.$__curScript = undefined;
const installDir = path.resolve(process.argv[2]);

try {
  const installer = await import('./install.js');
  await installer.install(installDir);
} catch (err) {
  console.error(err.stack || err);
  process.exit(1);
}
