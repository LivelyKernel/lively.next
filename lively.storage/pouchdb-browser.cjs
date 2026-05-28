const globalObject = typeof global !== 'undefined'
  ? global
  : typeof globalThis !== 'undefined' ? globalThis : this;

const hadSelf = Object.prototype.hasOwnProperty.call(globalObject, 'self');
const previousSelf = globalObject.self;

if (!hadSelf) globalObject.self = globalObject;

try {
  module.exports = require('pouchdb/dist/pouchdb.js');
} finally {
  if (hadSelf) globalObject.self = previousSelf;
  else delete globalObject.self;
}
