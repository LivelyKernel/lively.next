import { Resource } from 'lively.resources';
import { resource } from 'lively.resources';
import { string } from 'lively.lang';

const requestMap = {};

export class ESMResource extends Resource {
  static normalize (esmUrl) {
    const id = esmUrl.replace('esm://cache/', '');

    let pathStructure = id.split('/').filter(Boolean);

    // jspm servers both the entry point into a package as well as subcontent from package@version/
    // differentiate these cases by introducing an index.js which will automatically be served by systemJS
    if (pathStructure.length === 1 ||
        !pathStructure[pathStructure.length - 1].endsWith('js') &&
        !pathStructure[pathStructure.length - 1].endsWith('!cjs')) {
      let fileName = 'index.js';
      if (pathStructure.length === 1) {
        if (pathStructure[0].endsWith('!cjs')) fileName = 'index.cjs';
        pathStructure[0] = pathStructure[0].replace('!cjs', '');
      }
      pathStructure.push(fileName);
    }

    if (pathStructure[pathStructure.length - 1].endsWith('.js!cjs')) {
      pathStructure[pathStructure.length - 1] = pathStructure[pathStructure.length - 1].replace('.js!cjs', '.cjs');
    }

    if (pathStructure[pathStructure.length - 1].endsWith('!cjs')) {
      pathStructure[pathStructure.length - 1] = pathStructure[pathStructure.length - 1].replace('!cjs', '.cjs');
    }

    return pathStructure;
  }

  async read () {
    let module;

    const baseUrl = 'https://jspm.dev/';
    const id = this.url.replace('esm://cache/', '');

    let pathStructure = ESMResource.normalize(id);

    const [res, created] = await this.findOrCreatePathStructure(pathStructure);

    if (!created) {
      module = await res.read();
    } else {
      module = await resource((baseUrl + id)).read();
      res.write(module);
    }
    return module;
  }

  async findOrCreatePathStructure (pathElements) {
    const cachePath = string.joinPath(System.baseURL, '/esm_cache/');

    let currPath = cachePath;
    let pathRes;

    // pathElements can together either describe a directory or a file
    // in the case that it is not a file (will be either js or !cjs) we need to fixup the last part of the path
    if (!pathElements[pathElements.length - 1].endsWith('js') && !pathElements[pathElements.length - 1].endsWith('!cjs')) {
      pathElements[pathElements.length - 1] = pathElements[pathElements.length - 1] + '/';
    }

    const fullPath = pathElements.join('/');

    // another request already started the creation of this resource
    // since this happens asynchronously we could be scheduled "in between"
    // wait until this process is done,
    // since otherwise we will cause server errors when creating a directory that already exists
    const runningCreation = requestMap[cachePath + fullPath];
    if (runningCreation) await runningCreation;

    const res = resource(cachePath + fullPath);
    const isExisting = await res.exists();
    if (isExisting) return [res, false];

    for (let elem of pathElements) {
      if (elem !== pathElements[pathElements.length - 1]) {
        elem = elem + '/';
      }
      pathRes = requestMap[currPath + elem];
      if (!pathRes) {
        pathRes = resource(currPath).join(elem);
        if (elem.endsWith('/')) {
          const dirExists = await pathRes.exists();
          if (requestMap[currPath + elem] || dirExists) {
            await requestMap[currPath + elem];
            currPath = pathRes.url;
            continue;
          } else {
            // signal that we are currently creating this resource
            // and wait for this operation to finish
            requestMap[currPath + elem] = pathRes.mkdir();
            pathRes = await requestMap[currPath + elem];
          }
        }
      } else {
      // another request already started the creation of this resource
      // since this happens asynchronously we could be scheduled "in between"
      // wait until this process is done,
      // since otherwise we will cause server errors when creating a resource that already exists
        pathRes = await pathRes;
      }
      currPath = pathRes.url;
    }
    return [pathRes, true];
  }

  get isESMResource () {
    return true;
  }

  async write (source) {
    console.error('Not supported by resource type.');
  }

  async mkdir () {
    console.error('Not supported by resource type.');
  }

  async exists () {
    // stub that needs to exist
  }

  async remove () {
    console.error('Not supported by resource type.');
  }
}

export const resourceExtension = {
  name: 'ecma-script-module-resource',
  matches: (url) => url.startsWith('esm://'),
  resourceClass: ESMResource
};
