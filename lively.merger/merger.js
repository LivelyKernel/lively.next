import { Differ } from './differ.js';

class Merger {
  static mergeMorphsWithIds (morph1id, morph2id) {
    const morph1 = $world.submorphs.filter(morph => morph.id === morph1id)[0];
    if (!morph1) {
      $world.setStatusMessage('Cant diff morphs, morph1 not found');
      return;
    }

    const morph2 = $world.submorphs.filter(morph => morph.id === morph2id)[0];
    if (!morph2) {
      $world.setStatusMessage('Cant diff morphs, morph2 not found');
      return;
    }

    this.mergeMorphs(morph1, morph2);
  }

  static mergeMorphs (morph1, morph2) {

  }
}
