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
} = System.get('@system-env').node ? require('fs') : {};

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