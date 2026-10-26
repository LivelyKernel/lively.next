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

export function preserveWorkflowCustomizations (previous, generated) {
  const custom = customSections(previous);
  const slots = customSections(generated);
  for (const id of custom.keys()) {
    if (!slots.has(id)) throw new Error(`No destination for custom workflow section: ${id}`);
  }
  for (const [id, slot] of [...slots].reverse()) {
    if (custom.has(id)) generated = generated.slice(0, slot.start) + custom.get(id).content + generated.slice(slot.end);
  }
  return generated;
}
