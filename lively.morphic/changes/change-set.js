function validateOperation (operation) {
  if (!operation || typeof operation.validate !== 'function' ||
      typeof operation.apply !== 'function' || typeof operation.invert !== 'function') {
    throw new Error('MorphicChangeSet entries must be reversible morphic operations');
  }
}

export class MorphicRollbackError extends Error {
  constructor (message, cause, rollbackErrors) {
    super(message);
    this.name = 'MorphicRollbackError';
    this.cause = cause;
    this.rollbackErrors = rollbackErrors;
  }
}

export function rollbackOperations (operations, context) {
  const rollbackErrors = [];
  for (const operation of operations.slice().reverse()) {
    try {
      const inverse = operation.invert();
      inverse.validate(context);
      inverse.apply(context);
    } catch (error) {
      rollbackErrors.push(error);
    }
  }
  return rollbackErrors;
}

export class MorphicChangeSet {
  constructor ({
    id,
    label = '',
    origin = 'user',
    undoable = true,
    operations = [],
    metadata = {}
  }) {
    if (typeof id !== 'string' || !id) throw new Error('MorphicChangeSet requires an id');
    operations.forEach(validateOperation);
    this.id = id;
    this.label = label;
    this.origin = origin;
    this.undoable = !!undoable;
    this.operations = Object.freeze(operations.slice());
    this.metadata = Object.freeze({ ...metadata });
    Object.freeze(this);
  }

  validate (context) {
    this.operations.forEach(operation => operation.validate(context));
    return this;
  }

  apply (context) {
    this.validate(context);
    const applied = [];
    try {
      for (const operation of this.operations) {
        operation.apply(context);
        applied.push(operation);
      }
    } catch (error) {
      const rollbackErrors = rollbackOperations(applied, context);
      if (rollbackErrors.length) {
        throw new MorphicRollbackError(
          `Failed to apply ${this.id} and to roll it back completely`,
          error,
          rollbackErrors
        );
      }
      throw error;
    }
    return this;
  }

  invert ({ id = `${this.id}:inverse`, origin = this.origin, metadata = {} } = {}) {
    return new MorphicChangeSet({
      id,
      label: this.label,
      origin,
      undoable: this.undoable,
      operations: this.operations.slice().reverse().map(operation => operation.invert()),
      metadata: { ...this.metadata, ...metadata, inverseOf: this.id }
    });
  }
}
