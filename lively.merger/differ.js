export class Differ {
  constructor (morph1id, morph2id) {
    const morph1 = $world.submorphs.filter(morph => morph.id === morph1id);
    const morph2 = $world.submorphs.filter(morph => morph.id === morph2id);
    this.diff(morph1, morph2);
  }

  diff (morph1, morph2) {
    if (!morph1 || !morph2 && morph1.styleClasses !== morph2.styleClasses) {
      $world.setStatusMessage('Cant diff morphs, classes differ or morphs not found');
    } else {
      $world.setStatusMessage('Diffing');
    }
  }
}
