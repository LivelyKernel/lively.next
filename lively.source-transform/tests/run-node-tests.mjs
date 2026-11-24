import './node-bootstrap.mjs';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(new URL('../../mocha-es6/package.json', import.meta.url));
const Mocha = require('mocha');
const mocha = new Mocha({ timeout: 20000 });
const files = process.argv.slice(2);
if (!files.length) files.push(...[
  './babel-test.js', './capturing-test.js', './module-transforms-test.js',
  '../../lively.classes/tests/class-to-function-transform-test.js'
].map(file => fileURLToPath(new URL(file, import.meta.url))));
for (const file of files) {
  mocha.suite.emit('pre-require', globalThis, file, mocha);
  await import(pathToFileURL(path.resolve(file)).href);
}
mocha.run(failures => { process.exitCode = failures ? 1 : 0; });
