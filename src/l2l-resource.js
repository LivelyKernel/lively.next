"format esm";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// function resourceDirToResourceExists(url) {
//   return new Promise((resolve, reject) => {
//     url = new URL(url);

//     if (url.protocol === "file:") {
//       var file = url.toString().replace("file:", ""),
//           path = file.replace(/[^\/]*$/, "");
//       lively.shell.run("mkdir -p " + path, (err, cmd) => err ? reject(err) : resolve());

//     } else if (url.protocol.match(/https?:/)) {
//       url.asWebResource().beAsync()
//         .ensureExistance(err => err ? reject(err) : resolve());

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "mkdir").then(resolve, reject);

//     } else {
//       reject(new Error("Cannot write resource: " + url));
//     }

//   })

// }

// function resourceMkdir(url) {
//     url.pathname.split('/');
//     return new Promise((resolve, reject) => {
//         url = new Global.URL(String(url).replace(/([^\/])$/, '$1/'));
//         if (url.protocol === 'file:') {
//             lively.shell.run('mkdir -p ' + String(url).replace('file:', ''), (err, cmd) => err ? reject(err) : resolve());
//         } else if (url.protocol.match(/https?:/)) {
//             Promise.all([url.getAllParentDirectories().map((url) => url.asWebResource().exists() ? Promise.resolve() : new Promise((resolve, reject) => url.asWebResource().beAsync().create().whenDone((_, status) => status.isSuccess() ? resolve() : reject(status))))]).then(resolve, reject);
//         } else if (url.protocol === 'l2l:') {
//             lively.l2lModules.fsRequest(url, 'mkdir').then(resolve, reject);
//         } else
//             reject('Unsupport address for new mkdir: ' + url);
//     });
// }

// function resourceRead(url, options) {

//   options = lively.lang.obj.merge({}, options)

//   return new Promise((resolve, reject) => {
//     url = new URL(url);

//     if (url.protocol === "file:") {
//       var file = url.toString().replace("file:", "");
//       lively.shell.cat(file, (err, source) =>
//         err ? reject(err) : resolve(source))

//     } else if (url.protocol.match(/https?:/)) {
//         url.asWebResource().beAsync().get()
//           .whenDone((content, status) => status.isSuccess() ?
//             resolve(content) : reject(new Error(String(status))));
//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "read").then(resolve, reject);

//     } else reject(new Error("Cannot read resource: " + url));

//   })


// /*

// export { read }

// async function read(url, options) {

//   options = Object.assign({}, options)

//   url = new URL(url);

//   if (url.protocol === "file:") {
//     var file = url.toString().replace("file:", "");
//     return new Promise((resolve, reject) =>
//       lively.shell.cat(file, (err, source) =>
//         err ? reject(err) : resolve(source)))

//   } else if (url.protocol.match(/https?:/)) {
//     await (await window.fetch(url)).text()
//     window.fetch(url)
//     var res = await window.fetch(url);
//     if (res.status >= 400)
//       throw new Error(`Failure retrieving ${url}, status ${res.statusText} (${res.status})\n${await res.text()}`)
//     else
//       return res.text();

//   } else if (url.protocol === "l2l:") {
//     new Promise((resolve, reject) =>
//       lively.l2lModules.fsRequest(url, "read").then(resolve, reject))

//   } else throw new Error("Cannot read resource: " + url);

// }

// */

// }

// function resourceRemoveDirectory(url) {
//   return new Promise((resolve, reject) => {

//     url = new URL(url);

//     if (url.protocol === "file:") {
//       lively.shell.rm(url.toString().replace("file:", ""),
//         (err, cmd) => err ? reject(err) : resolve());

//     } else if (url.protocol.match(/https?:/)) {
//       url.asWebResource().beAsync().del()
//         .whenDone((_, status) => {
//           if (status.isSuccess()) resolve();
//           else reject(new Error(status));
//         });

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "rm").then(resolve, reject);

//     } else reject("Cannot remove, unsupport protocol of file: " + url);
//   })
// }

// function resourceRemoveFile(url) {
//   return new Promise((resolve, reject) => {

//     url = new URL(url);

//     if (url.protocol === "file:") {
//       lively.shell.rm(url.toString().replace("file:", ""),
//         (err, cmd) => err ? reject(err) : resolve());

//     } else if (url.protocol.match(/https?:/)) {
//       url.asWebResource().beAsync().del()
//         .whenDone((_, status) => {
//           if (status.isSuccess()) resolve();
//           else reject(new Error(status));
//         });

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "rm").then(resolve, reject);

//     } else reject("Cannot remove, unsupport protocol of file: " + url);
//   })
// }

// function resourceWrite(url, content, options) {
//   options = lively.lang.obj.merge({overwrite: true}, options)

//   return new Promise((resolve, reject) => {
//     url = new URL(url);

//     if (url.protocol === "file:") {
//       var file = url.toString().replace("file:", "");

//       (options.overwrite ?
//         Promise.resolve() :
//         new Promise((resolve, reject) => {
//           lively.shell.run("test -f " + file, (err, cmd) => { resolve(cmd.getCode() === 0) })
//         }))
//         .then(exists => {
//           if (!options.overwrite && exists) return resolve()
//           lively.shell.writeFile(file, content,
//             (err, cmd) => err ? reject(err) : resolve())
//         })

//     } else if (url.protocol.match(/https?:/)) {
//       if (!options.overwrite && url.asWebResource().exists())
//         resolve();
//       else
//         url.asWebResource().beAsync().put(content)
//           .whenDone((_, status) => status.isSuccess() ?
//             resolve() : reject(new Error(String(status))));

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "write", {content: content}).then(resolve, reject);

//     } else reject(new Error("Cannot write resource: " + url));

//   })

// }