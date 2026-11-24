import fs from 'node:fs';
import path from 'node:path';
import { promise } from 'lively.lang';
import { searchInSource, searchRegExp } from 'lively.modules/src/search.js';
import { resolveTarget, hrefFor } from './dav-handler.js';

/*
 * Global code search over the files below the root directory, for the IDE's
 * code search. The browser sends its package URLs; the files are listed and
 * read from disk here, instead of one PROPFIND per directory and one GET per
 * file from the browser. The files searched and the matches are those of
 * lively.modules' Package#search with `includeUnloaded`, which this mirrors:
 * names are excluded like lively.resources' dirList does it for the URLs that
 * PROPFIND answers give the browser, and symbolic links are followed like
 * the DAV handler follows them.
 */

/** Directories that Package#search skips in every package. */
const SKIPPED = ['.git', 'node_modules', 'dist', '.module_cache'];

/** A RegExp from its JSON form `{ source, flags }`; strings stay strings. */
function revive (spec) {
  return typeof spec === 'string' ? spec : RegExp(spec.source, spec.flags);
}

/**
 * Whether an entry is excluded, like lively.resources' dirList `exclude`
 * option does it for the browser's resource of the entry: for that resource,
 * `path()` is `href` and `name()` is the entry's name.
 */
function isExcluded (patterns, href, name) {
  return patterns.some(pattern => typeof pattern === 'string'
    ? href === pattern || name === pattern
    : pattern.test(href) || pattern.test(name));
}

/** Whether the module `id` is excluded, as in Module#search. */
function isExcludedModule (patterns, id) {
  return patterns.some(pattern => typeof pattern === 'string' ? pattern === id : pattern.test(id));
}

/**
 * The files below `directory`, as paths relative to it, without the entries
 * that `skip(relative, name, isDirectory)` rejects and without what is below them.
 * Symbolic links count as what they point to; broken ones and links back to
 * a directory that contains them are left out. File names are used as they
 * are: lively.resources' file resources read a `#` in a name as the start of
 * a URL fragment.
 */
async function filesBelow (directory, skip) {
  const files = [];
  /** Collects below `dir`, whose resolved path is `real`; `ancestors` are those of its parents. */
  async function walk (dir, real, prefix, ancestors) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    await Promise.all(entries.map(async entry => {
      const relative = prefix + entry.name;
      const full = path.join(dir, entry.name);
      let isDirectory = entry.isDirectory(); let isFile = entry.isFile();
      let entryReal = path.join(real, entry.name);
      if (entry.isSymbolicLink()) {
        let stat;
        try { stat = await fs.promises.stat(full); } catch (err) { return; } // broken or a loop
        isDirectory = stat.isDirectory(); isFile = stat.isFile();
        if (isDirectory) entryReal = await fs.promises.realpath(full);
      }
      if (!isDirectory && !isFile) return;
      if (isDirectory && (entryReal === real || ancestors.has(entryReal))) return;
      if (skip(relative, entry.name, isDirectory)) return;
      if (isDirectory) await walk(full, entryReal, relative + '/', new Set(ancestors).add(real));
      else files.push(relative);
    }));
  }
  await walk(directory, await fs.promises.realpath(directory), '', new Set());
  return files;
}

/**
 * The matches of `needle` in the .js files of `packages` ([{ url, name }]).
 * `packageURLs` are all registered packages: a package's search leaves out
 * the files of other packages inside it, but not those of its parents.
 * `needle` is a string or `{ source, flags }`; `excludedModules` holds strings
 * and `{ source, flags }`. Packages outside of the root directory are not
 * searched and returned as `unsearched`.
 */
export async function searchPackages ({
  rootDirectory, baseURI = '/', packages, packageURLs = [], needle,
  caseSensitive = false, regexMode = false, excludedModules = []
}) {
  needle = revive(needle);
  searchRegExp(needle, { caseSensitive, regexMode }); // a SyntaxError for an invalid pattern, before any file is read
  const excluded = excludedModules.map(revive);
  const dirExcludes = [...SKIPPED, ...excluded];
  const unsearched = [];
  let files = 0;
  const searchPackage = async ({ url, name }) => {
    let target;
    try { target = resolveTarget(rootDirectory, url, baseURI); } catch (err) { unsearched.push(url); return []; }
    const { origin } = new URL(url);
    // The path of the URL that a PROPFIND answer gives the browser for a file or directory.
    const hrefOf = (relative, isDirectory) =>
      hrefFor(baseURI, [target.relative, relative].filter(Boolean).join('/'), isDirectory);
    // Only packages inside this one can contain its files; parents do not count.
    const nested = packageURLs.filter(purl => purl !== url && purl.startsWith(url));
    const inOtherPackage = moduleURL => nested.some(purl => moduleURL.startsWith(purl));
    let relativePaths;
    try {
      relativePaths = await filesBelow(target.file, (relative, entryName, isDirectory) => {
        const href = hrefOf(relative, isDirectory);
        return isExcluded(dirExcludes, href, entryName) || (isDirectory && inOtherPackage(origin + href));
      });
    } catch (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return [];
      throw err;
    }
    const modules = relativePaths
      .filter(relative => relative.endsWith('.js'))
      .map(relative => ({ file: path.join(target.file, relative), id: origin + hrefOf(relative, false) }))
      .filter(({ id }) => !inOtherPackage(id) && !isExcludedModule(excluded, id));
    files += modules.length;
    const found = await promise.parallel(modules.map(({ file, id }) => async () => {
      let source;
      try { source = await fs.promises.readFile(file, 'utf8'); } catch (err) { return []; } // removed meanwhile
      const pathInPackage = id.slice(url.length).replace(/^\//, '');
      return searchInSource(source, needle, { caseSensitive, regexMode })
        .map(match => ({ moduleId: id, packageName: name, pathInPackage, ...match }));
    }), 16);
    return found.flat();
  };
  const results = (await promise.parallel(packages.map(p => () => searchPackage(p)), 8)).flat();
  return { results, unsearched, files };
}
