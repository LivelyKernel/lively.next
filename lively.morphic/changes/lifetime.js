/* eslint-disable no-console */
/* global WeakRef */
const liveHandles = new Set();
const disposalReceipts = new WeakSet();

/** Resolve membership without detaching descendants. */
export function topOwner (node) {
  while (node?.owner) node = node.owner;
  return node;
}

/** Weak handles must not extend the lifetime of abandoned history. */
function liveRoots () {
  const roots = new Set();
  for (const reference of liveHandles) {
    const handle = reference.deref();
    if (!handle) liveHandles.delete(reference);
    else if (!handle.released) handle.roots.forEach(root => roots.add(root));
  }
  return roots;
}

/** Membership, not child.owner == null: a retained subtree keeps its owners. */
export function isReleasedDetachedMember (node, root, retainedRoots = liveRoots()) {
  if (!root || root.owner || root.isWorld || root.world?.() || topOwner(node) !== root) return false;
  for (let current = node; current; current = current.owner) if (retainedRoots.has(current)) return false;
  return true;
}

/** Preserve explicit abandon's pre-order traversal. */
function nodesOf (root) { return [root, ...(root.submorphs || []).flatMap(nodesOf)]; }

/** Release supplies candidates; only a caller's per-node predicate authorizes disposal. */
export class DetachedLifetimeHandle {
  constructor (roots = [], { onRelease = null, shouldDispose = null, dispose = null, logError = null } = {}) {
    if ([onRelease, shouldDispose, dispose, logError].some(fn => fn !== null && typeof fn !== 'function') ||
        !!shouldDispose !== !!dispose) throw new Error('Detached disposal requires a caller predicate and hook');
    Object.assign(this, { roots: [...new Set(roots)], onRelease, shouldDispose, dispose, logError, released: false });
    this.reference = new WeakRef(this);
    liveHandles.add(this.reference);
  }

  update (roots) {
    if (this.released) throw new Error('Detached lifetime handle has been released');
    this.roots = [...new Set(roots)];
  }

  release (reason = 'released') {
    if (this.released) return false;
    this.released = true;
    liveHandles.delete(this.reference);
    const roots = this.roots;
    this.roots = [];
    const info = Object.freeze({ handle: this, roots: Object.freeze(roots), reason });
    this.releasedRoots = roots.map(root => new WeakRef(root));
    this.releaseReason = reason;
    try { this.onRelease?.(info); } catch (error) { this.report(error); }
    this.disposeReleased();
    return true;
  }

  report (error) {
    if (this.logError) this.logError(error);
    else console.error('Detached disposal failed', error);
  }

  /** A caller may reconsider candidates after another overlapping handle releases. */
  disposeReleased () {
    if (!this.released || !this.shouldDispose) return;
    const roots = this.releasedRoots.map(reference => reference.deref()).filter(Boolean);
    const retained = liveRoots();
    const candidates = roots.flatMap(root => nodesOf(root).filter(node => isReleasedDetachedMember(node, root, retained)).map(node => ({ node, root })));
    const info = Object.freeze({ handle: this, roots: Object.freeze(roots), reason: this.releaseReason });
    for (const { node, root } of candidates) {
      try {
        if (disposalReceipts.has(node) || !isReleasedDetachedMember(node, root) || !this.shouldDispose(node, info)) continue;
        if (!isReleasedDetachedMember(node, root)) continue;
        // Record before the callback so reentrant release cannot dispose twice.
        disposalReceipts.add(node);
        this.dispose(node, info);
      } catch (error) { this.report(error); }
    }
  }
}
