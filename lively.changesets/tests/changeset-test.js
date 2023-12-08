/* global xit */
/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { module } from 'lively.modules';

import changeSet, { localChangeSets } from '../src/changeset.js';
import { pkgDir, fileA, createPackage, deletePackage, initTestChangeSet } from './helpers.js';
import { install, uninstall } from 'lively.changesets';

describe('changesets', () => {
  beforeEach(async () => {
    install();
    await createPackage();
  });

  afterEach(async () => {
    module(fileA).unload();
    const local = await localChangeSets();
    const toDelete = local.filter(c => c.name.match(/^test/));
    await Promise.all(toDelete.map(c => c.delete()));
    await deletePackage();
    uninstall();
  });

  it('support creating new, empty changesets', async () => {
    const cs = await changeSet('test');
    expect(await localChangeSets()).to.include(cs);
    await cs.delete();
    expect(await localChangeSets()).to.not.include(cs);
  });

  it('write changes to new changeset', async () => {
    const cs = await initTestChangeSet();
    await module(fileA).changeSource('export const x = 2;\n');
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql('export const x = 2;\n');
    const branches = await cs.getBranches();
    expect(branches).to.have.length(1);
    const changedFiles = await branches[0].changedFiles();
    expect(Object.keys(changedFiles)).to.be.deep.eql(['a.js']);
    const fileDiff = '- export const x = 1;\n+ export const x = 2;\n  \n';
    expect(await branches[0].diffFile('a.js')).to.be.deep.eql(fileDiff);
  });

  it('write multiple changes to same changeset', async () => {
    const cs = await initTestChangeSet();
    await module(fileA).changeSource('export const x = 2;\n');
    await module(fileA).changeSource('export const x = 3;\n');
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql('export const x = 3;\n');
  });

  xit('load module when switching changeset', async () => {
    const cs = await initTestChangeSet();
    const mod = await module(fileA);
    await module(fileA).changeSource('export const x = 2;\n');
    // below is broken
    const res = await System.import(fileA);
    expect(res).to.containSubset({ x: 2 });
    expect(mod.env().recorder).to.containSubset({ x: 2 });
  });

  it('can create new commits', async () => {
    const cs = await initTestChangeSet();
    await module(fileA).changeSource('export const x = 3;\n');
    const branch = await cs.getBranch(pkgDir);
    const head = await branch.head();
    const p = await head.parent();
    expect(p.message).to.be.eql('initial commit');
    await branch.commitChanges('done work');
    const newBranch = await cs.getBranch(pkgDir);
    const newHead = await newBranch.head();
    const newC = await newHead.parent();
    const oldC = await newC.parent();
    expect(newHead.message).to.be.eql('work in progress');
    expect(newC.message).to.be.eql('done work');
    expect(oldC.message).to.be.eql('initial commit');
  });

  it('support multiple changesets', async () => {
    const cs = await initTestChangeSet(true);
    const cs2 = await changeSet('test2');
    await module(fileA).changeSource('export const x = 3;\n');
    window.tom = 12;
    await cs2.delete();
    window.tom = 13;
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql('export const x = 2;\n');
  });
});
