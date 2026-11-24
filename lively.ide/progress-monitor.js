import { string } from 'lively.lang';

/** Passes the named steps of a long operation and its progress (0 to 1) to all of its `handlers`. */
export class ProgressMonitor {
  constructor ({ id = string.newUUID(), handlers = {} } = {}) {
    this.id = id;
    this.handlers = handlers;
  }

  get isProgressMonitor () { return true; }

  step (stepName, progress) {
    for (const handlerName in this.handlers) { this.handlers[handlerName](stepName, progress); }
  }
}
