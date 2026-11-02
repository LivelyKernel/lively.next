/* global beforeEach, afterEach, before, after, describe, it */

import { expect } from 'mocha-es6';

import { promise } from 'lively.lang';

import L2LClient from 'lively.2lively/client.js';

import LivelyServer from 'lively.server/server.js';
import CorsPlugin from 'lively.server/plugins/cors.js';
import SocketioPlugin from 'lively.server/plugins/socketio.js';
import L2lPlugin from 'lively.server/plugins/l2l.js';
import ShellPlugin from 'lively.server/plugins/remote-shell.js';

import ServerCommand from '../server-command.js';
import ClientCommand from '../client-command.js';
import ShellClientResource from '../client-resource.js';

let hostname = 'localhost'; let port = 0; let ioNamespace = 'lively.shell-test';
let testServer, l2lTracker, l2lClient;

async function setup () {
  testServer = LivelyServer.ensure({ port, hostname, l2l: { l2lNamespace: ioNamespace } });
  await testServer.whenStarted();
  port = testServer.server.address().port;
  await testServer.addPlugins([
    new CorsPlugin(),
    new SocketioPlugin(),
    new ShellPlugin(),
    new L2lPlugin()
  ]);

  let io = testServer.findPlugin('socketio').io;
  let url = `http://${hostname}:${port}${io.path()}`;
  l2lClient = await L2LClient.ensure({ url, namespace: ioNamespace });
  ClientCommand.installLively2LivelyServices(l2lClient);
  await l2lClient.whenRegistered(300);
}

async function teardown () {
  l2lClient && await l2lClient.remove();

  testServer.close();
  await testServer.whenClosed();
}

import { join } from 'path';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import GitShellResource from '../git-client-resource.js';
let shellProjDir = System.decanonicalize('lively.shell/').replace('file://', '');
let testDir = join(shellProjDir, 'test-tmp-dir');

describe('shell client resource', function () {
  before(() => setup());
  after(() => teardown());

  describe('git commit messages', () => {
    let directory, repository;
    const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8' });

    beforeEach(() => {
      directory = mkdtempSync(join(tmpdir(), 'lively-commit-message-'));
      git('init', '--quiet');
      git('config', 'user.name', 'Lively Test');
      git('config', 'user.email', 'test@example.invalid');
      git('config', 'core.hooksPath', join(directory, 'no-hooks'));
      writeFileSync(join(directory, 'fixture.txt'), 'test');
      repository = Object.create(GitShellResource.prototype);
      repository.options = { cwd: directory, l2lClient };
    });

    afterEach(() => rmSync(directory, { recursive: true, force: true }));

    for (const message of [
      'Keep "double", \'single\' and “curly” quotes',
      'Keep $PATH, ${PATH}, $(touch expanded), `touch expanded` and \\slashes',
      '  Keep leading spaces\n\nKeep a multiline body  \n'
    ]) {
      it('preserves literal message: ' + JSON.stringify(message), async () => {
        await repository.commitRepo(message);
        const commit = git('cat-file', 'commit', 'HEAD');
        const body = commit.slice(commit.indexOf('\n\n') + 2);
        expect(body).equals(message.endsWith('\n') ? message : message + '\n');
        expect(existsSync(join(directory, 'expanded'))).equals(false);
      });
    }

    it('tags the commit after passing its message through stdin', async () => {
      await repository.commitRepo('Keep "release" literal', true, '1.2.3');
      expect(git('rev-parse', 'v1.2.3').trim()).equals(git('rev-parse', 'HEAD').trim());
    });
  });

  describe('with test dir', () => {
    beforeEach(() => {
      mkdirSync(testDir);
      mkdirSync(join(testDir, 'subdir'));
      mkdirSync(join(testDir, 'subdir/subsubdir'));
      writeFileSync(join(testDir, 'foo.txt'), 'hello\nworld');
      writeFileSync(join(testDir, 'subdir/bar.txt'), "i'm bar");
      writeFileSync(join(testDir, 'subdir/subsubdir/zork.txt'), "i'm zork");
    });

    afterEach(() => {
      var f = join(testDir, 'foo.txt'); existsSync(f) && unlinkSync(f);
      var f = join(testDir, 'foo2.txt'); existsSync(f) && unlinkSync(f);
      var f = join(testDir, 'subdir/bar.txt'); existsSync(f) && unlinkSync(f);
      var f = join(testDir, 'subdir/subsubdir/zork.txt'); existsSync(f) && unlinkSync(f);
      var d = join(testDir, 'subdir/subsubdir'); existsSync(d) && rmdirSync(d);
      var d = join(testDir, 'subdir'); existsSync(d) && rmdirSync(d);
      var d = testDir; existsSync(d) && rmdirSync(d);
    });

    it('can read files', async () => {
      let res = new ShellClientResource(join(testDir, 'foo.txt'), l2lClient);
      let content = await res.read();
      expect(content).equals('hello\nworld');
    });

    it('can write files', async () => {
      let f = join(testDir, 'foo2.txt');
      let res = new ShellClientResource(f, l2lClient);
      await res.write('xxx');
      expect(String(readFileSync(f))).equals('xxx');
    });

    it('can remove files', async () => {
      let f = join(testDir, 'foo.txt');
      expect(existsSync(f)).equals(true, '1');
      await new ShellClientResource(f, l2lClient).remove();
      expect(existsSync(f)).equals(false, '1');

      let d = join(testDir, 'subdir');
      expect(existsSync(d)).equals(true, '1');
      await new ShellClientResource(d, l2lClient).remove();
      expect(existsSync(d)).equals(false, '2');

      expect(existsSync(testDir)).equals(true, '1');
    });

    it('can reads dir list', async () => {
      var list = await new ShellClientResource(testDir, l2lClient).dirList();
      expect(list.map(ea => ea.url).sort()).deep.equals([
        join(testDir, 'foo.txt'), join(testDir, 'subdir/')].sort());

      var list = await new ShellClientResource(testDir, l2lClient).dirList('infinity');
      expect(list.map(ea => ea.url).sort()).deep.equals([
        join(testDir, 'foo.txt'),
        join(testDir, 'subdir/'),
        join(testDir, 'subdir/bar.txt'),
        join(testDir, 'subdir/subsubdir/'),
        join(testDir, 'subdir/subsubdir/zork.txt')
      ].sort());
    });
  });
});
