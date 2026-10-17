import { captureRecovery, recover, assertSupportedOperation } from './recovery.js';

function validateOperation (operation) {
  if (!operation || typeof operation.validate !== 'function' ||
      typeof operation.apply !== 'function' || typeof operation.invert !== 'function') {
    throw new Error('MorphicChangeSet entries must be reversible morphic operations');
  }
}

export class MorphicRollbackError extends Error {
  constructor (message, { cause, rollbackErrors = [], unreversedOperations = [] }) {
    super(message);
    this.message = message;
    this.name = 'MorphicRollbackError';
    this.cause = cause;
    this.rollbackErrors = Object.freeze(rollbackErrors.slice());
    this.unreversedOperations = Object.freeze(unreversedOperations.slice());
  }
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
    const journal = [];
    try {
      for (const operation of this.operations) {
        assertSupportedOperation(operation);
        // Dynamic preconditions are checked at the operation's position.
        operation.validate(context);
        const recovery = captureRecovery(operation, context);
        journal.push(recovery);
        operation.apply(context);
      }
    } catch (error) {
      const rollback = recover(journal);
      if (rollback.unreversedOperations.length) {
        throw new MorphicRollbackError(
          `Failed to apply ${this.id} and to roll it back completely`,
          { cause: error, ...rollback }
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
