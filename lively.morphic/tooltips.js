import { pt } from 'lively.graphics';
import { Morph } from './morph.js';
import { morph, touchInputDevice } from './helpers.js';
import config from './config.js';
import { fun } from 'lively.lang';

export class TooltipViewer {
  constructor (world) {
    this.currentMorph = world;
  }

  get __dont_serialize__ () {
    return ['currentTooltip', 'currentMorph'];
  }

  notPartOfCurrentTooltip (newTarget) {
    return !newTarget.ownerChain().includes(this.currentMorph);
  }

  invalidatesCurrentTooltip (newTarget) {
    return newTarget.tooltip || this.notPartOfCurrentTooltip(newTarget);
  }

  mouseMove (evt) {
    if (touchInputDevice) return; // no mouse cursor, no tooltips
    const { hand } = evt;
    const candidates = $world.morphsContainingPoint(evt.positionIn($world)).filter(m => m.reactsToPointer || m.tooltip);
    let targetMorph, prevCandidate;
    for (const candidate of candidates.slice(candidates.indexOf(hand) + 1)) {
      if (prevCandidate && !prevCandidate.ownerChain().includes(candidate)) break;
      if (candidate.tooltip) {
        targetMorph = candidate;
        break;
      }
      prevCandidate = candidate;
    }
    while (targetMorph && !targetMorph.visible) {
      targetMorph = targetMorph.morphBeneath(evt.positionIn($world));
    }

    if (!targetMorph) {
      if (this.currentTooltip) {
        this.currentTooltip.softRemove().then(() => {
          if (this.currentTooltip && !this.currentTooltip.owner) { this.currentTooltip = null; }
        });
      } else this.currentMorph = null;
      return;
    }

    if (this.currentMorph === targetMorph ||
       !this.invalidatesCurrentTooltip(targetMorph)) return;

    this.hoverOutOfMorph(this.currentMorph);
    this.hoverIntoMorph(targetMorph, hand);
    this.currentMorph = targetMorph;
  }

  mouseDown ({ targetMorph }) {
    this.currentTooltip && this.currentTooltip.remove();
    this.currentTooltip = null;
  }

  hoverIntoMorph (morph, hand) {
    this.clearScheduledTooltip();
    if (this.currentTooltip) {
      this.showTooltipFor(morph, hand);
    } else {
      this.scheduleTooltipFor(morph, hand);
    }
  }

  hoverOutOfMorph (morph) {
    const current = this.currentTooltip;
    this.currentTooltip && this.currentTooltip.softRemove((tooltip) =>
      this.currentTooltip == tooltip && (this.currentTooltip = null));
  }

  scheduleTooltipFor (morph, hand) {
    this.timer = setTimeout(
      () => {
        if (this.currentMorph) { this.showTooltipFor(morph, hand); }
      },
      config.showTooltipsAfter * 1000);
  }

  clearScheduledTooltip () {
    clearTimeout(this.timer);
  }

  clearCurrentTooltip () {
    const current = this.currentTooltip;
    if (current) current.remove();
  }

  showTooltipFor (morph, hand) {
    if (!morph.tooltip || !morph.world()) {
      return;
    }
    this.clearCurrentTooltip();
    const position = hand ? hand.position.addXY(10, 7) : morph.globalBounds().bottomRight();
    this.currentTooltip = new Tooltip({ position, description: morph.tooltip });
    $world.addMorph(this.currentTooltip);
    this.currentTooltip.update(morph);
  }
}

export class Tooltip extends Morph {
  static get properties () {
    return {
      hasFixedPosition: { defaultValue: true },
      reactsToPointer: { defaultValue: false },
      isEpiMorph: { defaultValue: true },
      master: {
        initialize () {
          this.master = { auto: 'styleguide://System/tooltip' };
        }
      },
      description: {
        after: ['submorphs'],
        derived: true,
        get () {
          const [descriptor] = this.submorphs;
          return descriptor.value;
        },
        set (stringOrAttributes) {
          const [descriptor] = this.submorphs;
          descriptor.value = stringOrAttributes;
          descriptor.fit();
        }
      },
      submorphs: {
        initialize () {
          this.submorphs = [
            new morph({
              reactsToPointer: false,
              type: 'label',
              width: 200
            })
          ];
        }
      }
    };
  }

  update (target) {
    this.position = target.globalBounds().bottomCenter().subPt(target.world().scroll).addPt(pt(0, 7));
  }

  async softRemove (cb) {
    await this.animate({ opacity: 0, duration: 300 });
    cb && cb(this);
    this.remove();
  }
}
