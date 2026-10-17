import { MorphicChangeSet } from './change-set.js';
import { MorphicTransaction } from './transaction.js';

function isPromise (value) {
  return value && typeof value.then === 'function';
}

export const MorphicReplayDirection = Object.freeze({
  UNDO: 'undo',
  REDO: 'redo'
});

export class MorphicTransactionManager {
  constructor (context) {
    this.context = context;
    this.activeTransaction = null;
    this.listeners = [];
    this.transactionCounter = 0;
  }

  nextId () {
    return `morphic-transaction-${this.transactionCounter++}`;
  }

  addCommitListener (listener) {
    if (!this.listeners.includes(listener)) this.listeners.push(listener);
    return listener;
  }

  removeCommitListener (listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) this.listeners.splice(index, 1);
  }

  notifyCommitted (changeSet) {
    this.listeners.slice().forEach(listener => listener(changeSet));
  }

  transaction (options, callback) {
    if (typeof callback !== 'function') throw new Error('Morphic transactions require a callback');
    if (this.activeTransaction) {
      const result = callback(this.activeTransaction);
      if (isPromise(result)) throw new Error('Morphic transactions must be synchronous');
      return this.activeTransaction;
    }

    const transaction = new MorphicTransaction(this, {
      ...options,
      id: options?.id || this.nextId()
    });
    this.activeTransaction = transaction;
    try {
      const result = callback(transaction);
      if (isPromise(result)) throw new Error('Morphic transactions must be synchronous');
      const changeSet = transaction.commit();
      this.notifyCommitted(changeSet);
      return changeSet;
    } catch (error) {
      if (transaction.state === 'open') transaction.rollback(error);
      throw error;
    } finally {
      this.activeTransaction = null;
    }
  }

  replay (changeSet, direction) {
    if (!(changeSet instanceof MorphicChangeSet)) {
      throw new Error('Can only replay a MorphicChangeSet');
    }
    if (!Object.values(MorphicReplayDirection).includes(direction)) {
      throw new Error(`Unknown replay direction: ${direction}`);
    }
    const replaySet = direction === MorphicReplayDirection.UNDO
      ? changeSet.invert({
          id: this.nextId(),
          origin: MorphicReplayDirection.UNDO,
          metadata: { replayOf: changeSet.id, replayDirection: direction }
        })
      : new MorphicChangeSet({
          id: this.nextId(),
          label: changeSet.label,
          origin: MorphicReplayDirection.REDO,
          undoable: changeSet.undoable,
          operations: changeSet.operations,
          metadata: { ...changeSet.metadata, replayOf: changeSet.id, replayDirection: direction }
        });
    replaySet.apply(this.context);
    this.notifyCommitted(replaySet);
    return replaySet;
  }
}
