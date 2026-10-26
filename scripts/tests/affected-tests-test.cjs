const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'lively-affected-tests-'));
const git = (...args) => execFileSync('git', args, { cwd: fixture, stdio: 'pipe' });
const write = (name, contents) => {
  fs.mkdirSync(path.dirname(path.join(fixture, name)), { recursive: true });
  fs.writeFileSync(path.join(fixture, name), typeof contents === 'string' ? contents : JSON.stringify(contents));
};
try {
  git('init', '-b', 'main');
  git('config', 'user.name', 'test');
  git('config', 'user.email', 'test@example.invalid');
  const packages = ['lively.a', 'lively.b', 'lively.c', 'lively.d', 'lively-system-interface'];
  write('package.json', { workspaces: packages });
  write('scripts/test-packages.json', packages);
  const manifests = [
    { dependencies: { 'lively.c': '*' } },
    { devDependencies: { 'lively.a': '*' } },
    { optionalDependencies: { 'lively.b': '*' } },
    {},
    { peerDependencies: { 'lively.b': '*' } }
  ];
  packages.forEach((name, index) => {
    write(`${name}/package.json`, { name, ...manifests[index] });
    write(`${name}/index.js`, 'initial');
  });
  write('README.md', 'docs');
  write('scripts/shared.js', 'initial');
  git('add', '.');
  git('commit', '-m', 'fixture');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const select = () => execFileSync('bash', [path.join(root, 'scripts/tests_for_branch.sh')], {
    cwd: fixture, env: { ...process.env, GITHUB_BASE_REF: 'main' }, encoding: 'utf8'
  }).trim().split(/\s+/).sort();
  assert.deepEqual(select(), ['none']);
  write('lively.a/index.js', 'changed');
  git('add', '.'); git('commit', '-m', 'dependency');
  assert.deepEqual(select(), ['lively-system-interface', 'lively.a', 'lively.b', 'lively.c'].sort());
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  write('README.md', 'changed docs');
  git('add', '.'); git('commit', '-m', 'docs');
  assert.deepEqual(select(), ['none']);
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  write('scripts/shared.js', 'changed tooling');
  git('add', '.'); git('commit', '-m', 'tooling');
  assert.deepEqual(select(), packages.sort());
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  write('lively-system-interface/index.js', 'changed backend');
  git('add', '.'); git('commit', '-m', 'backend');
  assert.deepEqual(select(), ['lively-system-interface']);
  console.log('Affected-test selection: transitive cycles, dependency kinds, backend package, shared tooling and docs passed');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
