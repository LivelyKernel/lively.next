import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { gitSpecFromVersion } from './flatn-cjs.js';

const lvInfoFileName = '.lv-npm-helper-info.json';

export function detectBun () {
  if (process.env.BUN_PATH) {
    try {
      execSync(`${process.env.BUN_PATH} --version`, { stdio: 'pipe' });
      return process.env.BUN_PATH;
    } catch (e) {}
  }
  try {
    execSync('which bun', { stdio: 'pipe' });
    return 'bun';
  } catch (e) {}
  const homeBun = path.join(process.env.HOME || '', '.bun', 'bin', 'bun');
  try {
    execSync(`${homeBun} --version`, { stdio: 'pipe' });
    return homeBun;
  } catch (e) {}
  return null;
}

export async function bunInstall (bunPath, livelyDirs, destDir, projectRoot, verbose = false) {
  const bunWorkDir = path.join(projectRoot, 'tmp', 'bun-install-workdir');

  // 1. Build exclusion set from packages-config.json
  const packagesConfigPath = path.join(projectRoot, 'lively.installer', 'packages-config.json');
  const packagesConfig = JSON.parse(fs.readFileSync(packagesConfigPath, 'utf8'));
  const excludeNames = new Set(packagesConfig.map(p => p.name));

  // 2. Aggregate dependencies from all lively packages
  const aggregatedDeps = {};
  for (const dir of livelyDirs) {
    const pkgPath = path.join(dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = pkg.dependencies || {};
    for (const [name, version] of Object.entries(deps)) {
      if (excludeNames.has(name)) continue;
      if (!aggregatedDeps[name]) {
        aggregatedDeps[name] = version;
      } else if (!version.startsWith('^') && !version.startsWith('~') && !version.startsWith('*') && !version.startsWith('>') && !version.startsWith('<')) {
        // Exact pins override ranges so bun installs the precise version needed
        const existing = aggregatedDeps[name];
        if (existing.startsWith('^') || existing.startsWith('~') || existing.startsWith('*') || existing.startsWith('>') || existing.startsWith('<')) {
          aggregatedDeps[name] = version;
        }
      }
    }
  }

  const depCount = Object.keys(aggregatedDeps).length;
  console.log(`[bun-install] aggregated ${depCount} external dependencies`);

  // 3. Prepare bun work directory
  fs.mkdirSync(bunWorkDir, { recursive: true });

  const syntheticPkg = {
    name: 'lively-next-install-aggregate',
    version: '0.0.0',
    private: true,
    dependencies: aggregatedDeps
  };
  fs.writeFileSync(
    path.join(bunWorkDir, 'package.json'),
    JSON.stringify(syntheticPkg, null, 2)
  );

  // Disable lifecycle scripts — flatn's BuildProcess handles those
  fs.writeFileSync(
    path.join(bunWorkDir, 'bunfig.toml'),
    '[install]\nignore-scripts = true\n'
  );

  // 4. Run bun install
  console.log('[bun-install] running bun install...');
  const result = spawnSync(bunPath, ['install', '--no-progress'], {
    cwd: bunWorkDir,
    stdio: verbose ? 'inherit' : 'pipe',
    env: { ...process.env }
  });

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : '';
    throw new Error(`bun install failed (exit ${result.status}): ${stderr}`);
  }
  console.log('[bun-install] bun install completed');

  // 5. Build git spec map from original dependency version strings
  const gitDepMap = buildGitDepMap(aggregatedDeps, bunWorkDir, bunPath);

  // 6. Walk node_modules to find all installed packages
  const nmDir = path.join(bunWorkDir, 'node_modules');
  const allPackages = findAllPackages(nmDir);

  // Deduplicate by name@version
  const seen = new Set();
  const uniquePackages = [];
  for (const pkg of allPackages) {
    const key = `${pkg.name}@${pkg.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniquePackages.push(pkg);
  }

  // Sort deepest paths first so nested packages are extracted before parents move
  uniquePackages.sort((a, b) => b.srcDir.split(path.sep).length - a.srcDir.split(path.sep).length);

  console.log(`[bun-install] found ${uniquePackages.length} unique packages to migrate`);

  // 7. Migrate each package to flatn layout
  const newPackages = [];
  let skipped = 0;
  for (const pkg of uniquePackages) {
    const migrated = migratePackage(pkg, destDir, gitDepMap, aggregatedDeps);
    if (migrated) {
      newPackages.push(migrated);
    } else {
      skipped++;
    }
  }

  // 8. Cleanup — remove node_modules from work dir, keep bun.lock + package.json for next run
  try {
    fs.rmSync(path.join(bunWorkDir, 'node_modules'), { recursive: true, force: true });
  } catch (e) {}

  console.log(`[bun-install] migrated ${newPackages.length} packages, skipped ${skipped} already installed`);

  return { newPackages };
}

function buildGitDepMap (aggregatedDeps, bunWorkDir, bunPath) {
  // Build a map of package name -> gitSpec using the ORIGINAL dependency version
  // strings. This is critical because PackageSpec.matches() computes its gitSpec
  // from the original version string, so the installed package's versionInFileName
  // must match what the original string produces.
  const gitDepMap = {}; // name -> { gitURL, branch, versionInFileName }

  // 1. Check direct deps from aggregatedDeps
  for (const [name, version] of Object.entries(aggregatedDeps)) {
    const gitSpec = gitSpecFromVersion(version);
    if (gitSpec) {
      gitDepMap[name] = gitSpec;
    }
  }

  // 2. Check transitive deps from bun.lock package entries
  const textLockPath = path.join(bunWorkDir, 'bun.lock');
  const binaryLockPath = path.join(bunWorkDir, 'bun.lockb');

  let lockContent = null;
  if (fs.existsSync(textLockPath)) {
    lockContent = fs.readFileSync(textLockPath, 'utf8');
  } else if (fs.existsSync(binaryLockPath)) {
    try {
      const result = spawnSync(bunPath, [binaryLockPath], {
        cwd: bunWorkDir, stdio: 'pipe'
      });
      if (result.status === 0) lockContent = result.stdout.toString();
    } catch (e) {}
  }

  if (lockContent) {
    try {
      const cleaned = lockContent.replace(/,\s*([}\]])/g, '$1');
      const lock = JSON.parse(cleaned);
      const packages = lock.packages || {};

      // Scan all package entries for git URL dependencies in their dep lists
      for (const [, value] of Object.entries(packages)) {
        if (!Array.isArray(value)) continue;
        // value[1] is the dependencies/optionalDependencies object
        const depObj = value[1];
        if (!depObj || typeof depObj !== 'object') continue;

        for (const field of ['dependencies', 'optionalDependencies']) {
          const deps = depObj[field] || (field === 'dependencies' ? depObj : null);
          if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
          for (const [depName, depVersion] of Object.entries(deps)) {
            if (gitDepMap[depName]) continue; // already have it
            if (typeof depVersion !== 'string') continue;
            const gitSpec = gitSpecFromVersion(depVersion);
            if (gitSpec) {
              gitDepMap[depName] = gitSpec;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[bun-install] warning: could not parse bun lockfile for git deps:', e.message);
    }
  }

  if (Object.keys(gitDepMap).length > 0) {
    console.log(`[bun-install] found ${Object.keys(gitDepMap).length} git dependencies:`,
      Object.keys(gitDepMap).join(', '));
  }

  return gitDepMap;
}

function findAllPackages (nmDir) {
  const results = [];
  if (!fs.existsSync(nmDir)) return results;

  const entries = fs.readdirSync(nmDir);
  for (const entry of entries) {
    if (entry === '.cache' || entry === '.bin' || entry === '.package-lock.json') continue;

    const entryPath = path.join(nmDir, entry);

    if (entry.startsWith('@')) {
      // Scoped package — scan children
      if (!fs.statSync(entryPath).isDirectory()) continue;
      const scopedEntries = fs.readdirSync(entryPath);
      for (const scopedEntry of scopedEntries) {
        const scopedPath = path.join(entryPath, scopedEntry);
        collectPackage(scopedPath, results);
      }
    } else {
      collectPackage(entryPath, results);
    }
  }

  return results;
}

function collectPackage (pkgDir, results) {
  const pkgJsonPath = path.join(pkgDir, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;

  try {
    const config = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    if (!config.name || !config.version) return;

    results.push({
      name: config.name,
      version: config.version,
      srcDir: pkgDir,
      config
    });

    // Recurse into nested node_modules for conflicting versions
    const nestedNm = path.join(pkgDir, 'node_modules');
    if (fs.existsSync(nestedNm)) {
      results.push(...findAllPackages(nestedNm));
    }
  } catch (e) {}
}

function migratePackage (pkg, destDir, gitResolvedMap, aggregatedDeps) {
  const { name, version, srcDir, config } = pkg;

  // Compute flatn directory name
  const flatnName = name.replace(/\//g, '__SLASH__');
  const gitSpec = gitResolvedMap[name];

  let versionDir;
  if (gitSpec && gitSpec.versionInFileName) {
    versionDir = gitSpec.versionInFileName;
  } else {
    versionDir = version;
  }

  const targetDir = path.join(destDir, flatnName, versionDir);

  // Skip if already installed (incremental installs)
  if (fs.existsSync(path.join(targetDir, lvInfoFileName))) {
    return null;
  }

  // Ensure parent directory
  fs.mkdirSync(path.join(destDir, flatnName), { recursive: true });

  // Move package to flatn layout
  try {
    fs.renameSync(srcDir, targetDir);
  } catch (e) {
    if (e.code === 'EXDEV') {
      // Cross-device: copy then remove
      spawnSync('cp', ['-a', srcDir, targetDir]);
      fs.rmSync(srcDir, { recursive: true, force: true });
    } else {
      throw e;
    }
  }

  // Write .lv-npm-helper-info.json
  const lvInfo = {
    build: false,
    location: null,
    name,
    version: gitSpec ? gitSpec.gitURL : version
  };
  if (gitSpec) {
    lvInfo.gitURL = gitSpec.gitURL;
    lvInfo.branch = gitSpec.branch;
    lvInfo.versionInFileName = gitSpec.versionInFileName;
  }
  fs.writeFileSync(path.join(targetDir, lvInfoFileName), JSON.stringify(lvInfo));

  // Augment package.json with npm-specific _id and _from fields
  const configPath = path.join(targetDir, 'package.json');
  try {
    const targetConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (gitSpec) {
      targetConfig._id = `${name}@${version}`;
      targetConfig._from = `${name}@${gitSpec.gitURL}`;
    } else {
      targetConfig._id = `${config.name}@${config.version}`;
      const originalRange = aggregatedDeps[name];
      targetConfig._from = `${config.name}@${originalRange || version}`;
    }
    fs.writeFileSync(configPath, JSON.stringify(targetConfig, null, 2));
  } catch (e) {}

  return targetDir;
}
