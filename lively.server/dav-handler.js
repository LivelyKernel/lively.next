/* global process */
import fs from 'node:fs';
import path from 'node:path';
import { STATUS_CODES } from 'node:http';
import { randomBytes } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

/*
 * The part of WebDAV (RFC 4918) that Lively uses to read and edit the files
 * below a root directory: GET, HEAD, PUT, DELETE, MKCOL, PROPFIND and OPTIONS.
 * The main client is the http resource of lively.resources, which also parses
 * the PROPFIND answer. File bodies are streamed in both directions.
 */

const METHODS = ['OPTIONS', 'GET', 'HEAD', 'PUT', 'DELETE', 'MKCOL', 'PROPFIND'];

/** A PUT writes into `.lively-put-` and 12 hex digits next to its target. */
const temporaryName = () => '.lively-put-' + randomBytes(6).toString('hex');
const TEMPORARY_NAME = /^\.lively-put-[0-9a-f]{12}$/;

const CONTENT_TYPES = Object.fromEntries(Object.entries({
  'application/javascript; charset=utf-8': 'js mjs cjs',
  'application/json': 'json map',
  'application/wasm': 'wasm',
  'application/xml': 'xml xsl',
  'application/xhtml+xml': 'xhtml',
  'application/pdf': 'pdf',
  'application/zip': 'zip',
  'application/x-gzip': 'gz',
  'application/x-tar': 'tar',
  'text/html; charset=utf-8': 'html htm',
  'text/css; charset=utf-8': 'css',
  'text/plain; charset=utf-8': 'txt text log conf',
  'text/csv; charset=utf-8': 'csv',
  'text/yaml; charset=utf-8': 'yaml yml',
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tif tiff',
  'image/vnd.microsoft.icon': 'ico',
  'font/otf': 'otf',
  'font/ttf': 'ttf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'audio/mpeg': 'mp3',
  'audio/x-wav': 'wav',
  'application/ogg': 'ogg',
  'video/mp4': 'mp4 m4v',
  'video/webm': 'webm',
  'video/quicktime': 'mov'
}).flatMap(([type, extensions]) => extensions.split(' ').map(ext => ['.' + ext, type])));

