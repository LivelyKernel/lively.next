import { pt } from "lively.graphics";

class Layout {
  constructor({spacing} = {}) {
    this.spacing = spacing || 0;
    this.active = false;
  }
}

export class VerticalLayout extends Layout {
   
  applyTo(morph) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = morph.submorphs;
       
    this.active = true;
    submorphs.forEach(m => {
        m.position = pos;
        pos = m.bottomLeft.addPt(pt(0, this.spacing));
    });
    this.active = false;
  }
   
}

export class HorizontalLayout extends Layout {
 
 applyTo(morph) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = morph.submorphs;
    
    this.active = true;  
    submorphs.forEach(m => {
      m.position = pos;
      pos = m.topRight.addPt(pt(this.spacing, 0));
    });
    this.active = false;
 }
  
}

export class GridLayout extends Layout {
  
  constructor(props) {
    super(props);
    this.rowCount =  props.rowCount;
    this.columnCount = props.columnCount;
    this.columenMinimumWidth = props.columnMinimumWidth || {};
  }
  
  applyTo(morph) {
    
  }
  
}

export class TilingLayout extends Layout {
  
  applyTo(morph) {
    
  }
  
}