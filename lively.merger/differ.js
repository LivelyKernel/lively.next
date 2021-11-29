import { Color } from 'lively.graphics';
export class Differ {
  static diffMorphsWithIds (morph1id, morph2id) {
    const morph1 = $world.submorphs.filter(morph => morph.id === morph1id)[0];
    if (!morph1) {
      $world.setStatusMessage('Cant diff morphs, morph1 not found');
      return {};
    }

    const morph2 = $world.submorphs.filter(morph => morph.id === morph2id)[0];
    if (!morph2) {
      $world.setStatusMessage('Cant diff morphs, morph2 not found');
      return {};
    }

    return this.diffMorphs(morph1, morph2);
  }

  static diffMorphs (morph1, morph2) {
    if (JSON.stringify(morph1.styleClasses) != JSON.stringify(morph2.styleClasses)) {
      $world.setStatusMessage('Cant diff morphs, classes differ');
      return {};
    }

    const firstMorphProperties = morph1.propertiesAndPropertySettings().properties;
    const secondMorphProperties = morph2.propertiesAndPropertySettings().properties;

    let matchingProperties = {};
    let differentProperties = {};

    for (const [key, value] of Object.entries(firstMorphProperties)) {
      if (key == 'submorphs' && morph1[key].length > 0 && morph2[key].length > 0) {
        console.log('Uh shit they have submorphs'); // TODO
      }

      if (JSON.stringify(morph1[key]) == JSON.stringify(morph2[key])) {
        matchingProperties[key] = morph1[key];
      } else {
        differentProperties[key] = [morph1[key], morph2[key]];
      }
    }

    console.log('matching: ', matchingProperties);
    console.log('different: ', differentProperties);

    return { matchingProperties, differentProperties };
  }
}
