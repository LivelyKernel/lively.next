import { string } from "lively.lang";

export function isJsFile(url) { return /\.js/i.test(url); }

export function asDir(url) {
  return isJsFile(url) ? url.replace(/\/[^\/]*$/, "") : url.replace(/\/$/, "");
}

export var join = string.joinPath;

export function isURL(string) { return /^[^:\\]+:\/\//.test(string); }

export function urlResolve(url) {
  var urlMatch = url.match(/^([^:]+:\/\/)(.*)/);
  if (!urlMatch) return url;

  var protocol = urlMatch[1],
      path = urlMatch[2],
      result = path;
  // /foo/../bar --> /bar
  do {
      path = result;
      result = path.replace(/\/[^\/]+\/\.\./, '');
  } while (result != path);
  // foo//bar --> foo/bar
  result = result.replace(/(^|[^:])[\/]+/g, '$1/');
  // foo/./bar --> foo/bar
  result = result.replace(/\/\.\//g, '/');
  return protocol + result;
}