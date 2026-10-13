import { resource } from 'lively.resources';
import { string, promise } from 'lively.lang';

export async function computeSourceHashes (baseURL) {
  const root = resource(baseURL).asDirectory();
  const files = await root.dirList('infinity', {
    exclude: res => res.url.includes('/node_modules/') ||
      res.url.includes('.module_cache') ||
      // Revival compares original modules, not the two generated browser bundles.
      ['landing-page', 'loading-screen'].some(dir => res.url.startsWith(root.url + 'lively.freezer/' + dir + '/')) ||
      !res.url.startsWith(root.url + 'lively') && !res.url.includes('esm_cache') ||
      res.isFile() && !/\.(js|cjs|mjs)$/.test(res.url)
  });
  return Object.fromEntries(await promise.parallel(files.filter(file => file.isFile()).map(file => async () => [
    '/' + file.relativePathFrom(root), string.hashCode(await file.read())
  ]), 16));
}
