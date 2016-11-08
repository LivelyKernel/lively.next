import { pt, Color, Rectangle } from "lively.graphics";
import { Morph, Label, HorizontalLayout } from "./index.js";
import config from "./config.js";


export class TooltipViewer {

  constructor(world) {
    this.currenMorph = world;
  }

  notPartOfCurrentTooltip(newTarget) {
     return !newTarget.ownerChain().includes(this.currentMorph);
  }

  invalidatesCurrentTooltip(newTarget) {
     return newTarget.tooltip || this.notPartOfCurrentTooltip(newTarget);
  }

  mouseMove({targetMorph}) {
    if(this.currentMorph != targetMorph) {
      if (this.invalidatesCurrentTooltip(targetMorph)) {
         this.hoverOutOfMorph(this.currentMorph);
         this.hoverIntoMorph(targetMorph);
         this.currentMorph = targetMorph;
      }
    }
  }

  mouseDown({targetMorph}) {
    this.currentTooltip && this.currentTooltip.remove()
    this.currentTooltip = null;
  }

  hoverIntoMorph(morph) {
    this.clearScheduledTooltip();
    if (this.currentTooltip) {
      this.showTooltipFor(morph);
    } else {
      this.scheduleTooltipFor(morph);
    }
  }

  hoverOutOfMorph(morph) {
    const current = this.currentTooltip;
    this.currentTooltip && this.currentTooltip.softRemove((tooltip) => {
      if (this.currentTooltip == tooltip) {
          this.currentTooltip = null;
      }
    });
  }

  scheduleTooltipFor(morph) {
    this.timer = setTimeout(() => {
        this.showTooltipFor(morph);
      }, config.showTooltipsAfter * 1000);
  }

  clearScheduledTooltip() {
    clearTimeout(this.timer);
  }

  showTooltipFor(morph) {
    if (morph.tooltip) {
      this.currentTooltip && this.currentTooltip.remove();
      this.currentTooltip = new Tooltip({
        position: morph.globalBounds().bottomRight(),
        description: morph.tooltip});
      morph.world().addMorph(this.currentTooltip);
    }
  }

}

class Tooltip extends Morph {

  constructor(props) {
    super({
      ...props,
      styleClasses: ["morph", "tooltip"],
      draggable: false,
      fill: Color.black.withA(.5),
      borderRadius: 4,
      layout: new HorizontalLayout({spacing: 5}),
      submorphs: [new Label({
        width: 200,
        fixedWidth: props.description.length > 40,
        value: props.description,
        fill: Color.transparent,
        fontColor: Color.white,
      })]
    });
  }

  set description(stringOrAttributes) {
    const [descriptor] = this.submorphs;
    descriptor.value = stringOrAttributes;
  }

  async softRemove(cb) {
    await this.animate({opacity: 0});
    cb && cb(this);
    this.remove()
  }

}
