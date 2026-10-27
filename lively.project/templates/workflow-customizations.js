function customSections (source) {
  const sections = new Map();
  let open;
  for (const match of source.matchAll(/^[ \t]*# lively.next:custom[^\n]*/gm)) {
    const marker = match[0].match(/^[ \t]*# lively.next:custom (start|end) ([\w-]+)[ \t]*\r?$/);
    if (!marker) throw new Error(`Invalid custom workflow section marker: ${match[0].trim()}`);
    const [, kind, id] = marker;
    if (kind === 'start') {
      if (open || sections.has(id)) throw new Error(`Duplicate or nested custom workflow section: ${id}`);
      open = { id, start: match.index + match[0].length };
    } else {
      if (!open || open.id !== id) throw new Error(`Unmatched custom workflow section end: ${id}`);
      sections.set(id, { start: open.start, end: match.index, content: source.slice(open.start, match.index) });
      open = null;
    }
  }
  if (open) throw new Error(`Unclosed custom workflow section: ${open.id}`);
  return sections;
}

function generatedContent (source, generatedDependencies) {
  source = source
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]*# lively.next:custom[^\n]*\n?/gm, '')
    .replace('%ACTION_TRIGGER%', '')
    .replace(/^on:\n  push:\n    branches:\n      - main\n/m, 'on:\n')
    .replace('%TOKEN_PERMISSIONS%', '')
    .replace(/^(  id-token: write)\n  contents: read$/m, '$1')
    .replace('%PROJECT_DEPENDENCIES%', '')
    .trimEnd();
  const refs = /((?:          cache-name: lively-repo(?:-with-build)?|          repository: LivelyKernel\/lively.next)\n          ref: )([^\n]+)/g;
  const versions = [...source.matchAll(refs)].map(match => match[2]);
  // The generator uses the same commit in both caches and the Lively checkout.
  if (versions.length && (versions.length !== 3 || new Set(versions).size !== 1 || !/^(?:[a-f\d]{7,40}|%LIVELY_VERSION%)$/.test(versions[0]))) return null;
  source = source.replace(refs, '$1%LIVELY_VERSION%');
  const project = source.match(/      - name: Checkout Project Repository\n        uses: actions\/checkout@v4\n        with:\n          ref: \$\{\{ github.ref \}\}\n          path: local_projects\/[^\n]+/);
  if (!project) return { content: source, dependencies: new Map() };
  const start = project.index + project[0].length;
  const checkout = /\n      - name: Checkout Project Dependencies\n        uses: actions\/checkout@v4\n        with:\n          repository: ([^\n]+)\n          path: local_projects\/([^\n]+)\/(?:\n          ssh-key: \$\{\{ secrets\.([\w]+) \}\})?/y;
  let end = start;
  const seen = new Map();
  while (true) {
    checkout.lastIndex = end;
    const dependency = checkout.exec(source);
    if (!dependency) break;
    const [, repository, name, secret] = dependency;
    if (generatedDependencies && !generatedDependencies.has(name)) return { content: null, unknownDependency: name };
    if (secret && generatedDependencies && !generatedDependencies.get(name)) return { content: null, publicDependencyWithKey: name };
    if (seen.has(name) ||
        repository !== name.replace(/--.*/, '') + '/' + name.replace(/.*--/, '') ||
        secret && secret !== name.replaceAll('/', '_').replaceAll('-', '_')) return null;
    seen.set(name, !!secret);
    end = checkout.lastIndex;
  }
  return { content: source.slice(0, start) + source.slice(end), dependencies: seen };
}

/** Reconstruct the generated templates preceding the pinned Bun workspace setup. */
function beforeBunWorkspaces (source) {
  const cache = source.includes('id: cache-lively-with-build') ? 'cache-lively-with-build' : 'cache-lively';
  return source
    .replace("node-version: '24.20.0'", "node-version: '24'")
    .replace('        with:\n          bun-version: 1.4.2\n', '')
    .replace('dtolnay/rust-toolchain@1.95.0', 'dtolnay/rust-toolchain@stable')
    .replace('      - name: Install `lively.next`\n', `      - name: Install \`lively.next\`\n        if: \${{ steps.${cache}.outputs.cache-hit != 'true' }}\n`)
    .replace(/      - name: Install Project Dependencies\n        run: node lively.project\/package-install.mjs local_projects\/[^\n]+\n/, '')
    .replace(/bun run --cwd (local_projects\/[^\n ]+) build-minified/, 'npm run build-minified --prefix $1');
}

/** Reconstruct the Node 20 templates used before Bun and Rust were required. */
function beforeBunAndRust (source) {
  return beforeBunWorkspaces(source)
    .replace("node-version: '24'", "node-version: '20.10'")
    .replace('      - name: Setup bun\n        uses: oven-sh/setup-bun@v2\n', '')
    .replace('      - name: Setup Rust toolchain\n        uses: dtolnay/rust-toolchain@stable\n        with:\n          targets: wasm32-wasip1\n', '');
}

/** Reconstruct the generated install step used before retry-on-CDN-failure. */
function beforeInstallRetry (source) {
  return beforeBunAndRust(source)
    .replace('      - name: Prepare to install `lively.next`\n        run: chmod a+x ./install.sh\n', '')
    .replace(/        uses: nick-fields\/retry@v3\n        with:\n          timeout_minutes: 15\n          max_attempts: 5\n          retry_on: error\n          command: (\.\/install.sh(?: --freezer-only)?)/, '        run: |\n          chmod a+x ./install.sh\n          $1');
}

export function preserveWorkflowCustomizations (previous, generated, onPreserved = console.warn) {
  const custom = customSections(previous);
  const slots = customSections(generated);
  const current = generatedContent(generated);
  // An unknown checkout could be a custom step or a removed dependency; keep either.
  const old = generatedContent(previous, current?.dependencies);
  if (previous.trim() && !custom.size && (old === null || current === null ||
      ![current.content, beforeBunWorkspaces(current.content), beforeBunAndRust(current.content), beforeInstallRetry(current.content)].includes(old.content))) {
    const reason = old?.unknownDependency ? `Unknown dependency checkout "${old.unknownDependency}" kept unchanged. `
      : old?.publicDependencyWithKey ? `Dependency checkout "${old.publicDependencyWithKey}" has an SSH key, but is configured as public; workflow kept unchanged. ` : '';
    onPreserved(reason + 'Unmarked custom or older workflow kept unchanged: runtime, trigger and dependency updates were not applied. Move custom steps into lively.next:custom sections from the current templates (lively.project/README.md) to enable updates.');
    return previous;
  }
  for (const id of custom.keys()) {
    if (!slots.has(id)) throw new Error(`No destination for custom workflow section: ${id}`);
  }
  for (const [id, slot] of [...slots].reverse()) {
    if (custom.has(id)) generated = generated.slice(0, slot.start) + custom.get(id).content + generated.slice(slot.end);
  }
  return generated;
}
