import { pt } from "lively.graphics";

class Layout {
  constructor({spacing, border} = {}) {
    this.border = {top: 0, left: 0, right: 0, bottom: 0, ...border};
    this.spacing = spacing || 0;
    this.active = false;
  }
}

export class VerticalLayout extends Layout {
   
  applyTo(morph) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = morph.submorphs,
        maxWidth = 0;
       
    this.active = true;
    submorphs.forEach(m => {
        m.position = pos;
        pos = m.bottomLeft.addPt(pt(0, this.spacing));
        maxWidth = Math.max(m.height, maxWidth);
    });
    morph.extent = pt(maxWidth, pos.y)
    this.active = false;
  }
   
}

export class HorizontalLayout extends Layout {
 
 applyTo(morph) {
    if (this.active) return;
    var pos = pt(this.spacing, this.spacing),
        submorphs = morph.submorphs,
        maxHeight = 0;
        
    this.maxHeight = 0;
    this.active = true;  
    submorphs.forEach(m => {
      m.position = pos;
      pos = m.topRight.addPt(pt(this.spacing, 0));
      maxHeight = Math.max(m.width, maxHeight);
    });
    morph.extent = pt(pos.x, maxHeight);  
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
    var width = this.getOptimalWidth(morph, morph.submorphs),
        currentRowHeight = 0,
        currentRowWidth = 0,
        spacing = this.spacing,
        previousRowHeight = spacing,
        i = 0, rowSwitch = true;
        
    if (this.active) return;
    this.active = true;

    while (i < morph.submorphs.length) {
        var submorphExtent = morph.submorphs[i].extent;
        if (rowSwitch || currentRowWidth + submorphExtent.x + 2*spacing <= width) {
            rowSwitch = false;
            morph.submorphs[i].position = pt(currentRowWidth + spacing, previousRowHeight);
            currentRowHeight = Math.max(currentRowHeight, submorphExtent.y);
            currentRowWidth += spacing + submorphExtent.x;
            i++;
        } else {
            previousRowHeight += spacing + currentRowHeight;
            currentRowWidth = currentRowHeight = 0;
            rowSwitch = true;
        }
    }
    
    this.active = false;
  }
  
  getMinWidth(container, submorphs) {
      return submorphs.reduce((s, e) => (e.extent.x > s) ? e.extent.x : s, 0) +
          this.border.left + this.border.right;
  }
  
  getMinHeight(container, submorphs) {
      return submorphs.reduce((s, e) => (e.extent.y > s) ? e.extent.y : s, 0) +
          this.border.top + this.border.bottom;
  }
  
  getOptimalWidth(container, submorphs) {
      var width = container.width,
          maxSubmorphWidth = this.getMinWidth(container, submorphs);
      return Math.max(width, maxSubmorphWidth);
  }
  
}