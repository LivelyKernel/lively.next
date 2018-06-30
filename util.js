/*global System,global,process,Buffer*/
import { toJsIdentifier } from "lively.classes/util.js";

const isNode = typeof System !== "undefined" ? System.get("@system-env").node
             : (typeof global !== "undefined" && typeof process !== "undefined")

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function incName(name) {
  return name.replace(/(?:_([0-9]*))?$/, (match, n) => match ? `_${Number(n)+1}` : "_1");
}

export function findUniqJsName(name, boundNames = []) {
  name = toJsIdentifier(name, true);
  while (boundNames.includes(name)) name = incName(name);
  return name;
}

//await gzip(await gzip('hello'), false)

// problem: when we encode the compressed string in utf8 it gets fucked up during transmission
// solution: when compressed string is sent between client and server translate to base64

export async function gzip(blob, inflate = true) {
  // if this is not node, perform a remote eval instead
  // blob is a string in utf8 format, convert it to base64 for safe transmission
  if (!isNode) {
    let {default: EvalBackendChooser} = await System.import("lively.ide/js/eval-backend-ui.js"),
        {RemoteCoreInterface} = await System.import("lively-system-interface/interfaces/interface.js"),
    // fetch next available nodejs env
        remoteInterface = (await EvalBackendChooser.default.allEvalBackends())
      .map(backend => backend.coreInterface)
      .find(coreInterface => coreInterface instanceof RemoteCoreInterface),
      res = await remoteInterface.runEvalAndStringify(`
        let { gzip } = await System.import('lively.freezer/util.js');
        await gzip(${
           JSON.stringify(blob) //JSON.stringify(inflate ? blob : btoa(blob))
        }, ${inflate});`);
      // if (inflate) {
      //   // if we instructed the server to compress, it sends the response in
      //   // base64, which we have to convert to utf8 such that we can
      //   // write it to a file again.
      //   return atob(res);
      // }
      return res;
  }
  let zlib = await System.import('zlib');
  let gzipFunc = (inflate ? zlib.gzipSync : zlib.gunzipSync);
  blob = inflate ? blob : new Buffer(blob, 'base64');
  let compressed = gzipFunc(blob);
  return compressed.toString('utf8');
  //return compressed.toString(inflate ? 'base64' : 'utf8');
}