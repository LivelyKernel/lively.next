import { MorphicTransactionUnsupportedError, MorphicTransactionAsyncError } from './errors.js';

/** Validate a domain receipt before admitting its effects. */
function receiptFor (edit, direction) {
  if (typeof edit?.captureRecovery !== 'function') {
    throw new MorphicTransactionUnsupportedError('Atomic domain edits require a recovery receipt', { kind: 'domain-without-recovery' });
  }
  const receipt = edit.captureRecovery({ direction });
  if (!receipt || !Object.isFrozen(receipt) || typeof receipt.restore !== 'function' || typeof receipt.restored !== 'function') {
    throw new MorphicTransactionUnsupportedError('Domain recovery requires a frozen restore/restored receipt', { kind: 'domain-recovery-receipt' });
  }
  return receipt;
}

/** Internal source unit; only performEdit admits a domain into the typed journal. */
export class DomainEditOperation {
  constructor (edit, { direction = 'forward', endpoints = {}, metadata = {} } = {}) {
    Object.assign(this, { edit, direction, endpoints, kind: 'domain-edit', metadata: Object.freeze({ ...metadata }) });
    Object.freeze(this);
  }

  validate () {
    if (typeof this.edit?.captureRecovery !== 'function') {
      throw new MorphicTransactionUnsupportedError('Atomic domain edits require a recovery receipt', { kind: 'domain-without-recovery' });
    }
    const before = this.direction === 'undo' ? this.endpoints.after : this.endpoints.before;
    if (before && !before.restored()) throw new Error('Precondition failed for domain edit');
  }

  captureRecovery () {
    const receipt = receiptFor(this.edit, this.direction);
    const endpoint = this.direction === 'undo' ? 'after' : 'before';
    this.endpoints[endpoint] ||= receipt;
    return { operation: this, restored: () => receipt.restored(), restore: () => receipt.restore() };
  }

  apply () {
    const result = this.direction === 'undo' ? this.edit.reverseApply() : this.edit.apply();
    if (result && typeof result.then === 'function') {
      Promise.resolve(result).catch(() => {});
      throw new MorphicTransactionAsyncError('Domain edits must be synchronous');
    }
    const endpoint = this.direction === 'undo' ? 'before' : 'after';
    if (!this.endpoints[endpoint]) this.endpoints[endpoint] = receiptFor(this.edit, this.direction === 'undo' ? 'redo' : 'undo');
    if (!this.endpoints[endpoint].restored()) throw new Error('Domain edit did not reach its recorded endpoint');
    if (this.endpoints.before && this.endpoints.after) Object.freeze(this.endpoints);
    return this;
  }

  matches (endpoint) { return !!this.endpoints[endpoint]?.restored(); }

  invert () {
    return new DomainEditOperation(this.edit, {
      direction: this.direction === 'undo' ? 'redo' : 'undo', endpoints: this.endpoints, metadata: this.metadata
    });
  }
}
