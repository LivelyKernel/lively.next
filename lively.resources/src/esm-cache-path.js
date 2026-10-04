export function normalizeEsmCachePath (esmUrl) {
  const match = esmUrl.match(/^esm:\/\/([^\/]*)\/(.*)$/);
  const domain = match?.[1];
  const id = match?.[2] || esmUrl;

  let pathStructure = id.split('/').filter(Boolean);

  // ESM CDNs serve both the entry point into a package and package subcontent.
  // differentiate these cases by introducing an index.js which will automatically be served by systemJS
  if (pathStructure.length === 1 ||
      !pathStructure[pathStructure.length - 1].endsWith('+esm') &&
      !pathStructure[pathStructure.length - 1].endsWith('js') &&
      !pathStructure[pathStructure.length - 1].endsWith('!cjs')) {
    let fileName = 'index.js';
    if (pathStructure.length === 1) {
      if (pathStructure[0].endsWith('!cjs')) fileName = 'index.cjs';
      pathStructure[0] = pathStructure[0].replace('!cjs', '');
    }
    pathStructure.push(fileName);
  }

  if (pathStructure[pathStructure.length - 1].endsWith('+esm')) {
    pathStructure[pathStructure.length - 1] = pathStructure[pathStructure.length - 1].replace('+esm', 'esm.js');
  }

  if (pathStructure[pathStructure.length - 1].endsWith('.js!cjs')) {
    pathStructure[pathStructure.length - 1] = pathStructure[pathStructure.length - 1].replace('.js!cjs', '.cjs');
  }

  if (pathStructure[pathStructure.length - 1].endsWith('!cjs')) {
    pathStructure[pathStructure.length - 1] = pathStructure[pathStructure.length - 1].replace('!cjs', '.cjs');
  }

  // The provider is part of the cache identity. Different CDNs can use the
  // same path for different transformed source.
  if (domain) pathStructure.unshift(domain);
  // Use the same portable paths on every platform, including esm.sh's * prefix.
  const escape = character => '~' + character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
  return pathStructure.map(part => part
    .replace(/[~<>:"\\|?*\x00-\x1F]/g, escape)
    .replace(/[. ]+$/, suffix => [...suffix].map(escape).join('')));
}
