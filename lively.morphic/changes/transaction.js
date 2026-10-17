import { MorphicChangeSet, MorphicRollbackError, rollbackOperations } from './change-set.js';

export class MorphicTransaction {
  constructor (manager, {
    id,
    label = '',
    origin = 'user',
    undoable = true,
    metadata = {}
  }) {
    this.manager = manager;
    this.id = id;
    this.label = label;
    this.origin = origin;
    this.undoable = !!undoable;
    this.metadata = { ...metadata };
    this.operations = [];
    this.state = 'open';
  }

  ensureOpen () {
    if (this.state !== 'open') throw new Error(`Transaction ${this.id} is ${this.state}`);
  }

  perform (operation) {
    this.ensureOpen();
    operation.validate(this.manager.context);
    operation.apply(this.manager.context);
    this.operations.push(operation);
    return operation;
  }

  commit () {
    this.ensureOpen();
    this.state = 'committed';
    return new MorphicChangeSet({
      id: this.id,
      label: this.label,
      origin: this.origin,
      undoable: this.undoable,
      operations: this.operations,
      metadata: this.metadata
    });
  }

  rollback (cause = null) {
    this.ensureOpen();
    const rollbackErrors = rollbackOperations(this.operations, this.manager.context);
    this.state = 'rolled-back';
    if (rollbackErrors.length) {
      throw new MorphicRollbackError(
        `Failed to roll back transaction ${this.id} completely`,
        cause,
        rollbackErrors
      );
    }
    return this;
  }
}
