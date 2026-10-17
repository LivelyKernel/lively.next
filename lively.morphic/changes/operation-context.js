/* global WeakRef */
import { obj } from 'lively.lang';
import { MorphicAttachmentKind } from './operations.js';
import { attachmentOf, attachmentsEqual, propertyEquals } from './recovery.js';

/** Weak live lookup; only detached ownership roots have a strong lifetime handle. */
export function operationContext (manager, { scope = [], resolveMorph = manager.resolveMorph, metadata = {} } = {}) {
  const roots = (Array.isArray(scope) ? scope : [scope]).filter(Boolean).map(root => new WeakRef(root));
  const known = new Map();
  const detached = new Map();
  const remember = morph => {
    while (morph) {
      const previous = known.get(morph.id)?.deref();
      if (previous && previous !== morph) throw new Error(`Replaced morph ${morph.id}`);
      known.set(morph.id, new WeakRef(morph));
      morph = morph.owner;
    }
  };
  const find = (root, id) => root?.id === id ? root
    : root?.getMorphWithId?.(id) || root?.getSubmorphs?.().find(morph => morph.id === id);
  const context = {
    resolveMorph: id => {
      if (!id) return null;
      const expected = known.get(id)?.deref();
      const resolved = resolveMorph?.(id) || roots.map(root => find(root.deref(), id)).find(Boolean) || expected;
      if (expected && resolved !== expected) throw new Error(`Replaced morph ${id}`);
      return resolved;
    },
    enlist: morph => { manager._assertAtomicAccess(morph); remember(morph); },
    readMorphProperty: (morph, property) => property in morph
      ? morph[property] : morph.getProperty?.(property) ?? morph._morphicState?.[property],
    valuesEqual: propertyEquals,
    setMorphProperty: (morph, property, value) => {
      manager._assertAtomicAccess(morph);
      const write = () => {
        if (property in morph || !morph.setProperty) morph[property] = value;
        else morph.setProperty(property, value);
      };
      return manager.doWithValueChangeMeta({ ...metadata, ...manager.defaultMeta, doNotOverride: true }, morph, write);
    },
    validateMoveMorph: (morph, from, to) => {
      manager._assertAtomicAccess(morph);
      if (!attachmentsEqual(attachmentOf(morph), from)) {
        throw new Error(`Precondition failed for structural morph ${morph.id}`);
      }
      let owner = to.kind === MorphicAttachmentKind.ATTACHED ? context.resolveMorph(to.ownerId) : null;
      if (to.kind === MorphicAttachmentKind.ATTACHED && !owner) throw new Error(`Cannot resolve morph ${to.ownerId}`);
      for (; owner; owner = owner.owner) {
        manager._assertAtomicAccess(owner);
        if (owner === morph) throw new Error('MoveMorph cannot create an ownership cycle');
      }
    },
    moveMorph: (morph, from, to) => {
      const destination = to.kind === MorphicAttachmentKind.ATTACHED ? context.resolveMorph(to.ownerId) : null;
      const write = () => {
        if (!destination) morph.owner?.removeMorph(morph);
        else {
          const currentIndex = destination.submorphs.indexOf(morph);
          destination.addMorphAt(morph, to.index + (currentIndex > -1 && currentIndex < to.index ? 1 : 0));
        }
        if (to.localState) {
          morph.position = to.localState.position.copy();
          morph.rotation = to.localState.rotation;
          morph.scale = to.localState.scale;
        } else if (to.transform && !obj.equals(morph.getTransform(), to.transform)) morph.setTransform(to.transform.copy());
      };
      return manager.doWithValueChangeMeta({ ...metadata, ...manager.defaultMeta }, morph, write);
    },
    restoreMoveMorph: (morph, before, transform, owners) => {
      // A failed primitive may have spliced a list without updating _owner yet.
      for (const owner of new Set([...owners, morph.owner].filter(Boolean))) {
        const children = owner.getProperty?.('submorphs') || [];
        if (owner !== morph.owner) {
          for (let index = children.indexOf(morph); index > -1; index = children.indexOf(morph)) children.splice(index, 1);
        }
      }
      if (morph.owner && !morph.owner.submorphs.includes(morph)) morph._owner = null;
      context.moveMorph(morph, before, { ...before, transform });
    },
    retainDetached: (operations = []) => {
      detached.clear();
      const ids = new Set(operations.flatMap(operation => [operation.targetId, operation.from?.ownerId, operation.to?.ownerId]));
      for (const id of ids) {
        let root = known.get(id)?.deref();
        while (root?.owner) root = root.owner;
        if (root && !root.isWorld) detached.set(root.id, root);
      }
    },
    release: () => detached.clear()
  };
  roots.forEach(root => remember(root.deref()));
  return context;
}
