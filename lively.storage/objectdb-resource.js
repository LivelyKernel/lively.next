import { Resource, registerExtension, parseQuery } from 'lively.resources';
import { ObjectDBInterface } from './objectdb.js';

export const nativeObjectDBURL = 'lively.objectdb://local/';

// Keep the native adapter's argument selection and result conventions aligned
// with lively.server/plugins/objectdb.js. Dispatch never indexes an arbitrary API.
const actions = {
  GET: {
    describe: 'method',
    explainInterface: 'method',
    fetchCommits: 'db ref type typesAndNames knownCommitIds includeDeleted filterFn',
    fetchVersionGraph: 'db type name',
    exists: 'db type name ref',
    fetchLog: 'db type name ref commit limit includeCommits knownCommitIds',
    fetchSnapshot: 'db type name ref commit',
    exportToSpecs: 'db nameAndTypes includeDeleted',
    fetchConflicts: 'db only includeDocs',
    fetchDiff: 'db otherDB'
  },
  POST: {
    ensureDB: 'db snapshotLocation',
    destroyDB: 'db',
    commit: 'db type name ref expectedParentCommit commitSpec snapshot preview',
    revert: 'db type name ref toCommitId',
    exportToDir: 'db url nameAndTypes copyResources',
    importFromDir: 'db url overwrite copyResources',
    importFromSpecs: 'db specs overwrite copyResources',
    importFromResource: 'db type name url commitSpec purgeHistory',
    delete: 'db type name dryRun',
    deleteCommit: 'db commit dryRun',
    resolveConflict: 'db id kind delete resolved',
    synchronize: 'db otherDB otherDBSnapshotLocation onlyTypesAndNames method'
  }
};

// Strings cross the context boundary in both directions, just as JSON does over
// HTTP. Mutating an argument or result cannot mutate the other context's objects.
export async function handleObjectDBRequest (method, url, body) {
  const action = url.slice(nativeObjectDBURL.length).split('?')[0];
  if (!url.startsWith(nativeObjectDBURL) ||
      !Object.prototype.hasOwnProperty.call(actions, method) ||
      !Object.prototype.hasOwnProperty.call(actions[method], action)) {
    throw new Error(`method/action not supported ${method}/${action}`);
  }
  const incoming = method === 'GET' ? parseQuery(url) : JSON.parse(body);
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) throw new Error('ObjectDB arguments must be an object');
  const args = {};
  for (const key of actions[method][action].split(' ')) args[key] = incoming[key];
  try {
    const result = action === 'describe' || action === 'explainInterface'
      ? await ObjectDBInterface.describe(args.method)
      : await ObjectDBInterface[action](args);
    return JSON.stringify(typeof result === 'object' ? result : { status: String(result) });
  } catch (err) {
    return JSON.stringify(err.isVersionMismatchError
      ? { error: String(err), isVersionMismatchError: true, ref: err.ref, ancestorCommit: err.ancestorCommit, expectedVersion: err.expectedVersion }
      : { error: err.stack || String(err) });
  }
}

export function registerObjectDBResource (request) {
  class ObjectDBResource extends Resource {
    get canDealWithJSON () { return true; }
    read () { return request('GET', this.url); }
    async readJson () { return JSON.parse(await this.read()); }
    async post (args) { return JSON.parse(await request('POST', this.url, JSON.stringify(args))); }
  }
  registerExtension({
    name: 'lively.objectdb',
    matches: url => url.startsWith(nativeObjectDBURL),
    resourceClass: ObjectDBResource
  });
}