/** The Content-Type for a file name; also used by dav.js for the desktop app. */
export function contentType (filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

/**
 * An error answered with `status`. A factory, not an Error subclass: the class
 * transform of lively.modules would drop the message of a subclass.
 */
function davError (status, message = STATUS_CODES[status]) {
  return Object.assign(new Error(message), { status });
}

/**
 * Maps a request URL to `{ relative, file }`: the decoded path below the root
 * without surrounding slashes, and its location in the file system.
 * `baseURI` is the URL prefix of the root directory.
 */
export function resolveTarget (rootDirectory, url, baseURI = '/') {
  let pathname;
  if (url.startsWith('/')) pathname = url.replace(/[?#].*$/, ''); // origin form, also for "//a.js"
  else {
    try { pathname = new URL(url).pathname; } catch (err) { throw davError(400, 'Malformed URL'); }
  }
  if (pathname + '/' === baseURI) pathname = baseURI;
  if (!pathname.startsWith(baseURI)) throw davError(403, `${pathname} is outside of ${baseURI}`);
  try {
    pathname = decodeURIComponent(pathname.slice(baseURI.length));
  } catch (err) { throw davError(400, 'Malformed URL encoding'); }
  if (pathname.includes('\0')) throw davError(400, 'Invalid path');
  const root = path.resolve(rootDirectory);
  const file = path.resolve(root, pathname.replace(/^[/\\]+/, ''));
  const relative = path.relative(root, file);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) throw davError(403, 'Path is outside of the root directory');
  return { relative: relative.split(path.sep).join('/'), file };
}

/** File system errors that mean "there is no such resource". */
const NOT_FOUND = ['ENOENT', 'ENOTDIR', 'ENAMETOOLONG', 'ELOOP'];

/** `stat` follows symbolic links, so linked files and directories are served like their targets. */
async function statOrNull (file, stat = fs.promises.stat) {
  try {
    return await stat(file, { bigint: true });
  } catch (err) {
    if (NOT_FOUND.includes(err.code)) return null;
    throw err;
  }
}

/** The format predates this handler; keep it so that browser caches stay valid. */
function etag (stat) {
  return `"${stat.ino}-${stat.size}-${stat.mtimeNs}"`;
}

/** Also used for HTML: numeric character references are valid in both. */
function escapeXml (string) {
  return string.replace(/[&"<>']/g, char => `&#${char.charCodeAt(0)};`);
}

/** Encodes with `encodeURI` plus `#` and `?`; collections end in a slash. */
export function hrefFor (baseURI, relative, isDirectory) {
  const href = baseURI + relative + (isDirectory && relative ? '/' : '');
  return encodeURI(href).replace(/#/g, '%23').replace(/\?/g, '%3F');
}

/** The entity tags of an If-Match or If-None-Match header. */
function entityTags (header) {
  return header.split(',').map(tag => tag.trim());
}

/** Whether a GET can be answered with 304. */
function isNotModified (req, headers) {
  const ifNoneMatch = req.headers['if-none-match'];
  // RFC 9110: entity tags take precedence over dates, and GET compares them weakly.
  if (ifNoneMatch) {
    return ifNoneMatch.trim() === '*' ||
      entityTags(ifNoneMatch).some(tag => tag.replace(/^W\//, '') === headers.etag);
  }
  const since = Date.parse(req.headers['if-modified-since']);
  return Date.parse(headers['last-modified']) <= since;
}

/** Returns `{ start, end }` (inclusive), null to send everything, or false if unsatisfiable. */
function byteRange (req, headers, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  const ifRange = req.headers['if-range'];
  if (ifRange && ifRange !== headers.etag && ifRange !== headers['last-modified']) return null;
  // RFC 9110: a last position before the first one makes the header invalid, so it is ignored.
  if (match[1] && match[2] && Number(match[2]) < Number(match[1])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  return start <= end ? { start, end } : false;
}

/** If-Match compares strongly and fails for missing resources. */
function checkIfMatch (req, currentTag) {
  const ifMatch = req.headers['if-match'];
  if (ifMatch && !(currentTag && (ifMatch.trim() === '*' || entityTags(ifMatch).includes(currentTag)))) {
    throw davError(412, 'If-Match failed');
  }
}

/** If-Match and If-None-Match for PUT; `currentTag` is null for new files. */
function checkWritePreconditions (req, currentTag) {
  checkIfMatch(req, currentTag);
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch && currentTag && (ifNoneMatch.trim() === '*' || entityTags(ifNoneMatch).includes(currentTag))) {
    throw davError(412, 'If-None-Match failed');
  }
}

/** The headers of a GET of `file`; also sent for HEAD. */
function fileHeaders (file, stat) {
  return {
    'content-type': contentType(file),
    'last-modified': stat.mtime.toUTCString(),
    etag: etag(stat),
    'cache-control': 'no-cache, no-transform',
    pragma: 'no-cache'
  };
}

/** Whether a request announces a body. */
function hasBody (req) {
  return Number(req.headers['content-length']) > 0 || 'transfer-encoding' in req.headers;
}

/** GET and HEAD: files are streamed, directories listed as HTML. */
async function get (req, res, { relative, file }, baseURI) {
  const stat = await statOrNull(file);
  if (!stat) throw davError(404);
  if (stat.isDirectory()) {
    if (req.method === 'HEAD') return res.writeHead(200).end();
    const html = await directoryIndex(relative, file, baseURI);
    return res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
  }
  // Opening a FIFO would block one of libuv's few file system threads until a writer appears.
  if (!stat.isFile()) throw davError(403, 'Not a regular file');
  // HEAD needs only the file status, so unreadable files exist() too.
  if (req.method === 'HEAD') return res.writeHead(200, { ...fileHeaders(file, stat), 'content-length': Number(stat.size) }).end();
  // Headers and bytes come from one open file, so a concurrent PUT, which
  // renames a new file into place, cannot mix two versions in one response.
  const fd = await new Promise((resolve, reject) => fs.open(file, 'r', (err, fd) => err ? reject(err) : resolve(fd)));
  let stream;
  try {
    const current = await new Promise((resolve, reject) =>
      fs.fstat(fd, { bigint: true }, (err, stat) => err ? reject(err) : resolve(stat)));
    const size = Number(current.size);
    const headers = fileHeaders(file, current);
    checkIfMatch(req, headers.etag);
    if (isNotModified(req, headers)) {
      delete headers['content-type'];
      return res.writeHead(304, headers).end();
    }
    const range = byteRange(req, headers, size);
    if (range === false) {
      return res.writeHead(416, { 'content-range': `bytes */${size}`, 'content-length': 0 }).end();
    }
    const { start, end } = range || { start: 0, end: size - 1 };
    if (end < start) return res.writeHead(200, { ...headers, 'content-length': 0 }).end();
    if (range) headers['content-range'] = `bytes ${start}-${end}/${size}`;
    res.writeHead(range ? 206 : 200, { ...headers, 'content-length': end - start + 1 });
    stream = fs.createReadStream(null, { fd, start, end }); // closes fd when done or destroyed
    await pipeline(stream, res);
  } finally {
    if (!stream) fs.close(fd, () => {});
  }
}

/** A plain HTML listing for people who open a directory in the browser. */
async function directoryIndex (relative, directory, baseURI) {
  const rows = relative ? [`<tr><td><a href="${hrefFor(baseURI, path.posix.dirname(relative).replace(/^\.$/, ''), true)}">..</a></td><td>[parent]</td><td></td><td></td></tr>`] : [];
  for (const { name, stat } of await childrenOf(directory)) {
    const isDirectory = stat.isDirectory();
    const href = hrefFor(baseURI, relative ? relative + '/' + name : name, isDirectory);
    const type = isDirectory ? 'Collection' : contentType(name).replace(/;.*$/, '');
    rows.push(`<tr><td><a href="${escapeXml(href)}">${escapeXml(name)}</a></td><td>${type}</td>` +
      `<td>${isDirectory ? '' : stat.size}</td><td>${stat.mtime.toUTCString()}</td></tr>`);
  }
  const title = escapeXml(`Index for /${relative}`);
  return `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>\n` +
    `<table><tr><th>Name</th><th>Type</th><th>Size</th><th>Last modified</th></tr>\n${rows.join('\n')}\n</table></body></html>\n`;
}

/**
 * Entries in `readdir` order. Left out: entries that cannot be stat'ed, such
 * as broken links, and the temporary files of PUTs in progress.
 */
async function childrenOf (directory) {
  const names = (await fs.promises.readdir(directory)).filter(name => !TEMPORARY_NAME.test(name));
  const stats = await Promise.all(names.map(name => statOrNull(path.join(directory, name)).catch(() => null)));
  return names.map((name, i) => ({ name, stat: stats[i] })).filter(({ stat }) => stat);
}

/** Only the properties lively.resources reads; a request body naming other properties is ignored. */
async function propfind (req, res, { relative, file }, baseURI) {
  const stat = await statOrNull(file);
  if (!stat) throw davError(404);
  const entries = [{ relative, stat }];
  if (stat.isDirectory() && req.headers.depth !== '0') {
    for (const child of await childrenOf(file)) {
      entries.push({ relative: relative ? relative + '/' + child.name : child.name, stat: child.stat });
    }
  }
  const responses = entries.map(({ relative, stat }) => {
    const isDirectory = stat.isDirectory();
    const properties = isDirectory
      ? '<d:resourcetype><d:collection/></d:resourcetype>'
      : `<d:getcontentlength>${stat.size}</d:getcontentlength><d:resourcetype></d:resourcetype>` +
        `<d:getetag>${escapeXml(etag(stat))}</d:getetag><d:getcontenttype>${contentType(relative)}</d:getcontenttype>`;
    return `<d:response><d:href>${escapeXml(hrefFor(baseURI, relative, isDirectory))}</d:href><d:propstat><d:prop>` +
      '<d:getlastmodified xmlns:b="urn:uuid:c2f41010-65b3-11d1-a29f-00aa00c14882/" b:dt="dateTime.rfc1123">' +
      `${stat.mtime.toUTCString()}</d:getlastmodified>${properties}` +
      '</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';
  });
  // The client iterates over the child nodes of d:prop, so the XML must not contain whitespace.
  const body = '<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:">' + responses.join('') + '</d:multistatus>';
  res.writeHead(207, { 'content-type': 'application/xml; charset=utf-8', 'content-length': Buffer.byteLength(body) });
  res.end(body);
}

/**
 * Streams the body into a temporary file next to the target and renames it
 * into place: a failed or aborted upload leaves the old file untouched, and
 * GETs of this handler see either the old or the new content. Where the
 * rename is refused (see `replace`) the file is overwritten in place instead.
 * Missing parent directories are not created.
 */
async function put (req, res, { relative, file }) {
  if (req.headers['content-range']) throw davError(501, 'PUT with Content-Range is not supported');
  const stat = await statOrNull(file);
  if (!relative || stat?.isDirectory()) throw davError(409, 'PUT is not allowed on directories');
  checkWritePreconditions(req, stat && etag(stat));
  const parent = await statOrNull(path.dirname(file));
  if (!parent?.isDirectory()) throw davError(404, 'Parent directory does not exist');
  // Write through symbolic links and keep the permissions of the replaced file.
  const target = stat ? await fs.promises.realpath(file) : file;
  if (stat) await fs.promises.access(target, fs.constants.W_OK);
  const temporary = path.join(path.dirname(target), temporaryName());
  try {
    await pipeline(req, fs.createWriteStream(temporary, { flags: 'wx' }));
    if (stat) await fs.promises.chmod(temporary, Number(stat.mode) & 0o7777);
  } catch (err) {
    await fs.promises.rm(temporary, { force: true });
    throw err;
  }
  await replace(temporary, target);
  res.writeHead(stat ? 200 : 201, { 'content-length': 0 }).end();
}

/**
 * Moves the complete upload `temporary` over `target`, or copies it where a
 * rename cannot replace the target: a file that is a mount point of its own
 * (EBUSY, EXDEV; e.g. a single bind-mounted file in a container) or, on
 * Windows, a file another program keeps open. Copying writes the target in
 * place; if that fails, the target may be partly written, so the upload is
 * kept and the logged error says where.
 */
async function replace (temporary, target) {
  try {
    await fs.promises.rename(temporary, target);
    return;
  } catch (err) {
    const inPlace = ['EBUSY', 'EXDEV'].concat(process.platform === 'win32' ? ['EPERM', 'EACCES'] : []);
    if (!inPlace.includes(err.code)) {
      await fs.promises.rm(temporary, { force: true });
      throw err;
    }
  }
  try {
    await fs.promises.copyFile(temporary, target);
  } catch (err) {
    throw new Error(`Writing ${target} failed, the upload is kept in ${temporary}`, { cause: err });
  }
  await fs.promises.rm(temporary, { force: true });
}

/** Creates one directory; its parent must exist. */
async function mkcol (req, res, { file }) {
  if (hasBody(req)) throw davError(415, 'MKCOL request bodies are not supported');
  const parent = await statOrNull(path.dirname(file));
  if (!parent?.isDirectory()) throw davError(409, 'Parent directory does not exist');
  await fs.promises.mkdir(file, 0o755); // EEXIST answers 405
  res.writeHead(201, { 'content-length': 0 }).end();
}

/** Removes directories recursively. A symbolic link is removed, not its target. */
async function remove (req, res, { relative, file }) {
  if (!relative) throw davError(403, 'The root directory cannot be deleted');
  if (!await statOrNull(file, fs.promises.lstat)) throw davError(404);
  await fs.promises.rm(file, { recursive: true, maxRetries: 2 });
  res.writeHead(204, { 'content-length': 0 }).end();
}

/** Only reached without the cors plugin, which answers OPTIONS itself. */
function options (req, res) {
  res.writeHead(200, { allow: METHODS.join(', '), dav: '1', 'content-length': 0 }).end();
}

const handlers = { OPTIONS: options, GET: get, HEAD: get, PUT: put, DELETE: remove, MKCOL: mkcol, PROPFIND: propfind };

/** Answers with the status of a `davError` or a file system error. */
function sendError (req, res, err) {
  if (res.headersSent) return res.destroy();
  const status = err.status || (NOT_FOUND.includes(err.code) ? 404 : { EACCES: 403, EPERM: 403, EEXIST: 405 }[err.code]) || 500;
  // Not `req.destroyed`: that also holds once a PUT body has been read.
  const aborted = err.code === 'ECONNRESET' || err.code === 'ERR_STREAM_PREMATURE_CLOSE';
  if (status === 500 && !aborted) console.error('[dav]', err);
  // A substituted encoding (see dav.js) does not apply to the error message.
  res.removeHeader('content-encoding');
  const message = err.status ? err.message : STATUS_CODES[status];
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    ...([405, 501].includes(status) ? { allow: METHODS.join(', ') } : {})
  });
  res.end(message);
}

/**
 * Answers `req` with the file or directory below `rootDirectory` that the URL
 * names relative to `baseURI`. Resolves once the response is complete: to the
 * resolved `{ relative, file }`, or to null if an error was thrown.
 */
export async function handleDAVRequest (req, res, { rootDirectory, baseURI = '/' }) {
  try {
    const handler = handlers[req.method.toUpperCase()];
    if (!handler) throw davError(501, `${req.method} is not supported`);
    const target = resolveTarget(rootDirectory, req.url, baseURI);
    await handler(req, res, target, baseURI);
    return target;
  } catch (err) {
    sendError(req, res, err);
    return null;
  }
}
