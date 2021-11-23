import { Color } from 'lively.graphics';
export class Differ {
  constructor (morph1id, morph2id) {
    const morph1 = $world.submorphs.filter(morph => morph.id === morph1id)[0];
    const morph2 = $world.submorphs.filter(morph => morph.id === morph2id)[0];
    this.diff(morph1, morph2);
  }

  diff (morph1, morph2) {
    if (!morph1 || !morph2 || JSON.stringify(morph1.styleClasses) != JSON.stringify(morph2.styleClasses)) {
      $world.setStatusMessage('Cant diff morphs, classes differ or morphs not found');
    } else {
      $world.setStatusMessage('Diffing');
    }
  }
}
