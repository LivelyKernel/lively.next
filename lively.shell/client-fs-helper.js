import { runCommand } from './client-command.js';
import { string, promise, arr } from 'lively.lang';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// uses the "ls" shell utility to get file properties
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
class FileInfo {
  constructor (rootDirectory) {
    this.rootDirectory = rootDirectory;
    this.path = '';
    this.fileName = '';
    this.isDirectory = false;
    this.lastModified = null;
    this.mode = '';
    this.isLink = false;
    this.linkCount = 0;
    this.user = '';
    this.group = '';
    this.size = 0;
    this.rootDirectory = null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // parsing from directory list

  get reader () {
    return [ // the order is important!

      function mode (lineString, fileInfo) {
        let idx = lineString.indexOf(' ');
        fileInfo.mode = lineString.slice(0, idx);
        fileInfo.isDirectory = fileInfo.mode[0] === 'd';
        return lineString.slice(idx + 1).trim();
      },

      function linkCount (lineString, fileInfo) {
        let idx = lineString.indexOf(' ');
        fileInfo.linkCount = Number(lineString.slice(0, idx));
        return lineString.slice(idx + 1).trim();
      },

      function user (lineString, fileInfo) {
        let idx = lineString.indexOf(' ');
        fileInfo.user = lineString.slice(0, idx);
        return lineString.slice(idx + 1).trim();
      },

      function group (lineString, fileInfo) {
        let idx = string.peekRight(lineString, 0, /\s+[0-9]/);
        fileInfo.group = lineString.slice(0, idx).trim();
        return lineString.slice(idx).trim();
      },

      function size (lineString, fileInfo) {
        let idx = lineString.indexOf(' ');
        fileInfo.size = Number(lineString.slice(0, idx));
        return lineString.slice(idx + 1).trim();
      },

      function lastModified (lineString, fileInfo) {
        let matches = string.reMatches(lineString, /[^s]+\s+[0-9:\s]+/);
        if (!matches || !matches[0]) return lineString;
        fileInfo.lastModified = new Date(matches[0].match + ' GMT');
        return lineString.slice(matches[0].end).trim();
      },

      function fileName (lineString, fileInfo) {
        let string = lineString.replace(/^\.\/+/g, '').replace(/\/\//g, '/');
        let nameAndLink = string && string.split(' -> ');
        let isLink = string === '' ? false : string && nameAndLink.length === 2;
        let path = isLink ? nameAndLink[0] : string;
        let fname = path && path.indexOf(fileInfo.rootDirectory) === 0 ? path.slice(fileInfo.rootDirectory.length) : path;
        fileInfo.fileName = string === '' ? '.' : fname;
        fileInfo.path = path;
        fileInfo.isLink = isLink;
        return fname;
      }
    ];
  }

  readFromDirectoryListLine (line) {
    if (!line.trim().length) return null;
    let lineRest = line;
    this.reader.forEach(reader => lineRest = reader(lineRest, this));
    return this;
  }

  toString () { return this.path; }
}

function fileInfoCommandString (filename, options = {}) {
  let { rootDirectory = '.', platform } = options;

  let slash = platform === 'win32' ? '\\' : '/';
  if (platform !== 'win32' && !rootDirectory.endsWith(slash)) rootDirectory += slash;

  // we expect an consistent timeformat across OSs to parse the results
  let timeFormatFix = `if [ "$(uname)" = "Darwin" ];
      then timeformat='-T'; else
      timeformat="--time-style=+%b %d %T %Y";
    fi && `;

  // use GMT for time settings by default so the result is comparable
  // also force US ordering of date/time elements, to help with the parsing
  let commandString = platform === 'win32'
    ? `cd ${rootDirectory} && ls -lLd --time-style=locale "${filename}"`
    : timeFormatFix + `env TZ=GMT LANG=en_US.UTF-8 cd ${rootDirectory} && ls -lLd "$timeformat" "${filename}"`;

  return commandString;
}

export function parseDirectoryListFromLs (lsString, rootDirectory) {
  // line like "-rw-r—r—       1 robert   staff       5298 Dec 17 14:04:02 2012 test.html"
  return string.lines(lsString)
    .map(line => !line.trim().length
      ? null
      : new FileInfo(rootDirectory).readFromDirectoryListLine(line))
    .filter(Boolean);
}

export async function fileInfo (fileName, options) {
  let commandString = fileInfoCommandString(fileName, options);
  let cmd = runCommand(commandString, options);

  await cmd.whenDone();
  let err = cmd.exitCode !== 0 ? cmd.output : null;
  if (err) throw err;
  let [fileInfo] = parseDirectoryListFromLs(cmd.stdout, options.rootDirectory || '.');
  return fileInfo;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// use the shell find comannd to list files / search for files
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

let findFilesProcesses = {};
let defaultExcludes = ['.svn', '.git', 'node_modules', '.module_cache'];

function findFilesCommandString (pattern, options = {}) {
  let {
    rootDirectory = '.',
    exclude,
    depth, platform
  } = options;

  if (!exclude) exclude = '-iname ' + defaultExcludes.map(string.print).join(' -o -iname ');

  let slash = platform === 'win32' ? '\\' : '/';
  if (platform !== 'win32' && !rootDirectory.endsWith(slash)) rootDirectory += slash;

  // we expect an consistent timeformat across OSs to parse the results
  let timeFormatFix = `if [ "$(uname)" = "Darwin" ];
      then timeformat='-T'; else
      timeformat="--time-style=+%b %d %T %Y";
    fi && `;

  let searchPart = string.format('%s "%s"',
    options.re ? '-iregex' : (options.matchPath ? '-ipath' : '-iname'),
    pattern);

  const stringifiedDepth = typeof depth === 'number' ? ' -maxdepth ' + depth : '';

  // use GMT for time settings by default so the result is comparable
  // also force US ordering of date/time elements, to help with the parsing
  let commandString = platform === 'win32'

    ? string.format(
      'find %s %s ( %s ) -prune -o ' +
      '%s %s -print0 | xargs -0 -I{} ls -lLd --time-style=locale {}',
      rootDirectory,
      (options.re ? '-E ' : ''),
      exclude.replace(/"/g, ''),
      searchPart.replace(/"/g, ''),
      stringifiedDepth)

    : timeFormatFix + string.format(
      'env TZ=GMT LANG=en_US.UTF-8 ' +
    'find %s %s \\( %s \\) -prune -o ' +
    '%s %s -print0 | xargs -0 -I{} ls -lLd "$timeformat" "{}"',
      rootDirectory,
      (options.re ? '-E ' : ''),
      exclude, searchPart, stringifiedDepth);

  return commandString;
}

export async function findFiles (pattern, options) {
  // lively.ide.CommandLineSearch.findFiles('*html',
  //   {exclude: STRING, re: BOOL, depth: NUMBER, cwd: STRING, matchPath: BOOL});
  let { findFilesGroup, rootDirectory } = { findFilesGroup: 'default-find-files-process', ...options };

  let stateForThisGroup = findFilesProcesses[findFilesGroup] ||
                      (findFilesProcesses[findFilesGroup] = { promiseState: null, commands: [] });
  let { commands, promiseState } = stateForThisGroup;

  if (!promiseState) { stateForThisGroup.promiseState = promiseState = promise.deferred(); }

  let commandString = findFilesCommandString(pattern, options);

  commands.forEach(oldCmd => oldCmd.kill());
  let cmd = runCommand(commandString, options);
  commands.push(cmd);
  cmd.whenDone().then(() => {
    arr.remove(commands, cmd);
    let isOutdated = commands.some(otherCmd => otherCmd.startTime > cmd.startTime);
    if (isOutdated) {
      console.log(`[findFiles] command ${cmd} exited but a newer findFiles command was started for group ${findFilesGroup}, discarding output`);
    } else {
      let err = cmd.exitCode !== 0 ? cmd.output : null;
      if (err) console.warn(err);
      let result = err ? [] : parseDirectoryListFromLs(cmd.stdout, rootDirectory) || [];
      promiseState.resolve(result);
      Object.assign(stateForThisGroup, { promiseState: null, commands: [] });
    }
  }).catch(err => console.error(err));

  return promiseState.promise;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// for html uploads
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function convertDirectoryUploadEntriesToFileInfos (entryTree) {
  function flattenTree (entryTree) {
    return Array.prototype.concat.apply(
      [entryTree],
      entryTree.children ? entryTree.children.map(flattenTree) : []);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  let entries = flattenTree(entryTree);
  return entries.map(function (entry) {
    let path = entry.fullPath.replace(/^\//, '');
    return {
      fileName: path,
      path: path,
      rootDirectory: './',
      isDirectory: entry.isDirectory,
      isLink: undefined,
      lastModified: undefined,
      linkCount: undefined,
      mode: undefined,
      size: undefined,
      group: undefined,
      user: undefined
    };
  });
}
