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

function generatedContent (source) {
  return source
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/^[ \t]*# lively.next:custom[^\n]*\n?/gm, '')
    .replace(/(          cache-name: lively-repo(?:-with-build)?\n          ref: )[^\n]+/g, '$1%LIVELY_VERSION%')
    .replace(/(          repository: LivelyKernel\/lively.next\n          ref: )[^\n]+/g, '$1%LIVELY_VERSION%')
    .replace('%ACTION_TRIGGER%', '')
    .replace(/^on:\n  push:\n    branches:\n      - main\n/m, 'on:\n')
    .replace('%TOKEN_PERMISSIONS%', '')
    .replace(/^(  id-token: write)\n  contents: read$/m, '$1')
    .replace('%PROJECT_DEPENDENCIES%', '')
    .replace(/\n      - name: Checkout Project Dependencies\n        uses: actions\/checkout@v4\n        with:\n          repository: [^\n]+\n          path: local_projects\/[^\n]+\/(?:\n          ssh-key: \$\{\{ secrets\.[\w]+ \}\})?/g, '')
    .trimEnd();
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

export function preserveWorkflowCustomizations (previous, generated, onPreserved = console.warn) {
  const custom = customSections(previous);
  const slots = customSections(generated);
  const current = generatedContent(generated);
  const old = generatedContent(previous);
  if (previous.trim() && !custom.size && old !== current && old !== beforeBunWorkspaces(current)) {
    onPreserved('Unmarked custom or older workflow kept unchanged: runtime, trigger and dependency updates were not applied. Move custom steps into lively.next:custom sections from the current templates (lively.project/README.md) to enable updates.');
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
