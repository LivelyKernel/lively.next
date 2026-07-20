export const MorphicOperationKind = Object.freeze({
  SET_MORPH_PROPERTY: 'set-morph-property',
  INSERT_MORPH: 'insert-morph',
  REMOVE_MORPH: 'remove-morph',
  MOVE_MORPH: 'move-morph',
  REPLACE_TEXT: 'replace-text',
  CUSTOM: 'custom-operation'
});

export const MorphicAttachmentKind = Object.freeze({
  ATTACHED: 'attached',
  DETACHED: 'detached'
});

export const MorphicValueSemantics = Object.freeze({
  REFERENCE: 'reference',
  SNAPSHOT: 'snapshot'
});

const operationKinds = new Set(Object.values(MorphicOperationKind));
const valueSemanticsKinds = new Set(Object.values(MorphicValueSemantics));

function isSnapshotContainer (value) {
  if (Array.isArray(value)) return true;
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneSnapshotContainers (value, freeze = false, seen = new WeakMap()) {
  if (!isSnapshotContainer(value)) return value;
  if (seen.has(value)) return seen.get(value);
  const clone = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  seen.set(value, clone);
  Reflect.ownKeys(value).forEach(key => {
    clone[key] = cloneSnapshotContainers(value[key], freeze, seen);
  });
  return freeze ? Object.freeze(clone) : clone;
}

function snapshotContainersEqual (left, right, seen = new WeakMap()) {
  if (Object.is(left, right)) return true;
  if (!isSnapshotContainer(left) || !isSnapshotContainer(right) ||
      Array.isArray(left) !== Array.isArray(right)) return false;
  if (seen.get(left) === right) return true;
  seen.set(left, right);
  const leftKeys = Reflect.ownKeys(left);
  const rightKeys = Reflect.ownKeys(right);
  return leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] &&
      snapshotContainersEqual(left[key], right[key], seen));
}

function inferredValueSemantics (before, after) {
  return isSnapshotContainer(before) || isSnapshotContainer(after)
    ? MorphicValueSemantics.SNAPSHOT
    : MorphicValueSemantics.REFERENCE;
}

function resolveMorph (context, targetId) {
  const target = context?.resolveMorph?.(targetId);
  if (!target) throw new Error(`Cannot resolve morph ${targetId}`);
  return target;
}

export function attachedMorph ({ ownerId, index, transform = null }) {
  if (typeof ownerId !== 'string' || !ownerId) {
    throw new Error('Attached morph state requires an ownerId');
  }
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Attached morph state requires a non-negative integer index');
  }
  return Object.freeze({
    kind: MorphicAttachmentKind.ATTACHED,
    ownerId,
    index,
    transform
  });
}

export function detachedMorph () {
  return Object.freeze({ kind: MorphicAttachmentKind.DETACHED });
}

function validateAttachment (attachment, name) {
  if (!attachment || attachment.kind === MorphicAttachmentKind.DETACHED) {
    if (attachment?.kind !== MorphicAttachmentKind.DETACHED) {
      throw new Error(`${name} must be an attached or detached morph state`);
    }
    return;
  }
  if (attachment.kind !== MorphicAttachmentKind.ATTACHED ||
      typeof attachment.ownerId !== 'string' || !attachment.ownerId ||
      !Number.isInteger(attachment.index) || attachment.index < 0) {
    throw new Error(`${name} must be an attached or detached morph state`);
  }
}

export class MorphicOperation {
  constructor ({ kind, targetId, before, after, metadata = {}, ...details }) {
    if (!operationKinds.has(kind)) throw new Error(`Unknown morphic operation kind: ${kind}`);
    if (typeof targetId !== 'string' || !targetId) throw new Error('Morphic operations require a targetId');
    Object.assign(this, {
      kind,
      targetId,
      before,
      after,
      metadata: Object.freeze({ ...metadata }),
      ...details
    });
    Object.freeze(this);
  }

  validate () {}
  apply () { throw new Error(`${this.constructor.name}.apply is not implemented`); }
  invert () { throw new Error(`${this.constructor.name}.invert is not implemented`); }
}

export class SetMorphProperty extends MorphicOperation {
  constructor ({
    targetId,
    property,
    before,
    after,
    metadata = {},
    valueSemantics = inferredValueSemantics(before, after),
    snapshotValue = value => cloneSnapshotContainers(value, true),
    materializeValue = value => cloneSnapshotContainers(value),
    snapshotValuesEqual = snapshotContainersEqual
  }) {
    if (typeof property !== 'string' || !property) {
      throw new Error('SetMorphProperty requires a property name');
    }
    if (!valueSemanticsKinds.has(valueSemantics)) {
      throw new Error(`Unknown morphic property value semantics: ${valueSemantics}`);
    }
    if (valueSemantics === MorphicValueSemantics.SNAPSHOT &&
        [snapshotValue, materializeValue, snapshotValuesEqual]
          .some(callback => typeof callback !== 'function')) {
      throw new Error('Snapshot value semantics require snapshot, materialize, and equality hooks');
    }
    const operationBefore = valueSemantics === MorphicValueSemantics.SNAPSHOT
      ? cloneSnapshotContainers(snapshotValue(before), true)
      : before;
    const operationAfter = valueSemantics === MorphicValueSemantics.SNAPSHOT
      ? cloneSnapshotContainers(snapshotValue(after), true)
      : after;
    super({
      kind: MorphicOperationKind.SET_MORPH_PROPERTY,
      targetId,
      property,
      before: operationBefore,
      after: operationAfter,
      metadata,
      valueSemantics,
      snapshotValue,
      materializeValue,
      snapshotValuesEqual
    });
  }

