import { newUUID } from 'lively.lang/string.js';
import { pt } from 'lively.graphics';

export class Comment {
  constructor (text, relativePosition = pt(0, 0)) {
    this.text = text;
    this.uuid = newUUID();
    this.timestamp = new Date().getTime();
    this.position = relativePosition;
    this.resolved = undefined;
  }

  equals (comment) {
    return this.uuid === comment.uuid;
  }

  resolve () {
    this.resolved = new Date().getTime();
  }

  unresolve () {
    this.resolved = undefined;
  }

  isResolved () {
    return !!this.resolved;
  }

  toggleResolveStatus () {
    this.isResolved() ? this.unresolve() : this.resolve();
  }
}
