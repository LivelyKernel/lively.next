/*global require*/

const {
  readFile,
  writeFile,
  exists,
  readdir,
  mkdir,
  rmdir,
  unlink,
  lstat,
  rename,
  createWriteStream,
  createReadStream,
} = (function () {
  const env = System.get('@system-env');
  return env.node && !env.browser && !env.nw;
})() ? require('fs') : {};

export {
  readFile,
  writeFile,
  exists,
  readdir,
  mkdir,
  rmdir,
  unlink,
  lstat,
  rename,
  createWriteStream,
  createReadStream,
}
