import { Morph, HorizontalLayout } from "../index.js";
import { Color, pt} from "lively.graphics";
import { Intersection, IntersectionParams } from 'kld-intersections';
import { arr } from "lively.lang";
import { connect } from "lively.bindings";
import { ColorPicker } from "../ide/style-editor.js";

const typeToStylizer = {
   'Morph' : StyleHalo,
   'Image' : ImageStyleHalo,
   'Ellipse' : EllipseStyleHalo,
   'Text' : TextStyleHalo,
   'Polygon' : SvgStyleHalo
}

export function stylizerFor(morph, pointerId) {
   return new StyleHalo(morph, pointerId);
}

class BorderStyler {

    // border style
    // border color
    // border width
    constructor(target) {

    }

}

class StyleHalo extends Morph {

   constructor(target, pointerId) {
       super({
          fill: Color.transparent,
          bounds: target.globalBounds().insetBy(-50),
       });
       this.state = {pointerId};
       this.target = target;
       this.submorphs = [{
           position: pt(50,50),
           fill: Color.transparent,
           submorphs: [
             this.borderHalo(),
             ...this.resizeHandles(), 
             this.borderRadiusHalo(),
             this.layoutHalo()
           ]
       }];
   }

   get isLayoutHalo() { return true; }
   
   onMouseMove(evt) { this.update(evt) }

   update(evt) {
      this.setBounds(this.target.globalBounds().insetBy(-50));
      this.submorphs[0].submorphs.forEach(s => s.update && s.update(evt));
   }


   mouseCapturer() {
      return {
          bounds: this.target.innerBounds().insetBy(-50),
          fill: Color.transparent,
          onMouseMove: (evt)  => { this.update(evt) }
      }
   }

   // resizing

   get handles() { return this.submorphs[0].submorphs.filter(m => m.isHaloItem) }

   // border styling

   isOnMorphBorder(evt) {
      const {x,y} = evt.positionIn(this.target),
            {width, height, borderRadius: br} = this.target;
      return !arr.some(this.handles, m => m.isHaloItem && m.active) && Intersection.intersectShapes(  
              IntersectionParams.newRoundRect(0, 0, width, height, br, br), 
              IntersectionParams.newRect(x - 5, y - 5, 10, 10)).points.length > 0;
   }

   borderHalo() {
      const target = this.target, halo = this;
      // subscribe to the global mouse move event
      return {
         draggable: false,
         borderWidth: Math.max(3, target.borderWidth), 
         fill: Color.transparent,
         borderColor: Color.orange.withA(0.4),
         borderRadius: target.borderRadius,
         bounds: target.innerBounds(),
         isHaloItem: true,
         update(evt) {
           this.setBounds(target.innerBounds());
           this.borderWidth = Math.max(3, target.borderWidth);
           this.borderRadius = target.borderRadius;
           if (halo.isOnMorphBorder(evt)) {
              this.animate({borderColor: Color.orange});
              halo.nativeCursor = this.nativeCursor = "pointer";
              // this.tooltip = "Change the morph's border style."
              this.active = true;
           } else {
              this.animate({borderColor: Color.orange.withA(.4)});
              halo.nativeCursor = this.nativeCursor = null;
              // this.tooltip = "Change the fill color of the morph.";
              this.active = false;
           }
         },
         onMouseDown() {
            if (this.active) {
                this.borderStyler = this.borderStyler || new BorderStyler(this.target);
                this.borderStyler.openInWorldNearHand();
            } else {
                this.picker = this.picker || new ColorPicker({extent: pt(400,450), color: this.target.fill})
                this.picker.openInWorldNearHand();                   
                connect(this.picker, "color", this.target, "fill");
            }
         },
      }
   }

   borderRadiusHalo() {
       const halo = this,
             getPos = () => {
          return halo.target.innerBounds().topRight().addXY(-halo.target.borderRadius, 0)
       };
       return {
          type: 'ellipse',
          fill: Color.red,
          isHaloItem: true,
          nativeCursor: 'ew-resize',
          borderWidth: 1,
          borderColor: Color.black,
          extent: pt(10,10),
          center: getPos(),
          update(evt) { this.center = getPos(); },
          onDragStart(evt) { this.active = true; },
          onDrag(evt) {
             halo.onMouseMove(evt);
             halo.target.borderRadius -= evt.state.dragDelta.x;
             this.center = getPos();
          },
          onDragEnd(evt) { this.active = false; }
       }
   }

   // layout halo

   layoutHalo() {
       const layout = this.target.layout,
             getPos = () => this.target.innerBounds().bottomCenter().addXY(0, 20);
       return {
           borderRadius: 30,
           extent: pt(120, 75),
           topCenter: getPos(),
           fill: Color.gray.withA(.7),
           layout: new HorizontalLayout({spacing: 5}),
           update(evt) { this.topCenter = getPos() },
           submorphs: [
               {type: 'text', fill: Color.transparent,
                fixedWidth: true, width: 75, padding: 2, readOnly: true, 
                fontStyle: 'bold', textString:  layout ? layout.name : "None"},
               {styleClasses: ["fa", "fa-th"],
                nativeCursor: "pointer",
                fill: Color.transparent,
                extent: pt(20,20)}
           ]
       }
   }

}

class EllipseStyleHalo extends StyleHalo {

    borderHalo() {
       // no handle for chaning the border radius, but different
       // circular shape of the border
    }

}

class ImageStyleHalo extends StyleHalo {

     // has no fill halo, but instead provides an image change interface

}

class TextStyleHalo extends StyleHalo {

    // basically just displays the rich text styling mode all the time

}

class SvgStyleHalo extends StyleHalo {

    // provides a more advances border styler, that besides border stylizer
    // also provides the abilitiy to add/remove anchors, and modify them

}