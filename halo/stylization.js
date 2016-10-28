import { Morph} from "../index.js";
import { VerticalLayout, HorizontalLayout, FillLayout,
         TilingLayout, GridLayout} from '../layout.js';
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
          draggable: false,
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
             this.borderRadiusHalo(),
             this.layoutHalo()
           ]
       }];
       this.focus()
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

   // border styling

   isOnMorphBorder(evt) {
      const {x,y} = evt.positionIn(this.getSubmorphNamed("borderHalo")),
            brHalo = this.getSubmorphNamed("borderRadiusHalo"),
            br = this.target.borderRadius,
            {width, height} = this.target.globalBounds();
            
      return !brHalo.active && Intersection.intersectShapes(  
              IntersectionParams.newRoundRect(0, 0, width, height, br, br), 
              IntersectionParams.newRect(x - 5, y - 5, 10, 10)).points.length > 0;
   }

   borderHalo() {
      const target = this.target, halo = this;
      // subscribe to the global mouse move event
      return {
         name: "borderHalo",
         draggable: false,
         borderWidth: Math.max(3, target.borderWidth), 
         fill: Color.transparent,
         borderColor: Color.orange.withA(0.4),
         borderRadius: target.borderRadius,
         bounds: target.globalBounds().withX(0).withY(0),
         isHaloItem: true,
         update(evt) {
           this.setBounds(target.globalBounds().withX(0).withY(0));
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
         onMouseDown(evt) {
            if (this.active) {
                const bs = this.borderStyler || new BorderStyler(target);
                bs.openInWorldNearHand();
                bs.adjustOrigin(evt.positionIn(bs));
                bs.scale = 0; bs.opacity = 0;
                bs.animate({opacity: 1, scale: 1, duration: 200});
                this.borderStyler = bs;
            } else {
                const p = this.picker || new ColorPicker({
                    extent: pt(400,310), 
                    color: target.fill})
                p.openInWorldNearHand();
                p.adjustOrigin(evt.positionIn(p));
                p.scale = 0; p.opacity = 0;
                p.animate({opacity: 1, scale: 1, duration: 200});
                connect(p, "color", target, "fill");
                this.picker = p;
            }
         },
      }
   }

   borderRadiusHalo() {
       const halo = this,
             getPos = () => {
          return halo.target.globalBounds()
                     .withX(0).withY(0).topRight()
                     .addXY(-halo.target.borderRadius, 0)
       };
       return {
          name: "borderRadiusHalo",
          type: 'ellipse',
          fill: Color.red,
          isHaloItem: true,
          nativeCursor: 'ew-resize',
          borderWidth: 1,
          borderColor: Color.black,
          extent: pt(10,10),
          center: getPos(),
          onHoverIn() { this.active = true; },
          onHoverOut() { this.active = false; },
          update(evt) { this.center = getPos(); },
          onDragStart(evt) { this.active = true; },
          onDrag(evt) {
             var r = halo.target.borderRadius;
             halo.onMouseMove(evt);
             r -= evt.state.dragDelta.x;
             r = Math.min(halo.target.width / 2, Math.max(r, 0));
             halo.target.borderRadius = r;
             this.center = getPos();
             this.active = true;
          },
          onDragEnd(evt) { this.active = false; }
       }
   }

   // layout halo

   getLayoutObjects() {
       return [null,
               new HorizontalLayout({autoResize: false}), 
               new VerticalLayout({autoResize: false}), 
               new FillLayout(), 
               new TilingLayout(), 
               new GridLayout({grid: [[null], [null], [null]]})];
   }

   layoutHalo() {
       const layout = this.target.layout,
             layoutName = (l) => l ? l.name() + " Layout" : "No Layout",
             getPos = () => this.target.globalBounds()
                                .withX(0).withY(0)
                                .bottomCenter().addXY(0, 20);
       return {
           borderRadius: 30,
           extent: pt(120, 75),
           topCenter: getPos(),
           fill: Color.gray.withA(.7),
           layout: new HorizontalLayout({spacing: 5}),
           isHaloItem: true, 
           update(evt) { 
              this.topCenter = getPos();
              const [_, inspectButton] = this.submorphs;
              if (!layout) {
                inspectButton.opacity = .5;
                inspectButton.nativeCursor = null;
              } else {
                inspectButton.opacity = 1;
                inspectButton.nativeCursor = "pointer";
              }
           },
           submorphs: [
               {type: 'text', fill: Color.transparent, name: "layoutPicker",
                padding: 2, readOnly: true, 
                fontWeight: 'bold', nativeCursor: "pointer",
                fontStyle: 'bold', textString: layoutName(layout),
                onMouseDown: () => {
                   var menu = this.world().openWorldMenu(
                      this.getLayoutObjects().map(l => {
                         return [layoutName(l), 
                                 () => { 
                                     this.target.animate({layout: l}); 
                                     this.getSubmorphNamed("layoutPicker")
                                         .textString = layoutName(l);
                                 }]
                      })
                   )
                   menu.globalPosition = this.getSubmorphNamed("layoutPicker").globalPosition;
                   menu.isHaloItem = true;
                }},
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