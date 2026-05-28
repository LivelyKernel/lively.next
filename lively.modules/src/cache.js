/* global process */
import { resource } from 'lively.resources';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module cache experiment
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class ModuleTranslationCache {
  static get earliestDate () {
    return +(new Date('Sun Oct 18 2020 16:00:00 GMT-0800 (PST)'));
  }

  cacheModuleSource (moduleId, hash, source) { throw new Error('not yet implemented'); }
  fetchStoredModuleSource (moduleId) { throw new Error('not yet implemented'); }
  deleteCachedData (moduleId) { throw new Error('not yet implemented'); }
}

let nodejsCacheDirURL = null;

function moduleIdToSourcePath (moduleId) {
  return String(moduleId)
    .replace(/^file:\/\//, '')
    .replace(/^\/([a-z]:[\\/])/i, '$1')
    .replace(/\\/g, '/');
}

function normalizeModuleId (moduleId) {
  return moduleIdToSourcePath(moduleId)
    .replace(/^\/+/, '');
}

function escapeCachePathSegment (segment) {
  return segment.replace(/[<>:"|?*%~]/g, char =>
    `~${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`);
}

function moduleIdToCachePath (moduleId) {
  return normalizeModuleId(moduleId)
    .split('/')
    .map(escapeCachePathSegment)
    .join('/');
}

function fileResourceForPath (path) {
  const normalized = path.replace(/\\/g, '/');
  if (/^[a-z]:\//i.test(normalized)) return resource(`file:///${normalized}`);
  if (normalized.startsWith('/')) return resource(`file://${normalized}`);
  return resource(`file://${normalized}`);
}

function prepareNodejsCaching () {
  const fs = System._nodeRequire('fs');
  const path = System._nodeRequire('path');
  const { pathToFileURL } = System._nodeRequire('url');
  const isWindows = process.platform === 'win32';
  const configuredCacheDir = process.env.LIVELY_MODULE_TRANSLATION_CACHE_DIR;
  const nodejsCacheRoot =
        !isWindows && process.cwd() === '/'
          ? path.join(process.env.HOME, '.lively.next')
          : process.cwd();
  const nodejsCacheDir = configuredCacheDir
    ? path.resolve(configuredCacheDir)
    : path.join(nodejsCacheRoot, '.module_cache');
  nodejsCacheDirURL = pathToFileURL(nodejsCacheDir).href;
  if (!fs.existsSync(nodejsCacheDir)) fs.mkdirSync(nodejsCacheDir, { recursive: true });
}

export class NodeModuleTranslationCache extends ModuleTranslationCache {
  get moduleCacheDir () {
    if (!nodejsCacheDirURL) prepareNodejsCaching();
    return resource(nodejsCacheDirURL.endsWith('/') ? nodejsCacheDirURL : `${nodejsCacheDirURL}/`);
  }

  async ensurePath (path, sourcePath = null) {
    if (await this.moduleCacheDir.join(path).exists()) return;
    let url = ''; let sourceUrl = sourcePath && sourcePath.startsWith('/') ? '/' : '';
    let r; let packageInfo;
    const sourceDirs = sourcePath ? sourcePath.split('/').filter(Boolean) : [];
    const cacheDirs = path.split('/');
    for (let i = 0; i < cacheDirs.length; i++) {
      const dir = cacheDirs[i];
      url += dir + '/';

      r = this.moduleCacheDir.join(url);
      // why not use r.ensureExistance() ??
      if (!await r.exists()) {
        try { await r.mkdir(); } catch (e) { if (e.code !== 'EEXIST') throw e; }
      }

      sourceUrl += (sourceDirs[i] || dir) + '/';
      r = fileResourceForPath(sourceUrl + 'package.json');
      if (await r.exists()) {
        packageInfo = await r.read();
        await this.moduleCacheDir.join(url + '/package.json').write(packageInfo);
      }
    }
  }

  async dumpModuleCache () {
    for (const path in System._nodeRequire('module').Module._cache) {
      const r = resource('file://' + path);
      if (await r.exists()) { await this.cacheModuleSource(path, 'NO_HASH', await r.read()); }
    }
  }

  getFileName (moduleId) {
    return moduleId.match(/([^\/]*.)(\.js)?$/)[0];
  }

  async fetchStoredModuleSource (moduleId) {
    if (moduleId.endsWith('package.json')) return null;
    const cachePath = moduleIdToCachePath(moduleId);
    const fname = this.getFileName(cachePath);
    const fpath = cachePath.replace(fname, '');
    const r = this.moduleCacheDir.join(cachePath);
    if (!await r.exists()) return null;
    try {
      const { birthtime: timestamp } = await r.stat();
      const source = await r.read();
      const hash = await this.moduleCacheDir.join(fpath).join('.hash_' + fname).read();
      const sourceMap = await this.moduleCacheDir.join(fpath).join('.source_map_' + fname).readJson();
      const exports = await this.moduleCacheDir.join(fpath).join('.exports_' + fname).readJson();
      return { source, timestamp, hash, sourceMap, exports };
    } catch (e) {
      // Stale or corrupt cache entry — delete it and return null so the module is re-transformed
      await this.deleteCachedData(moduleId);
      return null;
    }
  }

  async cacheModuleSource (moduleId, hash, source, exports = [], sourceMap = {}) {
    if (moduleId.endsWith('package.json')) return;
    const cachePath = moduleIdToCachePath(moduleId);
    const fname = this.getFileName(cachePath);
    const fpath = cachePath.replace(fname, '');
    const sourcePath = moduleIdToSourcePath(moduleId);
    const sourceDirPath = sourcePath.replace(this.getFileName(sourcePath), '');
    await this.ensurePath(fpath, sourceDirPath);
    await this.moduleCacheDir.join(cachePath).write(source);
    await this.moduleCacheDir.join(fpath).join('.hash_' + fname).write(hash);
    await this.moduleCacheDir.join(fpath).join('.source_map_' + fname).writeJson(sourceMap);
    await this.moduleCacheDir.join(fpath).join('.exports_' + fname).writeJson(exports.map(({
      type, exported, local, fromModule
    }) => ({ type, exported, local, fromModule })));
  }

  async deleteCachedData (moduleId) {
    const r = this.moduleCacheDir.join(moduleIdToCachePath(moduleId));
    if (!await r.exists()) return false;
    try {
      await r.remove();
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    return true;
  }
}

export class BrowserModuleTranslationCache extends ModuleTranslationCache {
  constructor (dbName = 'lively.modules-module-translation-cache') {
    super();
    this.version = 2;
    this.sourceCodeCacheStoreName = 'sourceCodeStore';
    this.dbName = dbName;
    this.db = this.openDb();
  }

  openDb () {
    const req = System.global.indexedDB.open(this.version);
    return new Promise((resolve, reject) => {
      req.onsuccess = function (evt) { resolve(this.result); };
      req.onerror = evt => reject(evt.target);
      req.onupgradeneeded = (evt) =>
        evt.currentTarget.result.createObjectStore(this.sourceCodeCacheStoreName, { keyPath: 'moduleId' });
    });
  }

  deleteDb () {
    const req = System.global.indexedDB.deleteDatabase(this.dbName);
    return new Promise((resolve, reject) => {
      req.onerror = evt => reject(evt.target);
      req.onsuccess = evt => resolve(evt);
    });
  }

  async closeDb () {
    const db = await this.db;
    const req = db.close();
    return new Promise((resolve, reject) => {
      req.onsuccess = function (evt) { resolve(this.result); };
      req.onerror = evt => reject(evt.target.errorCode);
    });
  }

  async cacheModuleSource (moduleId, hash, source, exports = [], sourceMap = {}) {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.sourceCodeCacheStoreName], 'readwrite');
      const store = transaction.objectStore(this.sourceCodeCacheStoreName);
      const timestamp = Date.now();
      store.put({
        moduleId,
        hash,
        source,
        timestamp,
        sourceMap: JSON.stringify(sourceMap),
        exports: JSON.stringify(exports.map(({
          type, exported, local, fromModule
        }) => ({ type, exported, local, fromModule })))
      });
      transaction.oncomplete = resolve;
      transaction.onerror = reject;
    });
  }

  async fetchStoredModuleSource (moduleId) {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.sourceCodeCacheStoreName]);
      const objectStore = transaction.objectStore(this.sourceCodeCacheStoreName);
      const req = objectStore.get(moduleId);
      req.onerror = reject;
      req.onsuccess = evt => resolve(req.result);
    });
  }

  async deleteCachedData (moduleId) {
    const db = await this.db;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.sourceCodeCacheStoreName], 'readwrite');
      const objectStore = transaction.objectStore(this.sourceCodeCacheStoreName);
      const req = objectStore.delete(moduleId);
      req.onerror = reject;
      req.onsuccess = evt => resolve(req.result);
    });
  }
}
