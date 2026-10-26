/* global describe, it, $world, document */
import { expect } from 'mocha-es6';
import { Morph } from 'lively.morphic';
import { pt } from 'lively.graphics';

describe('halo copy as HTML', () => {
  it('keeps default fill and borders when pasted without the source stylesheet', async () => {
    const target = new Morph({ extent: pt(100, 100), borderWidth: 3 }).openInWorld();
    const dispatcher = target.env.eventDispatcher;
    const copy = dispatcher.doCopyWithMimeTypes;
    let halo, frame, copied;
    dispatcher.doCopyWithMimeTypes = async data => { copied = data; };
    try {
      await target.whenRendered();
      halo = await $world.showHaloFor(target);
      await halo.whenRendered();
      await halo.copyHalo().copyToClipBoard();
      expect(copied).to.be.ok;
      const html = copied.find(entry => entry.type === 'text/html').data;
      frame = document.createElement('iframe');
      // The source stylesheet URL is not available in the destination app.
      frame.srcdoc = html.replace(/<link[^>]*>/g, '');
      const loaded = new Promise(resolve => { frame.onload = resolve; });
      document.body.appendChild(frame);
      await loaded;
      const node = frame.contentDocument.querySelector('.morph-preview');
      const style = frame.contentWindow.getComputedStyle(node);
      expect(style.borderLeftStyle).equals('solid', 'real halo copy must preserve borders without a source stylesheet');
      expect(style.borderLeftWidth).equals('3px', 'real halo copy must preserve border widths');
      expect(style.backgroundColor).to.be.oneOf(['rgb(255, 255, 255)', 'color(display-p3 1 1 1)'], 'real halo copy must preserve default white fill');
    } finally {
      dispatcher.doCopyWithMimeTypes = copy;
      frame?.remove(); halo?.remove(); target.remove();
    }
  });
});
