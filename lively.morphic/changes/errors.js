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
