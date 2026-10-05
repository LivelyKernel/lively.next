import { resource } from 'lively.resources';
import { string } from 'lively.lang';

export async function computeSourceHashes (baseURL) {
  const root = resource(baseURL).asDirectory();
  const files = await root.dirList('infinity', {
    exclude: res => res.url.includes('/node_modules/') ||
      res.url.includes('.module_cache') ||
      !res.url.startsWith(root.url + 'lively') && !res.url.includes('esm_cache') ||
      res.isFile() && !/\.(js|cjs|mjs)$/.test(res.url)
  });
  const hashes = {};
  for (const file of files) {
    if (file.isFile()) hashes['/' + file.relativePathFrom(root)] = string.hashCode(await file.read());
  }
  return hashes;
}
