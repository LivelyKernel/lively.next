/* global describe, it */
import { expect } from 'mocha-es6';
import { Label, MorphicEnv, component, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';

describe('master styling during text measurement', () => {
  for (const entry of ['renderStylingChanges', 'applyLayoutIfNeeded']) {
    it(`fits a styled label without re-entering its master through ${entry}`, async () => {
      const label = part(component({
        type: Label, name: 'master styling regression', readOnly: true,
        textString: 'Measure the styled label', extent: pt(180, 30),
        fixedWidth: false, fixedHeight: false, fontColor: Color.blue
      })).openInWorld();
      const env = label.env;
      const master = label.master;
      const apply = master.applyIfNeeded;
      let applying = false;
      let applications = 0;
      let reentries = 0;
      try {
        await label.whenFontLoaded();
        env.forceUpdate();
        expect(env).equals(MorphicEnv.default());
        expect(env.initialized).equals(true);
        expect(env.renderer.getNodeForMorph(label)).to.be.ok;
        // Exercise the real DOM fallback independently of the font heuristic.
        Object.defineProperty(label, 'canBeMeasuredViaCanvas', { get: () => false });
        master.applyIfNeeded = function (...args) {
          if (applying) {
            reentries++;
            if (reentries > 3) return;
          }
          applying = true;
          applications++;
          try { return apply.apply(this, args); } finally { applying = false; }
        };
        label.renderingState.needsRemeasure = true;
        delete label._cachedBounds;
        label.requestMasterStyling();

        if (entry === 'renderStylingChanges') env.renderer.renderStylingChanges(label);
        else label.applyLayoutIfNeeded();

        expect(reentries, 'DOM measurement re-entered master styling').equals(0);
        expect(applications).equals(1);
        expect(label._requestMasterStyling).equals(false);
        expect(label.fontColor).equals(Color.blue);
        expect(label.width).above(0);
        expect(label.height).above(0);
      } finally {
        master.applyIfNeeded = apply;
        label.remove();
      }
    });
  }
});