  validate (context) {
    resolveMorph(context, this.targetId);
  }

  assertPrecondition (context, target) {
    if (context.checkPreconditions === false) return;
    const currentValue = context.readMorphProperty
      ? context.readMorphProperty(target, this.property)
      : target[this.property];
    const valuesEqual = context.valuesEqual || (
      this.valueSemantics === MorphicValueSemantics.SNAPSHOT
        ? (current, expected) => this.snapshotValuesEqual(
            this.snapshotValue(current),
            expected
          )
        : Object.is
    );
    if (!valuesEqual(currentValue, this.before, this)) {
      throw new Error(`Precondition failed for ${this.targetId}.${this.property}`);
    }
  }

  apply (context) {
    const target = resolveMorph(context, this.targetId);
    this.assertPrecondition(context, target);
    const value = this.valueSemantics === MorphicValueSemantics.SNAPSHOT
      ? cloneSnapshotContainers(this.materializeValue(this.after))
      : this.after;
    if (context.setMorphProperty) {
      context.setMorphProperty(target, this.property, value, this);
    } else {
      target[this.property] = value;
    }
    return this;
  }

  invert () {
    return new SetMorphProperty({
      targetId: this.targetId,
      property: this.property,
      before: this.after,
      after: this.before,
      metadata: this.metadata,
      valueSemantics: this.valueSemantics,
      snapshotValue: this.snapshotValue,
      materializeValue: this.materializeValue,
      snapshotValuesEqual: this.snapshotValuesEqual
    });
  }
}

export class MoveMorph extends MorphicOperation {
  constructor ({ morphId, from, to, metadata = {} }) {
    validateAttachment(from, 'MoveMorph.from');
    validateAttachment(to, 'MoveMorph.to');
    super({
      kind: MorphicOperationKind.MOVE_MORPH,
      targetId: morphId,
      before: Object.freeze({ ...from }),
      after: Object.freeze({ ...to }),
      metadata
    });
  }

  get morphId () { return this.targetId; }
  get from () { return this.before; }
  get to () { return this.after; }

  validate (context) {
    const morph = resolveMorph(context, this.morphId);
    if (this.from.kind === MorphicAttachmentKind.ATTACHED) {
      resolveMorph(context, this.from.ownerId);
    }
    if (this.to.kind === MorphicAttachmentKind.ATTACHED) {
      const owner = resolveMorph(context, this.to.ownerId);
      if (owner === morph) throw new Error('A morph cannot own itself');
    }
    context.validateMoveMorph?.(morph, this.from, this.to, this);
  }

  apply (context) {
    this.validate(context);
    if (typeof context.moveMorph !== 'function') {
      throw new Error('MoveMorph requires context.moveMorph');
    }
    context.moveMorph(
      resolveMorph(context, this.morphId),
      this.from,
      this.to,
      this
    );
    return this;
  }

  invert () {
    return new MoveMorph({
      morphId: this.morphId,
      from: this.to,
      to: this.from,
      metadata: this.metadata
    });
  }
}

export class CustomOperation extends MorphicOperation {
  constructor ({
    targetId,
    before,
    after,
    applyHandler,
    reverseHandler,
    validateHandler = null,
    metadata = {}
  }) {
    if (typeof applyHandler !== 'function' || typeof reverseHandler !== 'function') {
      throw new Error('CustomOperation requires explicit apply and reverse handlers');
    }
    if (validateHandler && typeof validateHandler !== 'function') {
      throw new Error('CustomOperation validateHandler must be a function');
    }
    super({
      kind: MorphicOperationKind.CUSTOM,
      targetId,
      before,
      after,
      applyHandler,
      reverseHandler,
      validateHandler,
      metadata
    });
  }

  validate (context) {
    resolveMorph(context, this.targetId);
    this.validateHandler?.(context, this);
  }

  apply (context) {
    this.applyHandler(context, this);
    return this;
  }

  invert () {
    return new CustomOperation({
      targetId: this.targetId,
      before: this.after,
      after: this.before,
      applyHandler: this.reverseHandler,
      reverseHandler: this.applyHandler,
      validateHandler: this.validateHandler,
      metadata: this.metadata
    });
  }
}
