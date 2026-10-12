export function nativeCallbacks(receiver) {
  let value = 2;
  return {read: () => value, increment: () => ++value, write: next => receiver.value = next};
}

export class SnapshotBase {
  value() { return this.amount; }
  get doubled() { return this.amount * 2; }
  static value() { return this.amount; }
}

export class SnapshotChild extends SnapshotBase {
  create(offset) { return () => super.value() + offset; }
  argumentCallbacks(value) {
    'use strict';
    const receiver = this;
    return {read: () => [receiver, arguments[0]], nested: () => () => [receiver, arguments[0]],
      args: () => (receiver, arguments), argsAlias: () => (receiver, arguments)};
  }
  callback = () => super.doubled;
  static create(offset) { return () => super.value() + offset; }
}

export class SnapshotGrandchild extends SnapshotChild {
  value() { return 1000; }
  static value() { return 1000; }
}

export const localClassFactories = [
  () => class extends SnapshotBase { create() { return () => super.value(); } },
  () => ({get klass() { return class extends SnapshotBase { create() { return () => super.value(); } }; }}).klass
];
