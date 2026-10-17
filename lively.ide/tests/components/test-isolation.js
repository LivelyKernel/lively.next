/* global beforeEach, afterEach */
import { MorphicEnv } from 'lively.morphic';

/**
 * Component editors opened by a test keep their change trackers and
 * projectional undo entries alive. Later suites then pay for every leaked
 * listener on each morph change, so restore both after every test.
 */
export function releaseComponentEditingState () {
  let listeners, undos, redos;
  beforeEach(() => {
    const { changeManager, undoManager } = MorphicEnv.default();
    listeners = [...changeManager.committedChangeListeners];
    undos = [...undoManager.undos];
    redos = [...undoManager.redos];
  });
  afterEach(() => {
    const { changeManager, undoManager } = MorphicEnv.default();
    for (const listener of changeManager.committedChangeListeners.slice()) {
      if (!listeners.includes(listener)) changeManager.removeCommittedChangeListener(listener);
    }
    undoManager.undos = undos;
    undoManager.redos = redos;
  });
}
