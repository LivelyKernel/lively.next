import { string } from 'lively.lang';

export function isJsFile (url) { return /\.js/i.test(url); }

export function asDir (url) {
  return isJsFile(url) ? url.replace(/\/[^\/]*$/, '') : url.replace(/\/$/, '');
}

export const join = string.joinPath;

export function isURL (string) { return /^[^:\\]+:\/\//.test(string); }

export function urlResolve (url) {
  let urlMatch = url.match(/^([^:]+:\/\/)(.*)/);
  if (!urlMatch) return url;

  let protocol = urlMatch[1];
  let path = urlMatch[2];
  let result = path;
  // /foo/../bar --> /bar
  do {
    path = result;
    result = path.replace(/\/[^\/]+\/\.\./, '');
  } while (result !== path);
  // foo//bar --> foo/bar
  result = result.replace(/(^|[^:])[\/]+/g, '$1/');
  // foo/./bar --> foo/bar
  result = result.replace(/\/\.\//g, '/');
  return protocol + result;
}
