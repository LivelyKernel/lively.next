import { Resource } from 'lively.resources';
import { resource } from 'lively.resources';

const requestMap = {}

export class ESMREesource extends Resource {

  async read () {
    let module;

    const baseUrl = 'https://jspm.dev/';
    
    const id = this.url.replace('esm://cache/', '');
    
    let pathStructure = id.split('/').filter(Boolean);
    
    // jspm servers both the entry point into a package as well as subcontent from package@version/
    // differentiate these cases by introducing an index.js which will automatically be served by systemJS
    if (pathStructure.length === 1 || !pathStructure[pathStructure.length - 1].endsWith('js') && !pathStructure[pathStructure.length - 1].endsWith('!cjs')) {
      if (pathStructure.length === 1) pathStructure[0] = pathStructure[0].replace('!cjs', '');
      pathStructure.push('index.js');
    }

    const [res, created] = await this.findOrCreatePathStructure(pathStructure);
    
    if (!created) {
      module = await res.read();
    } else {
      module = await resource((baseUrl + id)).read();
      res.write(module);
    }
    return module;
  }

  async findOrCreatePathStructure(pathElements) {

    const cachePath = 'http://localhost:9011/esm_cache/';
    
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
    const runningCreation = requestMap[cachePath + fullPath]
    if (runningCreation) await runningCreation
    
    const res = resource(cachePath + fullPath)
    const isExisting = await res.exists()
    if (isExisting) return [res, false]
    
    for (let elem of pathElements){
      if (elem !== pathElements[pathElements.length - 1]){
        elem = elem + '/';
      }
      pathRes = requestMap[currPath + elem] 
      if (!pathRes) {
        pathRes = resource(currPath).join(elem);
        if (elem.endsWith('/')) {
          // signal that we are currently creating this resource
          // and wait for this operation to finish
          requestMap[currPath + elem] = pathRes.mkdir();
          pathRes = await requestMap[currPath + elem];
        } 
      } else {
      // another request already started the creation of this resource
      // since this happens asynchronously we could be scheduled "in between"
      // wait until this process is done,
      // since otherwise we will cause server errors when creating a directory that already exists
      pathRes = await pathRes;
      }
      currPath = pathRes.url;
    }
    return [pathRes, true]
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
  resourceClass: ESMREesource
};
