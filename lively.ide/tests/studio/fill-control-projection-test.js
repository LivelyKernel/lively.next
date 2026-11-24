/* global describe, it */
import { expect } from 'mocha-es6';
import { FillControlModel } from '../../studio/controls/fill.cp.js';

describe('fill control projectional commands', () => {
  it('uses a component command without performing a second mutation', () => {
    const target = {
      owner: null,
      sizeToAspectRatio: false,
      _changeTracker: {
        tracksMorph: () => true,
        setProperty: ({ value }) => {
          target.sizeToAspectRatio = value;
          return Object.freeze({ committed: true });
        }
      },
      withMetaDo: () => { throw new Error('unexpected second mutation'); }
    };
    FillControlModel.prototype.aspectRatioChecked.call({ targetMorph: target }, true);

    expect(target.sizeToAspectRatio).to.be.true;
  });

  it('performs an ordinary mutation when no component command target exists', () => {
    const metadata = [];
    const target = {
      owner: null,
      sizeToAspectRatio: false,
      withMetaDo: (meta, callback) => {
        metadata.push(meta);
        callback();
      }
    };
    FillControlModel.prototype.aspectRatioChecked.call({ targetMorph: target }, true);

    expect(target.sizeToAspectRatio).to.be.true;
    expect(metadata).deep.equals([]);
  });

  it('uses a serializer-backed component command for fill colors', () => {
    const color = { isColor: true };
    const target = {
      owner: null,
      fill: null,
      _changeTracker: {
        tracksMorph: () => true,
        setProperty: options => {
          expect(options).deep.include({ target, property: 'fill', value: color });
          target.fill = options.value;
          return Object.freeze({ committed: true });
        }
      },
      withMetaDo: () => { throw new Error('unexpected second mutation'); }
    };
    const model = {
      targetMorph: target,
      ui: { fillColorInput: { colorValue: color } }
    };

    FillControlModel.prototype.confirm.call(model);
    expect(target.fill).equals(color);
  });
});
