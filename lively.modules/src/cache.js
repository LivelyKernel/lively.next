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
function prepareNodejsCaching () {
  const fs = System._nodeRequire('fs');
  const path = System._nodeRequire('path');
  const isWindows = process.platform === 'win32';
  const nodejsCacheDir =
        !isWindows && process.cwd() === '/'
          ? path.join(process.env.HOME, '.lively.next')
          : process.cwd();
  nodejsCacheDirURL = isWindows
    ? `file:///${nodejsCacheDir.replace(/\\/g, '/')}`
    : `file://${nodejsCacheDir}`;
  if (!fs.existsSync(nodejsCacheDir)) fs.mkdirSync(nodejsCacheDir);
}

export class NodeModuleTranslationCache extends ModuleTranslationCache {
  get moduleCacheDir () {
    if (!nodejsCacheDirURL) prepareNodejsCaching();
    return resource(`${nodejsCacheDirURL}/.module_cache/`);
  }

  async ensurePath (path) {
    if (await this.moduleCacheDir.join(path).exists()) return;
    let url = ''; let r; let packageInfo;
    for (const dir of path.split('/')) {
      url += dir + '/';

      r = this.moduleCacheDir.join(url);
      // why not use r.ensureExistance() ??
      if (!await r.exists()) {
        try { await r.mkdir(); } catch (e) { if (e.code !== 'EEXIST') throw e; }
      }

      r = resource('file://' + url + '/package.json');
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
    moduleId = moduleId.replace('file://', '');
    const fname = this.getFileName(moduleId);
    const fpath = moduleId.replace(fname, '');
    const r = this.moduleCacheDir.join(moduleId);
    if (!await r.exists()) return null;
    const { birthtime: timestamp } = await r.stat();
    const source = await r.read();
    const hash = await this.moduleCacheDir.join(fpath + '/.hash_' + fname).read();
    return { source, timestamp, hash };
  }

  async cacheModuleSource (moduleId, hash, source) {
    moduleId = moduleId.replace('file://', '');
    const fname = this.getFileName(moduleId);
    const fpath = moduleId.replace(fname, '');
    await this.ensurePath(fpath);
    await this.moduleCacheDir.join(moduleId).write(source);
    await this.moduleCacheDir.join(fpath + '/.hash_' + fname).write(hash);
  }

  async deleteCachedData (moduleId) {
    moduleId = moduleId.replace('file://', '');
    const r = this.moduleCacheDir.join(moduleId);
    if (!await r.exists()) return false;
    await r.remove();
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

  async cacheModuleSource (moduleId, hash, source, exports = []) {
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
