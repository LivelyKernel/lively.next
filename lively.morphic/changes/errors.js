export class MorphicTransactionUnsupportedError extends Error {
  constructor (message, { kind, targetId = null, detection = 'before' } = {}) {
    super(message);
    this.message = message;
    this.name = 'MorphicTransactionUnsupportedError';
    Object.assign(this, { kind, targetId, detection });
  }
}

export class MorphicTransactionAsyncError extends Error {
  constructor (message = 'Morphic transactions must be synchronous') {
    super(message);
    this.message = message;
    this.name = 'MorphicTransactionAsyncError';
  }
}

export class MorphicSemanticViewReplayError extends Error {
  constructor (view) {
    super('Exact semantic text replay requires the matching commit context and receipt');
    this.message = 'Exact semantic text replay requires the matching commit context and receipt';
    this.name = 'MorphicSemanticViewReplayError';
    this.changeSetId = view.id;
  }
}

export class MorphicHistoryOwnershipError extends Error {
  constructor (kind, { ownedIdentities = [], interleavedEntries = [], missingIdentities = [] } = {}) {
    super(`Cannot replace morphic history: ${kind}`);
    this.message = `Cannot replace morphic history: ${kind}`;
    this.name = 'MorphicHistoryOwnershipError';
    this.kind = kind;
    this.ownedIdentities = Object.freeze(ownedIdentities.slice());
    this.interleavedEntries = Object.freeze(interleavedEntries.slice());
    this.missingIdentities = Object.freeze(missingIdentities.slice());
  }
}

export class MorphicCompensationConflictError extends Error {
  constructor (changeSet, cause = null) {
    super('Cannot prove a complete before or after state for morphic compensation');
    this.message = 'Cannot prove a complete before or after state for morphic compensation';
    this.name = 'MorphicCompensationConflictError';
    this.changeSet = changeSet;
    this.cause = cause;
  }
}
