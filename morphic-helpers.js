import { rect, pt, Color } from "lively.graphics";
import { connect } from "lively.bindings";
import { Button, morph } from "lively.morphic";
"format esm";

export class TextFlow {

  constructor() {
    this.br = {};
    this.nothing = {};
  }
  
  button(label, action, closureMapping) {
    var b = new Button(rect(0,0, 100,20), label);
    b.setLabel(label);
    b.addScript(action, "doAction", closureMapping);
    b.applyStyle({fill: Color.white, cssStylingMode: false})
    connect(b, 'fire', b, 'doAction');
    return b;
  }
  
  text(stringOrList) {
    var t = morph({type: "text", extent: pt(20,20), fixedWidth: false, fixedHeight: false, fill: null, borderWidth: 0, readOnly: true})
    if (Array.isArray(stringOrList)) {
      if (!Array.isArray(stringOrList[0])) stringOrList = [[stringOrList]];
      t.textAndAttributes = stringOrList;
    }
    else t.textString = stringOrList;
    return t;
  }
  
  async add(target, morph, pos = pt(0,0)) {
    target.addMorph(morph);
    morph.setPosition(pos);
    if (morph.isButton) {
      var measure = target.addMorph(this.text(morph.getLabel()));
      measure.remove();
      morph.setExtent(measure.getExtent());
    }
    return morph;
  }
  
  async render(target, summary) {
    // render(that, [["hello world", {fontWeight: "bold"}], br, br, "test", button("test", () => show('hello'))])
    var pos = pt(0,0), maxY = 0;
    target.removeAllMorphs()
    target.clipMode("auto");
    for (let part of summary) {
      if (part === this.nothing) continue;
      if (part === this.br) {
        var bottomLeft = pt(0, maxY);
        pos = pos.eqPt(bottomLeft) ? pos.addXY(0, 20) : bottomLeft;
        maxY = pos.y;
        continue;
      }
      if (typeof part === "string" || Array.isArray(part)) part = this.text(part)
      if (part.isMorph) {
        await this.add(target, part, pos)
        pos = part.bounds().topRight();
        maxY = Math.max(maxY, pos.y + part.getExtent().y);
      }
    }
  }

}