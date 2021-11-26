import { Color } from 'lively.graphics';
export class Differ {
  constructor (morph1id, morph2id) {
    const morph1 = $world.submorphs.filter(morph => morph.id === morph1id)[0];
    const morph2 = $world.submorphs.filter(morph => morph.id === morph2id)[0];
    this.diff(morph1, morph2);
  }

  diff (firstMorph, secondMorph) {
    if (!firstMorph || !secondMorph || JSON.stringify(firstMorph.styleClasses) != JSON.stringify(secondMorph.styleClasses)) {
      $world.setStatusMessage('Cant diff morphs, classes differ or morphs not found');
    } else {
      const firstMorphProperties = firstMorph.propertiesAndPropertySettings().properties;
      const secondMorphProperties = secondMorph.propertiesAndPropertySettings().properties;
      let matchingProperties = {};
      let differentProperties = {};

      for (const [key, value] of Object.entries(firstMorphProperties)) {
        if (key == 'submorphs' && firstMorph[key].length > 0 && secondMorph[key].length > 0) {
          console.log('Uh shit they have submorphs'); // TODO
        }
        if (JSON.stringify(firstMorph[key]) == JSON.stringify(secondMorph[key])) {
          matchingProperties[key] = firstMorph[key];
        } else {
          differentProperties[key] = [firstMorph[key], secondMorph[key]];
        }
      }

      console.log('matching: ', matchingProperties);
      console.log('different: ', differentProperties);
    }
  }
}
