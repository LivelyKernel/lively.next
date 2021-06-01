/* global declare, it, describe, beforeEach, afterEach, before, after,xit,xdescribe */
import { expect } from 'mocha-es6';
import ObjectDB from '../objectdb.js';
import { fillDB1, fillDB2 } from './test-helper.js';
import { resource } from 'lively.resources';
import { promise } from 'lively.lang';

let part1, world1, world2,
  commit1, commit5, commit4, commit3, commit2,
  author1, author2,
  objectDB, snapshotLocation;

describe('empty ObjectDB', function () {
  before(() => {
    objectDB = ObjectDB.named('lively-morphic-objectdb-empty-test', { snapshotLocation: resource('local://lively-morphic-objectdb-empty-test/snapshots/') });
  });

  after(() => objectDB.destroy());

  it('querying objects of empty DB', async () => {
    let objects = await objectDB.objects();
    expect(objects).deep.equals({});
  });
});

describe('basic API ObjectDB', function () {
  this.timeout(30 * 1000);

  before(async () => {
    ({
      part1, world1, world2,
      commit1, commit5, commit4, commit3, commit2,
      author1, author2,
      objectDB, snapshotLocation
    } = await fillDB1());
  });

  after(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
  });

  describe('querying object data', () => {
    it('knows objects', async () => {
      expect(await objectDB.objects('part')).equals(['a part']);
      expect(await objectDB.objects('world')).equals(['another objectdb test world', 'objectdb test world']);
      expect(await objectDB.objects()).deep.equals({
        part: ['a part'],
        world: ['another objectdb test world', 'objectdb test world']
      });
    });

    it('commits contains basics', () => {
      expect(commit1).containSubset({
        author: { name: author1.name },
        description: 'no description',
        message: '',
        name: 'objectdb test world',
        tags: []
      });
      expect(commit1).to.have.property('timestamp').approximately(Date.now(), 5000);
      expect(commit1).to.have.property('preview');
      // expect(commit1.preview).matches(/^data:/);
      expect(commit1).to.have.property('content').to.be.a('string');
    });

    it('saves snapshot into resource', async () => {
      let hash = commit1.content;
      let res = snapshotLocation.join(`${hash.slice(0, 2)}/${hash.slice(2)}.json`);
      let snap = await res.readJson();
      expect(objectDB.snapshotResourceFor(commit1).url).equals(res.url);
      expect(snap.foo.bar).equals(23);
    });

    it('full object stats', async () => {
      let fullStats = await objectDB.objectStats();
      expect(fullStats).deep.equals({
        part: {
          'a part': {
            count: 1,
            newest: commit5.timestamp,
            oldest: commit5.timestamp
          }
        },
        world: {
          'another objectdb test world': {
            count: 3,
            newest: commit4.timestamp,
            oldest: commit2.timestamp
          },
          'objectdb test world': {
            count: 1,
            newest: commit1.timestamp,
            oldest: commit1.timestamp
          }
        }
      });
    });

    it('type object stats', async () => {
      let typeStats = await objectDB.objectStats('world');
      expect(typeStats).deep.equals({
        'another objectdb test world': {
          count: 3,
          newest: commit4.timestamp,
          oldest: commit2.timestamp
        },
        'objectdb test world': {
          count: 1,
          newest: commit1.timestamp,
          oldest: commit1.timestamp
        }
      });
    });

    it('specific object stats', async () => {
      let worldStats = await objectDB.objectStats('world', world2.name);
      expect(worldStats).deep.equals({
        count: 3,
        newest: commit4.timestamp,
        oldest: commit2.timestamp
      });
    });

    it('stores metadata', async () => {
      let commit = await objectDB.getLatestCommit('part', 'a part');
      expect(commit).containSubset({ metadata: { something: 'hello world' } });
    });

    describe('versions', () => {
      it('gets versions', async () => {
        let log = await objectDB._log('world', commit2.name);
        expect(log).equals([commit4._id, commit3._id, commit2._id], 'log');

        let graph = await objectDB.versionGraph('world', commit2.name);
        expect(graph).containSubset({
          _id: 'world/another objectdb test world',
          refs: { HEAD: commit4._id },
          history: {
            [commit2._id]: [],
            [commit3._id]: [commit2._id],
            [commit4._id]: [commit3._id]
          }
        }, 'graph');
      });
    });
  });
});

describe('loading objects', function () {
  this.timeout(30 * 1000);

  before(async () => {
    ({
      world1, world2,
      commit1, commit4, commit3, commit2,
      author1, author2,
      objectDB, snapshotLocation
    } = await fillDB2());
  });

  after(async () => {
    await objectDB.destroy();
    await snapshotLocation.remove();
    await promise.delay(500);
  });

  it('load latest', async () => {
    let world1Copy = await objectDB.loadObject('world', world1.name);
    expect(world1Copy.x).equals(42);
  });

  it('load from commit', async () => {
    let world1Copy = await objectDB.loadObject('world', world1.name, {}, commit2);
    expect(world1Copy.x).equals(23);
  });
});
