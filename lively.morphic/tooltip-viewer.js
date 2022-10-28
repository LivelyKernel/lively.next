
import { touchInputDevice } from './helpers.js';
import config from './config.js';
import { SystemTooltip } from './tooltips.cp.js';
import { part } from 'lively.morphic';

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
    if (touchInputDevice || !!evt.state.draggedMorph) return; // no mouse cursor, no tooltips
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
    current && current.softRemove((tooltip) =>
      this.currentTooltip === tooltip && (this.currentTooltip = null));
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
    if (!morph.tooltip || !morph.world() ||
         hand.env.eventDispatcher.eventState.draggedMorph) {
      return;
    }
    this.clearCurrentTooltip();
    const position = hand ? hand.position.addXY(10, 7) : morph.globalBounds().bottomRight();
    this.currentTooltip = part(SystemTooltip, { position });
    this.currentTooltip.description = morph.tooltip;
    $world.addMorph(this.currentTooltip);
    this.currentTooltip.update(morph);
  }
}
