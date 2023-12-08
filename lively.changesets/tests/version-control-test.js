/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { module, getPackage } from 'lively.modules';

import branch, { localBranchesOf } from '../src/branch.js';
import { pkgDir, fileA, createPackage, deletePackage, initTestBranches } from './helpers.js';
import { install, uninstall } from 'lively.changesets';

describe('branches', () => {
  let master, test;
  beforeEach(async () => {
    install();
    await createPackage();
    [master, test] = await initTestBranches(true);
  });

  afterEach(async () => {
    module(fileA).unload();
    const toDelete = await localBranchesOf(pkgDir);
    await Promise.all(toDelete.map(b => b.delete()));
    await deletePackage();
    uninstall();
  });

  it('are initialized from IndexedDB', async () => {
    const branches = await localBranchesOf(pkgDir);
    expect(branches).to.have.length(2);
    expect(branches[0].name).to.be.eql('master');
    expect(branches[1].name).to.be.eql('test');
  });

  it('can be forked', async () => {
    const test2 = await master.fork('test2');
    const branches = await localBranchesOf(pkgDir);
    expect(branches).to.have.length(3);
    expect(branches[2].name).to.be.eql('test2');
  });

  it('support writes to forked branches', async () => {
    const test2 = await master.fork('test2');
    await test2.activate();
    await module(fileA).changeSource('export const x = 3;\n');
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql('export const x = 3;\n');
    const changedFiles = await test2.changedFiles();
    expect(Object.keys(changedFiles)).to.be.deep.eql(['a.js']);
    const fileDiff = '- export const x = 1;\n+ export const x = 3;\n  \n';
    expect(await test2.diffFile('a.js')).to.be.deep.eql(fileDiff);
    await test2.delete();
    await master.activate();
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql('export const x = 1;\n');
  });

  it('restore changes when re-activating', async () => {
    const test2 = await master.fork('test2');
    await test2.activate();
    await module(fileA).changeSource('export const x = 3;\n');

    await master.activate();
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql('export const x = 1;\n');

    await test2.activate();
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql('export const x = 3;\n');
  });

  it('support multiple changes to same branch', async () => {
    const test2 = await master.fork('test2');
    await test2.activate();
    await module(fileA).changeSource('export const x = 3;\n');
    await module(fileA).changeSource('export const x = 4;\n');
    const changedSrc = await module(fileA).source();
    expect(changedSrc).to.be.eql('export const x = 4;\n');

    await master.activate();
    const changedSrc2 = await module(fileA).source();
    expect(changedSrc2).to.be.eql('export const x = 1;\n');
  });

  it('load modules when activating', async () => {
    await test.activate();
    const mod = await module(fileA);

    expect(await System.import(fileA)).to.containSubset({ x: 2 });
    expect(mod.env().recorder).to.containSubset({ x: 2 });

    await master.activate();
    expect(await System.import(fileA)).to.containSubset({ x: 1 });
    expect(mod.env().recorder).to.containSubset({ x: 1 });

    /* await test.activate();
    expect(await System.import(fileA)).to.containSubset({x: 2});
    expect(mod.env().recorder).to.containSubset({x: 2}); */
  });

  it('can create new commits', async () => {
    await test.activate();
    const head = await test.head();
    const p = await head.parent();
    expect(p.message).to.be.eql('initial commit');
    await test.commitChanges('done work');
    const newHead = await test.head();
    const newC = await newHead.parent();
    const oldC = await newC.parent();
    expect(newHead.message).to.be.eql('work in progress');
    expect(newC.message).to.be.eql('done work');
    expect(oldC.message).to.be.eql('initial commit');
  });
});
