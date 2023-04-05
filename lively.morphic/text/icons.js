/* eslint-disable */

/*
Currently only FontAwesome icons are supported
  http://fontawesome.io/icons/

Resources are here

$world.execCommand("open file browser", {
  file: "assets/font-awesome/",
  location: lively.modules.getPackage("lively.morphic").url
});

Show all icons: (broken)

$world.openInWindow(morph({
  extent: pt(300,800), clipMode: "auto", type: "text", fontSize: 20, padding: Rectangle.inset(4),
  textAndAttributes: Object.keys(Icons).flatMap(name =>
    [`${Icons[name].code} ${name}\n`, {fontFamily: "", textStyleClasses: ["fa"]}])
}), {title: "icons"}).activate();

*/

import { obj } from "lively.lang";
import { morph } from '../helpers.js';

export class Icon {
  
  static makeLabel(iconName, props = {prefix: "", suffix: ""}) {
    // var l = Label.icon("users", {prefix: "??? ", suffix: " !!!", fontSize: 30}).openInWorld();
    var {prefix, suffix} = props;
    var textAndAttributes = [];
    if (prefix) textAndAttributes.push(...typeof prefix === "string" ? [prefix || "", {}] : prefix);
    textAndAttributes.push(...this.textAttribute(iconName, obj.dissoc(props, ['fontSize'])));
    if (suffix) textAndAttributes.push(...typeof suffix === "string" ? [suffix || "", {}] : suffix);
    return morph({
      type: 'text',
      value: textAndAttributes,
      ...obj.dissoc(props, ["prefix", "suffix"])
    });
  }

  static textAttribute(iconName, attrs = {}) {
    let isFar = attrs.textStyleClasses && attrs.textStyleClasses.includes('far');
    const fontFamily = Icons[iconName].iconSet === 'font awesome' ?  `"Font Awesome 6 Free", "Font Awesome 6 Brands"` : 'tabler-icons';
    delete attrs.textStyleClasses;
    return [
      Icons[iconName].code || `icon ${iconName} not found`,
       {fontFamily, fontWeight: isFar ? '400' : '900', ...attrs}]
    }

  static setIcon(label, iconName) {
     label.textAndAttributes = this.textAttribute(iconName);
  }

}

export var Icons = {
  "0": {iconSet: 'font awesome', code: "\u0030" },
  "1": {iconSet: 'font awesome', code: "\u0031" },
  "2": {iconSet: 'font awesome', code: "\u0032" },
  "3": {iconSet: 'font awesome', code: "\u0033" },
  "4": {iconSet: 'font awesome', code: "\u0034" },
  "5": {iconSet: 'font awesome', code: "\u0035" },
  "6": {iconSet: 'font awesome', code: "\u0036" },
  "7": {iconSet: 'font awesome', code: "\u0037" },
  "8": {iconSet: 'font awesome', code: "\u0038" },
  "9": {iconSet: 'font awesome', code: "\u0039" },
  "a": {iconSet: 'font awesome', code: "\u0022" },
  "address-book": {iconSet: 'font awesome', code: "\uf2b9" },
  "contact-book": {iconSet: 'font awesome', code: "\uf2b9" },
  "address-card": {iconSet: 'font awesome', code: "\uf2bb" },
  "contact-card": {iconSet: 'font awesome', code: "\uf2bb" },
  "vcard": {iconSet: 'font awesome', code: "\uf2bb" },
  "align-center": {iconSet: 'font awesome', code: "\uf037" },
  "align-justify": {iconSet: 'font awesome', code: "\uf039" },
  "align-left": {iconSet: 'font awesome', code: "\uf036" },
  "align-right": {iconSet: 'font awesome', code: "\uf038" },
  "anchor": {iconSet: 'font awesome', code: "\uf13d" },
  "anchor-circle-check": {iconSet: 'font awesome', code: "\ue4aa" },
  "anchor-circle-exclamation": {iconSet: 'font awesome', code: "\ue4ab" },
  "anchor-circle-xmark": {iconSet: 'font awesome', code: "\ue4ac" },
  "anchor-lock": {iconSet: 'font awesome', code: "\ue4ad" },
  "angle-down": {iconSet: 'font awesome', code: "\uf107" },
  "angle-left": {iconSet: 'font awesome', code: "\uf104" },
  "angle-right": {iconSet: 'font awesome', code: "\uf105" },
  "angle-up": {iconSet: 'font awesome', code: "\uf106" },
  "angles-down": {iconSet: 'font awesome', code: "\uf103" },
  "angle-double-down": {iconSet: 'font awesome', code: "\uf103" },
  "angles-left": {iconSet: 'font awesome', code: "\uf100" },
  "angle-double-left": {iconSet: 'font awesome', code: "\uf100" },
  "angles-right": {iconSet: 'font awesome', code: "\uf101" },
  "angle-double-right": {iconSet: 'font awesome', code: "\uf101" },
  "angles-up": {iconSet: 'font awesome', code: "\uf102" },
  "angle-double-up": {iconSet: 'font awesome', code: "\uf102" },
  "ankh": {iconSet: 'font awesome', code: "\uf644" },
  "apple-whole": {iconSet: 'font awesome', code: "\uf5d1" },
  "apple-alt": {iconSet: 'font awesome', code: "\uf5d1" },
  "archway": {iconSet: 'font awesome', code: "\uf557" },
  "arrow-down": {iconSet: 'font awesome', code: "\uf063" },
  "arrow-down-1-9": {iconSet: 'font awesome', code: "\uf162" },
  "sort-numeric-asc": {iconSet: 'font awesome', code: "\uf162" },
  "sort-numeric-down": {iconSet: 'font awesome', code: "\uf162" },
  "arrow-down-9-1": {iconSet: 'font awesome', code: "\uf886" },
  "sort-numeric-desc": {iconSet: 'font awesome', code: "\uf886" },
  "sort-numeric-down-alt": {iconSet: 'font awesome', code: "\uf886" },
  "arrow-down-a-z": {iconSet: 'font awesome', code: "\uf15d" },
  "sort-alpha-asc": {iconSet: 'font awesome', code: "\uf15d" },
  "sort-alpha-down": {iconSet: 'font awesome', code: "\uf15d" },
  "arrow-down-long": {iconSet: 'font awesome', code: "\uf175" },
  "long-arrow-down": {iconSet: 'font awesome', code: "\uf175" },
  "arrow-down-short-wide": {iconSet: 'font awesome', code: "\uf884" },
  "sort-amount-desc": {iconSet: 'font awesome', code: "\uf884" },
  "sort-amount-down-alt": {iconSet: 'font awesome', code: "\uf884" },
  "arrow-down-up-across-line": {iconSet: 'font awesome', code: "\ue4af" },
  "arrow-down-up-lock": {iconSet: 'font awesome', code: "\ue4b0" },
  "arrow-down-wide-short": {iconSet: 'font awesome', code: "\uf160" },
  "sort-amount-asc": {iconSet: 'font awesome', code: "\uf160" },
  "sort-amount-down": {iconSet: 'font awesome', code: "\uf160" },
  "arrow-down-z-a": {iconSet: 'font awesome', code: "\uf881" },
  "sort-alpha-desc": {iconSet: 'font awesome', code: "\uf881" },
  "sort-alpha-down-alt": {iconSet: 'font awesome', code: "\uf881" },
  "arrow-left": {iconSet: 'font awesome', code: "\uf060" },
  "arrow-left-long": {iconSet: 'font awesome', code: "\uf177" },
  "long-arrow-left": {iconSet: 'font awesome', code: "\uf177" },
  "arrow-pointer": {iconSet: 'font awesome', code: "\uf245" },
  "mouse-pointer": {iconSet: 'font awesome', code: "\uf245" },
  "arrow-right": {iconSet: 'font awesome', code: "\uf061" },
  "arrow-right-arrow-left": {iconSet: 'font awesome', code: "\uf0ec" },
  "exchange": {iconSet: 'font awesome', code: "\uf0ec" },
  "arrow-right-from-bracket": {iconSet: 'font awesome', code: "\uf08b" },
  "sign-out": {iconSet: 'font awesome', code: "\uf08b" },
  "arrow-right-long": {iconSet: 'font awesome', code: "\uf178" },
  "long-arrow-right": {iconSet: 'font awesome', code: "\uf178" },
  "arrow-right-to-bracket": {iconSet: 'font awesome', code: "\uf090" },
  "sign-in": {iconSet: 'font awesome', code: "\uf090" },
  "arrow-right-to-city": {iconSet: 'font awesome', code: "\ue4b3" },
  "arrow-rotate-left": {iconSet: 'font awesome', code: "\uf0e2" },
  "arrow-left-rotate": {iconSet: 'font awesome', code: "\uf0e2" },
  "arrow-rotate-back": {iconSet: 'font awesome', code: "\uf0e2" },
  "arrow-rotate-backward": {iconSet: 'font awesome', code: "\uf0e2" },
  "undo": {iconSet: 'font awesome', code: "\uf0e2" },
  "arrow-rotate-right": {iconSet: 'font awesome', code: "\uf01e" },
  "arrow-right-rotate": {iconSet: 'font awesome', code: "\uf01e" },
  "arrow-rotate-forward": {iconSet: 'font awesome', code: "\uf01e" },
  "redo": {iconSet: 'font awesome', code: "\uf01e" },
  "arrow-trend-down": {iconSet: 'font awesome', code: "\ue097" },
  "arrow-trend-up": {iconSet: 'font awesome', code: "\ue098" },
  "arrow-turn-down": {iconSet: 'font awesome', code: "\uf149" },
  "level-down": {iconSet: 'font awesome', code: "\uf149" },
  "arrow-turn-up": {iconSet: 'font awesome', code: "\uf148" },
  "level-up": {iconSet: 'font awesome', code: "\uf148" },
  "arrow-up": {iconSet: 'font awesome', code: "\uf062" },
  "arrow-up-1-9": {iconSet: 'font awesome', code: "\uf163" },
  "sort-numeric-up": {iconSet: 'font awesome', code: "\uf163" },
  "arrow-up-9-1": {iconSet: 'font awesome', code: "\uf887" },
  "sort-numeric-up-alt": {iconSet: 'font awesome', code: "\uf887" },
  "arrow-up-a-z": {iconSet: 'font awesome', code: "\uf15e" },
  "sort-alpha-up": {iconSet: 'font awesome', code: "\uf15e" },
  "arrow-up-from-bracket": {iconSet: 'font awesome', code: "\ue09a" },
  "arrow-up-from-ground-water": {iconSet: 'font awesome', code: "\ue4b5" },
  "arrow-up-from-water-pump": {iconSet: 'font awesome', code: "\ue4b6" },
  "arrow-up-long": {iconSet: 'font awesome', code: "\uf176" },
  "long-arrow-up": {iconSet: 'font awesome', code: "\uf176" },
  "arrow-up-right-dots": {iconSet: 'font awesome', code: "\ue4b7" },
  "arrow-up-right-from-square": {iconSet: 'font awesome', code: "\uf08e" },
  "external-link": {iconSet: 'font awesome', code: "\uf08e" },
  "arrow-up-short-wide": {iconSet: 'font awesome', code: "\uf885" },
  "sort-amount-up-alt": {iconSet: 'font awesome', code: "\uf885" },
  "arrow-up-wide-short": {iconSet: 'font awesome', code: "\uf161" },
  "sort-amount-up": {iconSet: 'font awesome', code: "\uf161" },
  "arrow-up-z-a": {iconSet: 'font awesome', code: "\uf882" },
  "sort-alpha-up-alt": {iconSet: 'font awesome', code: "\uf882" },
  "arrows-down-to-line": {iconSet: 'font awesome', code: "\ue4b8" },
  "arrows-down-to-people": {iconSet: 'font awesome', code: "\ue4b9" },
  "arrows-left-right": {iconSet: 'font awesome', code: "\uf07e" },
  "arrows-h": {iconSet: 'font awesome', code: "\uf07e" },
  "arrows-left-right-to-line": {iconSet: 'font awesome', code: "\ue4ba" },
  "arrows-rotate": {iconSet: 'font awesome', code: "\uf021" },
  "refresh": {iconSet: 'font awesome', code: "\uf021" },
  "sync": {iconSet: 'font awesome', code: "\uf021" },
  "arrows-spin": {iconSet: 'font awesome', code: "\ue4bb" },
  "arrows-split-up-and-left": {iconSet: 'font awesome', code: "\ue4bc" },
  "arrows-to-circle": {iconSet: 'font awesome', code: "\ue4bd" },
  "arrows-to-dot": {iconSet: 'font awesome', code: "\ue4be" },
  "arrows-to-eye": {iconSet: 'font awesome', code: "\ue4bf" },
  "arrows-turn-right": {iconSet: 'font awesome', code: "\ue4c0" },
  "arrows-turn-to-dots": {iconSet: 'font awesome', code: "\ue4c1" },
  "arrows-up-down": {iconSet: 'font awesome', code: "\uf07d" },
  "arrows-v": {iconSet: 'font awesome', code: "\uf07d" },
  "arrows-up-down-left-right": {iconSet: 'font awesome', code: "\uf047" },
  "arrows": {iconSet: 'font awesome', code: "\uf047" },
  "arrows-up-to-line": {iconSet: 'font awesome', code: "\ue4c2" },
  "asterisk": {iconSet: 'font awesome', code: "\u002a" },
  "at": {iconSet: 'font awesome', code: "\u0040" },
  "atom": {iconSet: 'font awesome', code: "\uf5d2" },
  "audio-description": {iconSet: 'font awesome', code: "\uf29e" },
  "austral-sign": {iconSet: 'font awesome', code: "\ue0a9" },
  "award": {iconSet: 'font awesome', code: "\uf559" },
  "b": {iconSet: 'font awesome', code: "\u0042" },
  "baby": {iconSet: 'font awesome', code: "\uf77c" },
  "baby-carriage": {iconSet: 'font awesome', code: "\uf77d" },
  "carriage-baby": {iconSet: 'font awesome', code: "\uf77d" },
  "backward": {iconSet: 'font awesome', code: "\uf04a" },
  "backward-fast": {iconSet: 'font awesome', code: "\uf049" },
  "fast-backward": {iconSet: 'font awesome', code: "\uf049" },
  "backward-step": {iconSet: 'font awesome', code: "\uf048" },
  "step-backward": {iconSet: 'font awesome', code: "\uf048" },
  "bacon": {iconSet: 'font awesome', code: "\uf7e5" },
  "bacteria": {iconSet: 'font awesome', code: "\ue059" },
  "bacterium": {iconSet: 'font awesome', code: "\ue05a" },
  "bag-shopping": {iconSet: 'font awesome', code: "\uf290" },
  "shopping-bag": {iconSet: 'font awesome', code: "\uf290" },
  "bahai": {iconSet: 'font awesome', code: "\uf666" },
  "baht-sign": {iconSet: 'font awesome', code: "\ue0ac" },
  "ban": {iconSet: 'font awesome', code: "\uf05e" },
  "cancel": {iconSet: 'font awesome', code: "\uf05e" },
  "ban-smoking": {iconSet: 'font awesome', code: "\uf54d" },
  "smoking-ban": {iconSet: 'font awesome', code: "\uf54d" },
  "bandage": {iconSet: 'font awesome', code: "\uf462" },
  "band-aid": {iconSet: 'font awesome', code: "\uf462" },
  "barcode": {iconSet: 'font awesome', code: "\uf02a" },
  "bars": {iconSet: 'font awesome', code: "\uf0c9" },
  "navicon": {iconSet: 'font awesome', code: "\uf0c9" },
  "bars-progress": {iconSet: 'font awesome', code: "\uf828" },
  "tasks-alt": {iconSet: 'font awesome', code: "\uf828" },
  "bars-staggered": {iconSet: 'font awesome', code: "\uf550" },
  "reorder": {iconSet: 'font awesome', code: "\uf550" },
  "stream": {iconSet: 'font awesome', code: "\uf550" },
  "baseball": {iconSet: 'font awesome', code: "\uf433" },
  "baseball-ball": {iconSet: 'font awesome', code: "\uf433" },
  "baseball-bat-ball": {iconSet: 'font awesome', code: "\uf432" },
  "basket-shopping": {iconSet: 'font awesome', code: "\uf291" },
  "shopping-basket": {iconSet: 'font awesome', code: "\uf291" },
  "basketball": {iconSet: 'font awesome', code: "\uf434" },
  "basketball-ball": {iconSet: 'font awesome', code: "\uf434" },
  "bath": {iconSet: 'font awesome', code: "\uf2cd" },
  "bathtub": {iconSet: 'font awesome', code: "\uf2cd" },
  "battery-empty": {iconSet: 'font awesome', code: "\uf244" },
  "battery-0": {iconSet: 'font awesome', code: "\uf244" },
  "battery-full": {iconSet: 'font awesome', code: "\uf240" },
  "battery": {iconSet: 'font awesome', code: "\uf240" },
  "battery-5": {iconSet: 'font awesome', code: "\uf240" },
  "battery-half": {iconSet: 'font awesome', code: "\uf242" },
  "battery-3": {iconSet: 'font awesome', code: "\uf242" },
  "battery-quarter": {iconSet: 'font awesome', code: "\uf243" },
  "battery-2": {iconSet: 'font awesome', code: "\uf243" },
  "battery-three-quarters": {iconSet: 'font awesome', code: "\uf241" },
  "battery-4": {iconSet: 'font awesome', code: "\uf241" },
  "bed": {iconSet: 'font awesome', code: "\uf236" },
  "bed-pulse": {iconSet: 'font awesome', code: "\uf487" },
  "procedures": {iconSet: 'font awesome', code: "\uf487" },
  "beer-mug-empty": {iconSet: 'font awesome', code: "\uf0fc" },
  "beer": {iconSet: 'font awesome', code: "\uf0fc" },
  "bell": {iconSet: 'font awesome', code: "\uf0f3" },
  "bell-concierge": {iconSet: 'font awesome', code: "\uf562" },
  "concierge-bell": {iconSet: 'font awesome', code: "\uf562" },
  "bell-slash": {iconSet: 'font awesome', code: "\uf1f6" },
  "bezier-curve": {iconSet: 'font awesome', code: "\uf55b" },
  "bicycle": {iconSet: 'font awesome', code: "\uf206" },
  "binoculars": {iconSet: 'font awesome', code: "\uf1e5" },
  "biohazard": {iconSet: 'font awesome', code: "\uf780" },
  "bitcoin-sign": {iconSet: 'font awesome', code: "\ue0b4" },
  "blender": {iconSet: 'font awesome', code: "\uf517" },
  "blender-phone": {iconSet: 'font awesome', code: "\uf6b6" },
  "blog": {iconSet: 'font awesome', code: "\uf781" },
  "bold": {iconSet: 'font awesome', code: "\uf032" },
  "bolt": {iconSet: 'font awesome', code: "\uf0e7" },
  "zap": {iconSet: 'font awesome', code: "\uf0e7" },
  "bolt-lightning": {iconSet: 'font awesome', code: "\ue0b7" },
  "bomb": {iconSet: 'font awesome', code: "\uf1e2" },
  "bone": {iconSet: 'font awesome', code: "\uf5d7" },
  "bong": {iconSet: 'font awesome', code: "\uf55c" },
  "book": {iconSet: 'font awesome', code: "\uf02d" },
  "book-atlas": {iconSet: 'font awesome', code: "\uf558" },
  "atlas": {iconSet: 'font awesome', code: "\uf558" },
  "book-bible": {iconSet: 'font awesome', code: "\uf647" },
  "bible": {iconSet: 'font awesome', code: "\uf647" },
  "book-bookmark": {iconSet: 'font awesome', code: "\ue0bb" },
  "book-journal-whills": {iconSet: 'font awesome', code: "\uf66a" },
  "journal-whills": {iconSet: 'font awesome', code: "\uf66a" },
  "book-medical": {iconSet: 'font awesome', code: "\uf7e6" },
  "book-open": {iconSet: 'font awesome', code: "\uf518" },
  "book-open-reader": {iconSet: 'font awesome', code: "\uf5da" },
  "book-reader": {iconSet: 'font awesome', code: "\uf5da" },
  "book-quran": {iconSet: 'font awesome', code: "\uf687" },
  "quran": {iconSet: 'font awesome', code: "\uf687" },
  "book-skull": {iconSet: 'font awesome', code: "\uf6b7" },
  "book-dead": {iconSet: 'font awesome', code: "\uf6b7" },
  "bookmark": {iconSet: 'font awesome', code: "\uf02e" },
  "border-all": {iconSet: 'font awesome', code: "\uf84c" },
  "border-none": {iconSet: 'font awesome', code: "\uf850" },
  "border-top-left": {iconSet: 'font awesome', code: "\uf853" },
  "border-style": {iconSet: 'font awesome', code: "\uf853" },
  "bore-hole": {iconSet: 'font awesome', code: "\ue4c3" },
  "bottle-droplet": {iconSet: 'font awesome', code: "\ue4c4" },
  "bottle-water": {iconSet: 'font awesome', code: "\ue4c5" },
  "bowl-food": {iconSet: 'font awesome', code: "\ue4c6" },
  "bowl-rice": {iconSet: 'font awesome', code: "\ue2eb" },
  "bowling-ball": {iconSet: 'font awesome', code: "\uf436" },
  "box": {iconSet: 'font awesome', code: "\uf466" },
  "box-archive": {iconSet: 'font awesome', code: "\uf187" },
  "archive": {iconSet: 'font awesome', code: "\uf187" },
  "box-open": {iconSet: 'font awesome', code: "\uf49e" },
  "box-tissue": {iconSet: 'font awesome', code: "\ue05b" },
  "boxes-packing": {iconSet: 'font awesome', code: "\ue4c7" },
  "boxes-stacked": {iconSet: 'font awesome', code: "\uf468" },
  "boxes": {iconSet: 'font awesome', code: "\uf468" },
  "boxes-alt": {iconSet: 'font awesome', code: "\uf468" },
  "braille": {iconSet: 'font awesome', code: "\uf2a1" },
  "brain": {iconSet: 'font awesome', code: "\uf5dc" },
  "brazilian-real-sign": {iconSet: 'font awesome', code: "\ue46c" },
  "bread-slice": {iconSet: 'font awesome', code: "\uf7ec" },
  "bridge": {iconSet: 'font awesome', code: "\ue4c8" },
  "bridge-circle-check": {iconSet: 'font awesome', code: "\ue4c9" },
  "bridge-circle-exclamation": {iconSet: 'font awesome', code: "\ue4ca" },
  "bridge-circle-xmark": {iconSet: 'font awesome', code: "\ue4cb" },
  "bridge-lock": {iconSet: 'font awesome', code: "\ue4cc" },
  "bridge-water": {iconSet: 'font awesome', code: "\ue4ce" },
  "briefcase": {iconSet: 'font awesome', code: "\uf0b1" },
  "briefcase-medical": {iconSet: 'font awesome', code: "\uf469" },
  "broom": {iconSet: 'font awesome', code: "\uf51a" },
  "broom-ball": {iconSet: 'font awesome', code: "\uf458" },
  "quidditch": {iconSet: 'font awesome', code: "\uf458" },
  "quidditch-broom-ball": {iconSet: 'font awesome', code: "\uf458" },
  "brush": {iconSet: 'font awesome', code: "\uf55d" },
  "bucket": {iconSet: 'font awesome', code: "\ue4cf" },
  "bug": {iconSet: 'font awesome', code: "\uf188" },
  "bug-slash": {iconSet: 'font awesome', code: "\ue490" },
  "bugs": {iconSet: 'font awesome', code: "\ue4d0" },
  "building": {iconSet: 'font awesome', code: "\uf1ad" },
  "building-circle-arrow-right": {iconSet: 'font awesome', code: "\ue4d1" },
  "building-circle-check": {iconSet: 'font awesome', code: "\ue4d2" },
  "building-circle-exclamation": {iconSet: 'font awesome', code: "\ue4d3" },
  "building-circle-xmark": {iconSet: 'font awesome', code: "\ue4d4" },
  "building-columns": {iconSet: 'font awesome', code: "\uf19c" },
  "bank": {iconSet: 'font awesome', code: "\uf19c" },
  "institution": {iconSet: 'font awesome', code: "\uf19c" },
  "museum": {iconSet: 'font awesome', code: "\uf19c" },
  "university": {iconSet: 'font awesome', code: "\uf19c" },
  "building-flag": {iconSet: 'font awesome', code: "\ue4d5" },
  "building-lock": {iconSet: 'font awesome', code: "\ue4d6" },
  "building-ngo": {iconSet: 'font awesome', code: "\ue4d7" },
  "building-shield": {iconSet: 'font awesome', code: "\ue4d8" },
  "building-un": {iconSet: 'font awesome', code: "\ue4d9" },
  "building-user": {iconSet: 'font awesome', code: "\ue4da" },
  "building-wheat": {iconSet: 'font awesome', code: "\ue4db" },
  "bullhorn": {iconSet: 'font awesome', code: "\uf0a1" },
  "bullseye": {iconSet: 'font awesome', code: "\uf140" },
  "burger": {iconSet: 'font awesome', code: "\uf805" },
  "hamburger": {iconSet: 'font awesome', code: "\uf805" },
  "burst": {iconSet: 'font awesome', code: "\ue4dc" },
  "bus": {iconSet: 'font awesome', code: "\uf207" },
  "bus-simple": {iconSet: 'font awesome', code: "\uf55e" },
  "bus-alt": {iconSet: 'font awesome', code: "\uf55e" },
  "business-time": {iconSet: 'font awesome', code: "\uf64a" },
  "briefcase-clock": {iconSet: 'font awesome', code: "\uf64a" },
  "c": {iconSet: 'font awesome', code: "\u0043" },
  "cake-candles": {iconSet: 'font awesome', code: "\uf1fd" },
  "birthday-cake": {iconSet: 'font awesome', code: "\uf1fd" },
  "cake": {iconSet: 'font awesome', code: "\uf1fd" },
  "calculator": {iconSet: 'font awesome', code: "\uf1ec" },
  "calendar": {iconSet: 'font awesome', code: "\uf133" },
  "calendar-check": {iconSet: 'font awesome', code: "\uf274" },
  "calendar-day": {iconSet: 'font awesome', code: "\uf783" },
  "calendar-days": {iconSet: 'font awesome', code: "\uf073" },
  "calendar-alt": {iconSet: 'font awesome', code: "\uf073" },
  "calendar-minus": {iconSet: 'font awesome', code: "\uf272" },
  "calendar-plus": {iconSet: 'font awesome', code: "\uf271" },
  "calendar-week": {iconSet: 'font awesome', code: "\uf784" },
  "calendar-xmark": {iconSet: 'font awesome', code: "\uf273" },
  "calendar-times": {iconSet: 'font awesome', code: "\uf273" },
  "camera": {iconSet: 'font awesome', code: "\uf030" },
  "camera-alt": {iconSet: 'font awesome', code: "\uf030" },
  "camera-retro": {iconSet: 'font awesome', code: "\uf083" },
  "camera-rotate": {iconSet: 'font awesome', code: "\ue0d8" },
  "campground": {iconSet: 'font awesome', code: "\uf6bb" },
  "candy-cane": {iconSet: 'font awesome', code: "\uf786" },
  "cannabis": {iconSet: 'font awesome', code: "\uf55f" },
  "capsules": {iconSet: 'font awesome', code: "\uf46b" },
  "car": {iconSet: 'font awesome', code: "\uf1b9" },
  "automobile": {iconSet: 'font awesome', code: "\uf1b9" },
  "car-battery": {iconSet: 'font awesome', code: "\uf5df" },
  "battery-car": {iconSet: 'font awesome', code: "\uf5df" },
  "car-burst": {iconSet: 'font awesome', code: "\uf5e1" },
  "car-crash": {iconSet: 'font awesome', code: "\uf5e1" },
  "car-on": {iconSet: 'font awesome', code: "\ue4dd" },
  "car-rear": {iconSet: 'font awesome', code: "\uf5de" },
  "car-alt": {iconSet: 'font awesome', code: "\uf5de" },
  "car-side": {iconSet: 'font awesome', code: "\uf5e4" },
  "car-tunnel": {iconSet: 'font awesome', code: "\ue4de" },
  "caravan": {iconSet: 'font awesome', code: "\uf8ff" },
  "caret-down": {iconSet: 'font awesome', code: "\uf0d7" },
  "caret-left": {iconSet: 'font awesome', code: "\uf0d9" },
  "caret-right": {iconSet: 'font awesome', code: "\uf0da" },
  "caret-up": {iconSet: 'font awesome', code: "\uf0d8" },
  "carrot": {iconSet: 'font awesome', code: "\uf787" },
  "cart-arrow-down": {iconSet: 'font awesome', code: "\uf218" },
  "cart-flatbed": {iconSet: 'font awesome', code: "\uf474" },
  "dolly-flatbed": {iconSet: 'font awesome', code: "\uf474" },
  "cart-flatbed-suitcase": {iconSet: 'font awesome', code: "\uf59d" },
  "luggage-cart": {iconSet: 'font awesome', code: "\uf59d" },
  "cart-plus": {iconSet: 'font awesome', code: "\uf217" },
  "cart-shopping": {iconSet: 'font awesome', code: "\uf07a" },
  "shopping-cart": {iconSet: 'font awesome', code: "\uf07a" },
  "cash-register": {iconSet: 'font awesome', code: "\uf788" },
  "cat": {iconSet: 'font awesome', code: "\uf6be" },
  "cedi-sign": {iconSet: 'font awesome', code: "\ue0df" },
  "cent-sign": {iconSet: 'font awesome', code: "\ue3f5" },
  "certificate": {iconSet: 'font awesome', code: "\uf0a3" },
  "chair": {iconSet: 'font awesome', code: "\uf6c0" },
  "chalkboard": {iconSet: 'font awesome', code: "\uf51b" },
  "blackboard": {iconSet: 'font awesome', code: "\uf51b" },
  "chalkboard-user": {iconSet: 'font awesome', code: "\uf51c" },
  "chalkboard-teacher": {iconSet: 'font awesome', code: "\uf51c" },
  "champagne-glasses": {iconSet: 'font awesome', code: "\uf79f" },
  "glass-cheers": {iconSet: 'font awesome', code: "\uf79f" },
  "charging-station": {iconSet: 'font awesome', code: "\uf5e7" },
  "chart-area": {iconSet: 'font awesome', code: "\uf1fe" },
  "area-chart": {iconSet: 'font awesome', code: "\uf1fe" },
  "chart-bar": {iconSet: 'font awesome', code: "\uf080" },
  "bar-chart": {iconSet: 'font awesome', code: "\uf080" },
  "chart-column": {iconSet: 'font awesome', code: "\ue0e3" },
  "chart-gantt": {iconSet: 'font awesome', code: "\ue0e4" },
  "chart-line": {iconSet: 'font awesome', code: "\uf201" },
  "line-chart": {iconSet: 'font awesome', code: "\uf201" },
  "chart-pie": {iconSet: 'font awesome', code: "\uf200" },
  "pie-chart": {iconSet: 'font awesome', code: "\uf200" },
  "chart-simple": {iconSet: 'font awesome', code: "\ue473" },
  "check": {iconSet: 'font awesome', code: "\uf00c" },
  "check-double": {iconSet: 'font awesome', code: "\uf560" },
  "check-to-slot": {iconSet: 'font awesome', code: "\uf772" },
  "vote-yea": {iconSet: 'font awesome', code: "\uf772" },
  "cheese": {iconSet: 'font awesome', code: "\uf7ef" },
  "chess": {iconSet: 'font awesome', code: "\uf439" },
  "chess-bishop": {iconSet: 'font awesome', code: "\uf43a" },
  "chess-board": {iconSet: 'font awesome', code: "\uf43c" },
  "chess-king": {iconSet: 'font awesome', code: "\uf43f" },
  "chess-knight": {iconSet: 'font awesome', code: "\uf441" },
  "chess-pawn": {iconSet: 'font awesome', code: "\uf443" },
  "chess-queen": {iconSet: 'font awesome', code: "\uf445" },
  "chess-rook": {iconSet: 'font awesome', code: "\uf447" },
  "chevron-down": {iconSet: 'font awesome', code: "\uf078" },
  "chevron-left": {iconSet: 'font awesome', code: "\uf053" },
  "chevron-right": {iconSet: 'font awesome', code: "\uf054" },
  "chevron-up": {iconSet: 'font awesome', code: "\uf077" },
  "child": {iconSet: 'font awesome', code: "\uf1ae" },
  "child-dress": {iconSet: 'font awesome', code: "\ue59c" },
  "child-reaching": {iconSet: 'font awesome', code: "\ue59d" },
  "child-rifle": {iconSet: 'font awesome', code: "\ue4e0" },
  "children": {iconSet: 'font awesome', code: "\ue4e1" },
  "church": {iconSet: 'font awesome', code: "\uf51d" },
  "circle": {iconSet: 'font awesome', code: "\uf111" },
  "circle-arrow-down": {iconSet: 'font awesome', code: "\uf0ab" },
  "arrow-circle-down": {iconSet: 'font awesome', code: "\uf0ab" },
  "circle-arrow-left": {iconSet: 'font awesome', code: "\uf0a8" },
  "arrow-circle-left": {iconSet: 'font awesome', code: "\uf0a8" },
  "circle-arrow-right": {iconSet: 'font awesome', code: "\uf0a9" },
  "arrow-circle-right": {iconSet: 'font awesome', code: "\uf0a9" },
  "circle-arrow-up": {iconSet: 'font awesome', code: "\uf0aa" },
  "arrow-circle-up": {iconSet: 'font awesome', code: "\uf0aa" },
  "circle-check": {iconSet: 'font awesome', code: "\uf058" },
  "check-circle": {iconSet: 'font awesome', code: "\uf058" },
  "circle-chevron-down": {iconSet: 'font awesome', code: "\uf13a" },
  "chevron-circle-down": {iconSet: 'font awesome', code: "\uf13a" },
  "circle-chevron-left": {iconSet: 'font awesome', code: "\uf137" },
  "chevron-circle-left": {iconSet: 'font awesome', code: "\uf137" },
  "circle-chevron-right": {iconSet: 'font awesome', code: "\uf138" },
  "chevron-circle-right": {iconSet: 'font awesome', code: "\uf138" },
  "circle-chevron-up": {iconSet: 'font awesome', code: "\uf139" },
  "chevron-circle-up": {iconSet: 'font awesome', code: "\uf139" },
  "circle-dollar-to-slot": {iconSet: 'font awesome', code: "\uf4b9" },
  "donate": {iconSet: 'font awesome', code: "\uf4b9" },
  "circle-dot": {iconSet: 'font awesome', code: "\uf192" },
  "dot-circle": {iconSet: 'font awesome', code: "\uf192" },
  "circle-down": {iconSet: 'font awesome', code: "\uf358" },
  "arrow-alt-circle-down": {iconSet: 'font awesome', code: "\uf358" },
  "circle-exclamation": {iconSet: 'font awesome', code: "\uf06a" },
  "exclamation-circle": {iconSet: 'font awesome', code: "\uf06a" },
  "circle-h": {iconSet: 'font awesome', code: "\uf47e" },
  "hospital-symbol": {iconSet: 'font awesome', code: "\uf47e" },
  "circle-half-stroke": {iconSet: 'font awesome', code: "\uf042" },
  "adjust": {iconSet: 'font awesome', code: "\uf042" },
  "circle-info": {iconSet: 'font awesome', code: "\uf05a" },
  "info-circle": {iconSet: 'font awesome', code: "\uf05a" },
  "circle-left": {iconSet: 'font awesome', code: "\uf359" },
  "arrow-alt-circle-left": {iconSet: 'font awesome', code: "\uf359" },
  "circle-minus": {iconSet: 'font awesome', code: "\uf056" },
  "minus-circle": {iconSet: 'font awesome', code: "\uf056" },
  "circle-nodes": {iconSet: 'font awesome', code: "\ue4e2" },
  "circle-notch": {iconSet: 'font awesome', code: "\uf1ce" },
  "circle-pause": {iconSet: 'font awesome', code: "\uf28b" },
  "pause-circle": {iconSet: 'font awesome', code: "\uf28b" },
  "circle-play": {iconSet: 'font awesome', code: "\uf144" },
  "play-circle": {iconSet: 'font awesome', code: "\uf144" },
  "circle-plus": {iconSet: 'font awesome', code: "\uf055" },
  "plus-circle": {iconSet: 'font awesome', code: "\uf055" },
  "circle-question": {iconSet: 'font awesome', code: "\uf059" },
  "question-circle": {iconSet: 'font awesome', code: "\uf059" },
  "circle-radiation": {iconSet: 'font awesome', code: "\uf7ba" },
  "radiation-alt": {iconSet: 'font awesome', code: "\uf7ba" },
  "circle-right": {iconSet: 'font awesome', code: "\uf35a" },
  "arrow-alt-circle-right": {iconSet: 'font awesome', code: "\uf35a" },
  "circle-stop": {iconSet: 'font awesome', code: "\uf28d" },
  "stop-circle": {iconSet: 'font awesome', code: "\uf28d" },
  "circle-up": {iconSet: 'font awesome', code: "\uf35b" },
  "arrow-alt-circle-up": {iconSet: 'font awesome', code: "\uf35b" },
  "circle-user": {iconSet: 'font awesome', code: "\uf2bd" },
  "user-circle": {iconSet: 'font awesome', code: "\uf2bd" },
  "circle-xmark": {iconSet: 'font awesome', code: "\uf057" },
  "times-circle": {iconSet: 'font awesome', code: "\uf057" },
  "xmark-circle": {iconSet: 'font awesome', code: "\uf057" },
  "city": {iconSet: 'font awesome', code: "\uf64f" },
  "clapperboard": {iconSet: 'font awesome', code: "\ue131" },
  "clipboard": {iconSet: 'font awesome', code: "\uf328" },
  "clipboard-check": {iconSet: 'font awesome', code: "\uf46c" },
  "clipboard-list": {iconSet: 'font awesome', code: "\uf46d" },
  "clipboard-question": {iconSet: 'font awesome', code: "\ue4e3" },
  "clipboard-user": {iconSet: 'font awesome', code: "\uf7f3" },
  "clock": {iconSet: 'font awesome', code: "\uf017" },
  "clock-four": {iconSet: 'font awesome', code: "\uf017" },
  "clock-rotate-left": {iconSet: 'font awesome', code: "\uf1da" },
  "history": {iconSet: 'font awesome', code: "\uf1da" },
  "clone": {iconSet: 'font awesome', code: "\uf24d" },
  "closed-captioning": {iconSet: 'font awesome', code: "\uf20a" },
  "cloud": {iconSet: 'font awesome', code: "\uf0c2" },
  "cloud-arrow-down": {iconSet: 'font awesome', code: "\uf0ed" },
  "cloud-download": {iconSet: 'font awesome', code: "\uf0ed" },
  "cloud-download-alt": {iconSet: 'font awesome', code: "\uf0ed" },
  "cloud-arrow-up": {iconSet: 'font awesome', code: "\uf0ee" },
  "cloud-upload": {iconSet: 'font awesome', code: "\uf0ee" },
  "cloud-upload-alt": {iconSet: 'font awesome', code: "\uf0ee" },
  "cloud-bolt": {iconSet: 'font awesome', code: "\uf76c" },
  "thunderstorm": {iconSet: 'font awesome', code: "\uf76c" },
  "cloud-meatball": {iconSet: 'font awesome', code: "\uf73b" },
  "cloud-moon": {iconSet: 'font awesome', code: "\uf6c3" },
  "cloud-moon-rain": {iconSet: 'font awesome', code: "\uf73c" },
  "cloud-rain": {iconSet: 'font awesome', code: "\uf73d" },
  "cloud-showers-heavy": {iconSet: 'font awesome', code: "\uf740" },
  "cloud-showers-water": {iconSet: 'font awesome', code: "\ue4e4" },
  "cloud-sun": {iconSet: 'font awesome', code: "\uf6c4" },
  "cloud-sun-rain": {iconSet: 'font awesome', code: "\uf743" },
  "clover": {iconSet: 'font awesome', code: "\ue139" },
  "code": {iconSet: 'font awesome', code: "\uf121" },
  "code-branch": {iconSet: 'font awesome', code: "\uf126" },
  "code-commit": {iconSet: 'font awesome', code: "\uf386" },
  "code-compare": {iconSet: 'font awesome', code: "\ue13a" },
  "code-fork": {iconSet: 'font awesome', code: "\ue13b" },
  "code-merge": {iconSet: 'font awesome', code: "\uf387" },
  "code-pull-request": {iconSet: 'font awesome', code: "\ue13c" },
  "coins": {iconSet: 'font awesome', code: "\uf51e" },
  "colon-sign": {iconSet: 'font awesome', code: "\ue140" },
  "comment": {iconSet: 'font awesome', code: "\uf075" },
  "comment-dollar": {iconSet: 'font awesome', code: "\uf651" },
  "comment-dots": {iconSet: 'font awesome', code: "\uf4ad" },
  "commenting": {iconSet: 'font awesome', code: "\uf4ad" },
  "comment-medical": {iconSet: 'font awesome', code: "\uf7f5" },
  "comment-slash": {iconSet: 'font awesome', code: "\uf4b3" },
  "comment-sms": {iconSet: 'font awesome', code: "\uf7cd" },
  "sms": {iconSet: 'font awesome', code: "\uf7cd" },
  "comments": {iconSet: 'font awesome', code: "\uf086" },
  "comments-dollar": {iconSet: 'font awesome', code: "\uf653" },
  "compact-disc": {iconSet: 'font awesome', code: "\uf51f" },
  "compass": {iconSet: 'font awesome', code: "\uf14e" },
  "compass-drafting": {iconSet: 'font awesome', code: "\uf568" },
  "drafting-compass": {iconSet: 'font awesome', code: "\uf568" },
  "compress": {iconSet: 'font awesome', code: "\uf066" },
  "computer": {iconSet: 'font awesome', code: "\ue4e5" },
  "computer-mouse": {iconSet: 'font awesome', code: "\uf8cc" },
  "mouse": {iconSet: 'font awesome', code: "\uf8cc" },
  "cookie": {iconSet: 'font awesome', code: "\uf563" },
  "cookie-bite": {iconSet: 'font awesome', code: "\uf564" },
  "copy": {iconSet: 'font awesome', code: "\uf0c5" },
  "copyright": {iconSet: 'font awesome', code: "\uf1f9" },
  "couch": {iconSet: 'font awesome', code: "\uf4b8" },
  "cow": {iconSet: 'font awesome', code: "\uf6c8" },
  "credit-card": {iconSet: 'font awesome', code: "\uf09d" },
  "credit-card-alt": {iconSet: 'font awesome', code: "\uf09d" },
  "crop": {iconSet: 'font awesome', code: "\uf125" },
  "crop-simple": {iconSet: 'font awesome', code: "\uf565" },
  "crop-alt": {iconSet: 'font awesome', code: "\uf565" },
  "cross": {iconSet: 'font awesome', code: "\uf654" },
  "crosshairs": {iconSet: 'font awesome', code: "\uf05b" },
  "crow": {iconSet: 'font awesome', code: "\uf520" },
  "crown": {iconSet: 'font awesome', code: "\uf521" },
  "crutch": {iconSet: 'font awesome', code: "\uf7f7" },
  "cruzeiro-sign": {iconSet: 'font awesome', code: "\ue152" },
  "cube": {iconSet: 'font awesome', code: "\uf1b2" },
  "cubes": {iconSet: 'font awesome', code: "\uf1b3" },
  "cubes-stacked": {iconSet: 'font awesome', code: "\ue4e6" },
  "d": {iconSet: 'font awesome', code: "\u0044" },
  "database": {iconSet: 'font awesome', code: "\uf1c0" },
  "delete-left": {iconSet: 'font awesome', code: "\uf55a" },
  "backspace": {iconSet: 'font awesome', code: "\uf55a" },
  "democrat": {iconSet: 'font awesome', code: "\uf747" },
  "desktop": {iconSet: 'font awesome', code: "\uf390" },
  "desktop-alt": {iconSet: 'font awesome', code: "\uf390" },
  "dharmachakra": {iconSet: 'font awesome', code: "\uf655" },
  "diagram-next": {iconSet: 'font awesome', code: "\ue476" },
  "diagram-predecessor": {iconSet: 'font awesome', code: "\ue477" },
  "diagram-project": {iconSet: 'font awesome', code: "\uf542" },
  "project-diagram": {iconSet: 'font awesome', code: "\uf542" },
  "diagram-successor": {iconSet: 'font awesome', code: "\ue47a" },
  "diamond": {iconSet: 'font awesome', code: "\uf219" },
  "diamond-turn-right": {iconSet: 'font awesome', code: "\uf5eb" },
  "directions": {iconSet: 'font awesome', code: "\uf5eb" },
  "dice": {iconSet: 'font awesome', code: "\uf522" },
  "dice-d20": {iconSet: 'font awesome', code: "\uf6cf" },
  "dice-d6": {iconSet: 'font awesome', code: "\uf6d1" },
  "dice-five": {iconSet: 'font awesome', code: "\uf523" },
  "dice-four": {iconSet: 'font awesome', code: "\uf524" },
  "dice-one": {iconSet: 'font awesome', code: "\uf525" },
  "dice-six": {iconSet: 'font awesome', code: "\uf526" },
  "dice-three": {iconSet: 'font awesome', code: "\uf527" },
  "dice-two": {iconSet: 'font awesome', code: "\uf528" },
  "disease": {iconSet: 'font awesome', code: "\uf7fa" },
  "display": {iconSet: 'font awesome', code: "\ue163" },
  "divide": {iconSet: 'font awesome', code: "\uf529" },
  "dna": {iconSet: 'font awesome', code: "\uf471" },
  "dog": {iconSet: 'font awesome', code: "\uf6d3" },
  "dollar-sign": {iconSet: 'font awesome', code: "\u0024" },
  "dollar": {iconSet: 'font awesome', code: "\u0024" },
  "usd": {iconSet: 'font awesome', code: "\u0024" },
  "dolly": {iconSet: 'font awesome', code: "\uf472" },
  "dolly-box": {iconSet: 'font awesome', code: "\uf472" },
  "dong-sign": {iconSet: 'font awesome', code: "\ue169" },
  "door-closed": {iconSet: 'font awesome', code: "\uf52a" },
  "door-open": {iconSet: 'font awesome', code: "\uf52b" },
  "dove": {iconSet: 'font awesome', code: "\uf4ba" },
  "down-left-and-up-right-to-center": {iconSet: 'font awesome', code: "\uf422" },
  "compress-alt": {iconSet: 'font awesome', code: "\uf422" },
  "down-long": {iconSet: 'font awesome', code: "\uf309" },
  "long-arrow-alt-down": {iconSet: 'font awesome', code: "\uf309" },
  "download": {iconSet: 'font awesome', code: "\uf019" },
  "dragon": {iconSet: 'font awesome', code: "\uf6d5" },
  "draw-polygon": {iconSet: 'font awesome', code: "\uf5ee" },
  "droplet": {iconSet: 'font awesome', code: "\uf043" },
  "tint": {iconSet: 'font awesome', code: "\uf043" },
  "droplet-slash": {iconSet: 'font awesome', code: "\uf5c7" },
  "tint-slash": {iconSet: 'font awesome', code: "\uf5c7" },
  "drum": {iconSet: 'font awesome', code: "\uf569" },
  "drum-steelpan": {iconSet: 'font awesome', code: "\uf56a" },
  "drumstick-bite": {iconSet: 'font awesome', code: "\uf6d7" },
  "dumbbell": {iconSet: 'font awesome', code: "\uf44b" },
  "dumpster": {iconSet: 'font awesome', code: "\uf793" },
  "dumpster-fire": {iconSet: 'font awesome', code: "\uf794" },
  "dungeon": {iconSet: 'font awesome', code: "\uf6d9" },
  "e": {iconSet: 'font awesome', code: "\u0045" },
  "ear-deaf": {iconSet: 'font awesome', code: "\uf2a4" },
  "deaf": {iconSet: 'font awesome', code: "\uf2a4" },
  "deafness": {iconSet: 'font awesome', code: "\uf2a4" },
  "hard-of-hearing": {iconSet: 'font awesome', code: "\uf2a4" },
  "ear-listen": {iconSet: 'font awesome', code: "\uf2a2" },
  "assistive-listening-systems": {iconSet: 'font awesome', code: "\uf2a2" },
  "earth-africa": {iconSet: 'font awesome', code: "\uf57c" },
  "globe-africa": {iconSet: 'font awesome', code: "\uf57c" },
  "earth-americas": {iconSet: 'font awesome', code: "\uf57d" },
  "earth": {iconSet: 'font awesome', code: "\uf57d" },
  "earth-america": {iconSet: 'font awesome', code: "\uf57d" },
  "globe-americas": {iconSet: 'font awesome', code: "\uf57d" },
  "earth-asia": {iconSet: 'font awesome', code: "\uf57e" },
  "globe-asia": {iconSet: 'font awesome', code: "\uf57e" },
  "earth-europe": {iconSet: 'font awesome', code: "\uf7a2" },
  "globe-europe": {iconSet: 'font awesome', code: "\uf7a2" },
  "earth-oceania": {iconSet: 'font awesome', code: "\ue47b" },
  "globe-oceania": {iconSet: 'font awesome', code: "\ue47b" },
  "egg": {iconSet: 'font awesome', code: "\uf7fb" },
  "eject": {iconSet: 'font awesome', code: "\uf052" },
  "elevator": {iconSet: 'font awesome', code: "\ue16d" },
  "ellipsis": {iconSet: 'font awesome', code: "\uf141" },
  "ellipsis-h": {iconSet: 'font awesome', code: "\uf141" },
  "ellipsis-vertical": {iconSet: 'font awesome', code: "\uf142" },
  "ellipsis-v": {iconSet: 'font awesome', code: "\uf142" },
  "envelope": {iconSet: 'font awesome', code: "\uf0e0" },
  "envelope-circle-check": {iconSet: 'font awesome', code: "\ue4e8" },
  "envelope-open": {iconSet: 'font awesome', code: "\uf2b6" },
  "envelope-open-text": {iconSet: 'font awesome', code: "\uf658" },
  "envelopes-bulk": {iconSet: 'font awesome', code: "\uf674" },
  "mail-bulk": {iconSet: 'font awesome', code: "\uf674" },
  "equals": {iconSet: 'font awesome', code: "\u003d" },
  "eraser": {iconSet: 'font awesome', code: "\uf12d" },
  "ethernet": {iconSet: 'font awesome', code: "\uf796" },
  "euro-sign": {iconSet: 'font awesome', code: "\uf153" },
  "eur": {iconSet: 'font awesome', code: "\uf153" },
  "euro": {iconSet: 'font awesome', code: "\uf153" },
  "exclamation": {iconSet: 'font awesome', code: "\u0021" },
  "expand": {iconSet: 'font awesome', code: "\uf065" },
  "explosion": {iconSet: 'font awesome', code: "\ue4e9" },
  "eye": {iconSet: 'font awesome', code: "\uf06e" },
  "eye-dropper": {iconSet: 'font awesome', code: "\uf1fb" },
  "eye-dropper-empty": {iconSet: 'font awesome', code: "\uf1fb" },
  "eyedropper": {iconSet: 'font awesome', code: "\uf1fb" },
  "eye-low-vision": {iconSet: 'font awesome', code: "\uf2a8" },
  "low-vision": {iconSet: 'font awesome', code: "\uf2a8" },
  "eye-slash": {iconSet: 'font awesome', code: "\uf070" },
  "f": {iconSet: 'font awesome', code: "\u0046" },
  "face-angry": {iconSet: 'font awesome', code: "\uf556" },
  "angry": {iconSet: 'font awesome', code: "\uf556" },
  "face-dizzy": {iconSet: 'font awesome', code: "\uf567" },
  "dizzy": {iconSet: 'font awesome', code: "\uf567" },
  "face-flushed": {iconSet: 'font awesome', code: "\uf579" },
  "flushed": {iconSet: 'font awesome', code: "\uf579" },
  "face-frown": {iconSet: 'font awesome', code: "\uf119" },
  "frown": {iconSet: 'font awesome', code: "\uf119" },
  "face-frown-open": {iconSet: 'font awesome', code: "\uf57a" },
  "frown-open": {iconSet: 'font awesome', code: "\uf57a" },
  "face-grimace": {iconSet: 'font awesome', code: "\uf57f" },
  "grimace": {iconSet: 'font awesome', code: "\uf57f" },
  "face-grin": {iconSet: 'font awesome', code: "\uf580" },
  "grin": {iconSet: 'font awesome', code: "\uf580" },
  "face-grin-beam": {iconSet: 'font awesome', code: "\uf582" },
  "grin-beam": {iconSet: 'font awesome', code: "\uf582" },
  "face-grin-beam-sweat": {iconSet: 'font awesome', code: "\uf583" },
  "grin-beam-sweat": {iconSet: 'font awesome', code: "\uf583" },
  "face-grin-hearts": {iconSet: 'font awesome', code: "\uf584" },
  "grin-hearts": {iconSet: 'font awesome', code: "\uf584" },
  "face-grin-squint": {iconSet: 'font awesome', code: "\uf585" },
  "grin-squint": {iconSet: 'font awesome', code: "\uf585" },
  "face-grin-squint-tears": {iconSet: 'font awesome', code: "\uf586" },
  "grin-squint-tears": {iconSet: 'font awesome', code: "\uf586" },
  "face-grin-stars": {iconSet: 'font awesome', code: "\uf587" },
  "grin-stars": {iconSet: 'font awesome', code: "\uf587" },
  "face-grin-tears": {iconSet: 'font awesome', code: "\uf588" },
  "grin-tears": {iconSet: 'font awesome', code: "\uf588" },
  "face-grin-tongue": {iconSet: 'font awesome', code: "\uf589" },
  "grin-tongue": {iconSet: 'font awesome', code: "\uf589" },
  "face-grin-tongue-squint": {iconSet: 'font awesome', code: "\uf58a" },
  "grin-tongue-squint": {iconSet: 'font awesome', code: "\uf58a" },
  "face-grin-tongue-wink": {iconSet: 'font awesome', code: "\uf58b" },
  "grin-tongue-wink": {iconSet: 'font awesome', code: "\uf58b" },
  "face-grin-wide": {iconSet: 'font awesome', code: "\uf581" },
  "grin-alt": {iconSet: 'font awesome', code: "\uf581" },
  "face-grin-wink": {iconSet: 'font awesome', code: "\uf58c" },
  "grin-wink": {iconSet: 'font awesome', code: "\uf58c" },
  "face-kiss": {iconSet: 'font awesome', code: "\uf596" },
  "kiss": {iconSet: 'font awesome', code: "\uf596" },
  "face-kiss-beam": {iconSet: 'font awesome', code: "\uf597" },
  "kiss-beam": {iconSet: 'font awesome', code: "\uf597" },
  "face-kiss-wink-heart": {iconSet: 'font awesome', code: "\uf598" },
  "kiss-wink-heart": {iconSet: 'font awesome', code: "\uf598" },
  "face-laugh": {iconSet: 'font awesome', code: "\uf599" },
  "laugh": {iconSet: 'font awesome', code: "\uf599" },
  "face-laugh-beam": {iconSet: 'font awesome', code: "\uf59a" },
  "laugh-beam": {iconSet: 'font awesome', code: "\uf59a" },
  "face-laugh-squint": {iconSet: 'font awesome', code: "\uf59b" },
  "laugh-squint": {iconSet: 'font awesome', code: "\uf59b" },
  "face-laugh-wink": {iconSet: 'font awesome', code: "\uf59c" },
  "laugh-wink": {iconSet: 'font awesome', code: "\uf59c" },
  "face-meh": {iconSet: 'font awesome', code: "\uf11a" },
  "meh": {iconSet: 'font awesome', code: "\uf11a" },
  "face-meh-blank": {iconSet: 'font awesome', code: "\uf5a4" },
  "meh-blank": {iconSet: 'font awesome', code: "\uf5a4" },
  "face-rolling-eyes": {iconSet: 'font awesome', code: "\uf5a5" },
  "meh-rolling-eyes": {iconSet: 'font awesome', code: "\uf5a5" },
  "face-sad-cry": {iconSet: 'font awesome', code: "\uf5b3" },
  "sad-cry": {iconSet: 'font awesome', code: "\uf5b3" },
  "face-sad-tear": {iconSet: 'font awesome', code: "\uf5b4" },
  "sad-tear": {iconSet: 'font awesome', code: "\uf5b4" },
  "face-smile": {iconSet: 'font awesome', code: "\uf118" },
  "smile": {iconSet: 'font awesome', code: "\uf118" },
  "face-smile-beam": {iconSet: 'font awesome', code: "\uf5b8" },
  "smile-beam": {iconSet: 'font awesome', code: "\uf5b8" },
  "face-smile-wink": {iconSet: 'font awesome', code: "\uf4da" },
  "smile-wink": {iconSet: 'font awesome', code: "\uf4da" },
  "face-surprise": {iconSet: 'font awesome', code: "\uf5c2" },
  "surprise": {iconSet: 'font awesome', code: "\uf5c2" },
  "face-tired": {iconSet: 'font awesome', code: "\uf5c8" },
  "tired": {iconSet: 'font awesome', code: "\uf5c8" },
  "fan": {iconSet: 'font awesome', code: "\uf863" },
  "faucet": {iconSet: 'font awesome', code: "\ue005" },
  "faucet-drip": {iconSet: 'font awesome', code: "\ue006" },
  "fax": {iconSet: 'font awesome', code: "\uf1ac" },
  "feather": {iconSet: 'font awesome', code: "\uf52d" },
  "feather-pointed": {iconSet: 'font awesome', code: "\uf56b" },
  "feather-alt": {iconSet: 'font awesome', code: "\uf56b" },
  "ferry": {iconSet: 'font awesome', code: "\ue4ea" },
  "file": {iconSet: 'font awesome', code: "\uf15b" },
  "file-arrow-down": {iconSet: 'font awesome', code: "\uf56d" },
  "file-download": {iconSet: 'font awesome', code: "\uf56d" },
  "file-arrow-up": {iconSet: 'font awesome', code: "\uf574" },
  "file-upload": {iconSet: 'font awesome', code: "\uf574" },
  "file-audio": {iconSet: 'font awesome', code: "\uf1c7" },
  "file-circle-check": {iconSet: 'font awesome', code: "\ue493" },
  "file-circle-exclamation": {iconSet: 'font awesome', code: "\ue4eb" },
  "file-circle-minus": {iconSet: 'font awesome', code: "\ue4ed" },
  "file-circle-plus": {iconSet: 'font awesome', code: "\ue4ee" },
  "file-circle-question": {iconSet: 'font awesome', code: "\ue4ef" },
  "file-circle-xmark": {iconSet: 'font awesome', code: "\ue494" },
  "file-code": {iconSet: 'font awesome', code: "\uf1c9" },
  "file-contract": {iconSet: 'font awesome', code: "\uf56c" },
  "file-csv": {iconSet: 'font awesome', code: "\uf6dd" },
  "file-excel": {iconSet: 'font awesome', code: "\uf1c3" },
  "file-export": {iconSet: 'font awesome', code: "\uf56e" },
  "arrow-right-from-file": {iconSet: 'font awesome', code: "\uf56e" },
  "file-image": {iconSet: 'font awesome', code: "\uf1c5" },
  "file-import": {iconSet: 'font awesome', code: "\uf56f" },
  "arrow-right-to-file": {iconSet: 'font awesome', code: "\uf56f" },
  "file-invoice": {iconSet: 'font awesome', code: "\uf570" },
  "file-invoice-dollar": {iconSet: 'font awesome', code: "\uf571" },
  "file-lines": {iconSet: 'font awesome', code: "\uf15c" },
  "file-alt": {iconSet: 'font awesome', code: "\uf15c" },
  "file-text": {iconSet: 'font awesome', code: "\uf15c" },
  "file-medical": {iconSet: 'font awesome', code: "\uf477" },
  "file-pdf": {iconSet: 'font awesome', code: "\uf1c1" },
  "file-pen": {iconSet: 'font awesome', code: "\uf31c" },
  "file-edit": {iconSet: 'font awesome', code: "\uf31c" },
  "file-powerpoint": {iconSet: 'font awesome', code: "\uf1c4" },
  "file-prescription": {iconSet: 'font awesome', code: "\uf572" },
  "file-shield": {iconSet: 'font awesome', code: "\ue4f0" },
  "file-signature": {iconSet: 'font awesome', code: "\uf573" },
  "file-video": {iconSet: 'font awesome', code: "\uf1c8" },
  "file-waveform": {iconSet: 'font awesome', code: "\uf478" },
  "file-medical-alt": {iconSet: 'font awesome', code: "\uf478" },
  "file-word": {iconSet: 'font awesome', code: "\uf1c2" },
  "file-zipper": {iconSet: 'font awesome', code: "\uf1c6" },
  "file-archive": {iconSet: 'font awesome', code: "\uf1c6" },
  "fill": {iconSet: 'font awesome', code: "\uf575" },
  "fill-drip": {iconSet: 'font awesome', code: "\uf576" },
  "film": {iconSet: 'font awesome', code: "\uf008" },
  "filter": {iconSet: 'font awesome', code: "\uf0b0" },
  "filter-circle-dollar": {iconSet: 'font awesome', code: "\uf662" },
  "funnel-dollar": {iconSet: 'font awesome', code: "\uf662" },
  "filter-circle-xmark": {iconSet: 'font awesome', code: "\ue17b" },
  "fingerprint": {iconSet: 'font awesome', code: "\uf577" },
  "fire": {iconSet: 'font awesome', code: "\uf06d" },
  "fire-burner": {iconSet: 'font awesome', code: "\ue4f1" },
  "fire-extinguisher": {iconSet: 'font awesome', code: "\uf134" },
  "fire-flame-curved": {iconSet: 'font awesome', code: "\uf7e4" },
  "fire-alt": {iconSet: 'font awesome', code: "\uf7e4" },
  "fire-flame-simple": {iconSet: 'font awesome', code: "\uf46a" },
  "burn": {iconSet: 'font awesome', code: "\uf46a" },
  "fish": {iconSet: 'font awesome', code: "\uf578" },
  "fish-fins": {iconSet: 'font awesome', code: "\ue4f2" },
  "flag": {iconSet: 'font awesome', code: "\uf024" },
  "flag-checkered": {iconSet: 'font awesome', code: "\uf11e" },
  "flag-usa": {iconSet: 'font awesome', code: "\uf74d" },
  "flask": {iconSet: 'font awesome', code: "\uf0c3" },
  "flask-vial": {iconSet: 'font awesome', code: "\ue4f3" },
  "floppy-disk": {iconSet: 'font awesome', code: "\uf0c7" },
  "save": {iconSet: 'font awesome', code: "\uf0c7" },
  "florin-sign": {iconSet: 'font awesome', code: "\ue184" },
  "folder": {iconSet: 'font awesome', code: "\uf07b" },
  "folder-blank": {iconSet: 'font awesome', code: "\uf07b" },
  "folder-closed": {iconSet: 'font awesome', code: "\ue185" },
  "folder-minus": {iconSet: 'font awesome', code: "\uf65d" },
  "folder-open": {iconSet: 'font awesome', code: "\uf07c" },
  "folder-plus": {iconSet: 'font awesome', code: "\uf65e" },
  "folder-tree": {iconSet: 'font awesome', code: "\uf802" },
  "font": {iconSet: 'font awesome', code: "\uf031" },
  "football": {iconSet: 'font awesome', code: "\uf44e" },
  "football-ball": {iconSet: 'font awesome', code: "\uf44e" },
  "forward": {iconSet: 'font awesome', code: "\uf04e" },
  "forward-fast": {iconSet: 'font awesome', code: "\uf050" },
  "fast-forward": {iconSet: 'font awesome', code: "\uf050" },
  "forward-step": {iconSet: 'font awesome', code: "\uf051" },
  "step-forward": {iconSet: 'font awesome', code: "\uf051" },
  "franc-sign": {iconSet: 'font awesome', code: "\ue18f" },
  "frog": {iconSet: 'font awesome', code: "\uf52e" },
  "futbol": {iconSet: 'font awesome', code: "\uf1e3" },
  "futbol-ball": {iconSet: 'font awesome', code: "\uf1e3" },
  "soccer-ball": {iconSet: 'font awesome', code: "\uf1e3" },
  "g": {iconSet: 'font awesome', code: "\u0047" },
  "gamepad": {iconSet: 'font awesome', code: "\uf11b" },
  "gas-pump": {iconSet: 'font awesome', code: "\uf52f" },
  "gauge": {iconSet: 'font awesome', code: "\uf624" },
  "dashboard": {iconSet: 'font awesome', code: "\uf624" },
  "gauge-med": {iconSet: 'font awesome', code: "\uf624" },
  "tachometer-alt-average": {iconSet: 'font awesome', code: "\uf624" },
  "gauge-high": {iconSet: 'font awesome', code: "\uf625" },
  "tachometer-alt": {iconSet: 'font awesome', code: "\uf625" },
  "tachometer-alt-fast": {iconSet: 'font awesome', code: "\uf625" },
  "gauge-simple": {iconSet: 'font awesome', code: "\uf629" },
  "gauge-simple-med": {iconSet: 'font awesome', code: "\uf629" },
  "tachometer-average": {iconSet: 'font awesome', code: "\uf629" },
  "gauge-simple-high": {iconSet: 'font awesome', code: "\uf62a" },
  "tachometer": {iconSet: 'font awesome', code: "\uf62a" },
  "tachometer-fast": {iconSet: 'font awesome', code: "\uf62a" },
  "gavel": {iconSet: 'font awesome', code: "\uf0e3" },
  "legal": {iconSet: 'font awesome', code: "\uf0e3" },
  "gear": {iconSet: 'font awesome', code: "\uf013" },
  "cog": {iconSet: 'font awesome', code: "\uf013" },
  "gears": {iconSet: 'font awesome', code: "\uf085" },
  "cogs": {iconSet: 'font awesome', code: "\uf085" },
  "gem": {iconSet: 'font awesome', code: "\uf3a5" },
  "genderless": {iconSet: 'font awesome', code: "\uf22d" },
  "ghost": {iconSet: 'font awesome', code: "\uf6e2" },
  "gift": {iconSet: 'font awesome', code: "\uf06b" },
  "gifts": {iconSet: 'font awesome', code: "\uf79c" },
  "glass-water": {iconSet: 'font awesome', code: "\ue4f4" },
  "glass-water-droplet": {iconSet: 'font awesome', code: "\ue4f5" },
  "glasses": {iconSet: 'font awesome', code: "\uf530" },
  "globe": {iconSet: 'font awesome', code: "\uf0ac" },
  "golf-ball-tee": {iconSet: 'font awesome', code: "\uf450" },
  "golf-ball": {iconSet: 'font awesome', code: "\uf450" },
  "gopuram": {iconSet: 'font awesome', code: "\uf664" },
  "graduation-cap": {iconSet: 'font awesome', code: "\uf19d" },
  "mortar-board": {iconSet: 'font awesome', code: "\uf19d" },
  "greater-than": {iconSet: 'font awesome', code: "\u003e" },
  "greater-than-equal": {iconSet: 'font awesome', code: "\uf532" },
  "grip": {iconSet: 'font awesome', code: "\uf58d" },
  "grip-horizontal": {iconSet: 'font awesome', code: "\uf58d" },
  "grip-lines": {iconSet: 'font awesome', code: "\uf7a4" },
  "grip-lines-vertical": {iconSet: 'font awesome', code: "\uf7a5" },
  "grip-vertical": {iconSet: 'font awesome', code: "\uf58e" },
  "group-arrows-rotate": {iconSet: 'font awesome', code: "\ue4f6" },
  "guarani-sign": {iconSet: 'font awesome', code: "\ue19a" },
  "guitar": {iconSet: 'font awesome', code: "\uf7a6" },
  "gun": {iconSet: 'font awesome', code: "\ue19b" },
  "h": {iconSet: 'font awesome', code: "\u0048" },
  "hammer": {iconSet: 'font awesome', code: "\uf6e3" },
  "hamsa": {iconSet: 'font awesome', code: "\uf665" },
  "hand": {iconSet: 'font awesome', code: "\uf256" },
  "hand-paper": {iconSet: 'font awesome', code: "\uf256" },
  "hand-back-fist": {iconSet: 'font awesome', code: "\uf255" },
  "hand-rock": {iconSet: 'font awesome', code: "\uf255" },
  "hand-dots": {iconSet: 'font awesome', code: "\uf461" },
  "allergies": {iconSet: 'font awesome', code: "\uf461" },
  "hand-fist": {iconSet: 'font awesome', code: "\uf6de" },
  "fist-raised": {iconSet: 'font awesome', code: "\uf6de" },
  "hand-holding": {iconSet: 'font awesome', code: "\uf4bd" },
  "hand-holding-dollar": {iconSet: 'font awesome', code: "\uf4c0" },
  "hand-holding-usd": {iconSet: 'font awesome', code: "\uf4c0" },
  "hand-holding-droplet": {iconSet: 'font awesome', code: "\uf4c1" },
  "hand-holding-water": {iconSet: 'font awesome', code: "\uf4c1" },
  "hand-holding-hand": {iconSet: 'font awesome', code: "\ue4f7" },
  "hand-holding-heart": {iconSet: 'font awesome', code: "\uf4be" },
  "hand-holding-medical": {iconSet: 'font awesome', code: "\ue05c" },
  "hand-lizard": {iconSet: 'font awesome', code: "\uf258" },
  "hand-middle-finger": {iconSet: 'font awesome', code: "\uf806" },
  "hand-peace": {iconSet: 'font awesome', code: "\uf25b" },
  "hand-point-down": {iconSet: 'font awesome', code: "\uf0a7" },
  "hand-point-left": {iconSet: 'font awesome', code: "\uf0a5" },
  "hand-point-right": {iconSet: 'font awesome', code: "\uf0a4" },
  "hand-point-up": {iconSet: 'font awesome', code: "\uf0a6" },
  "hand-pointer": {iconSet: 'font awesome', code: "\uf25a" },
  "hand-scissors": {iconSet: 'font awesome', code: "\uf257" },
  "hand-sparkles": {iconSet: 'font awesome', code: "\ue05d" },
  "hand-spock": {iconSet: 'font awesome', code: "\uf259" },
  "handcuffs": {iconSet: 'font awesome', code: "\ue4f8" },
  "hands": {iconSet: 'font awesome', code: "\uf2a7" },
  "sign-language": {iconSet: 'font awesome', code: "\uf2a7" },
  "signing": {iconSet: 'font awesome', code: "\uf2a7" },
  "hands-asl-interpreting": {iconSet: 'font awesome', code: "\uf2a3" },
  "american-sign-language-interpreting": {iconSet: 'font awesome', code: "\uf2a3" },
  "asl-interpreting": {iconSet: 'font awesome', code: "\uf2a3" },
  "hands-american-sign-language-interpreting": {iconSet: 'font awesome', code: "\uf2a3" },
  "hands-bound": {iconSet: 'font awesome', code: "\ue4f9" },
  "hands-bubbles": {iconSet: 'font awesome', code: "\ue05e" },
  "hands-wash": {iconSet: 'font awesome', code: "\ue05e" },
  "hands-clapping": {iconSet: 'font awesome', code: "\ue1a8" },
  "hands-holding": {iconSet: 'font awesome', code: "\uf4c2" },
  "hands-holding-child": {iconSet: 'font awesome', code: "\ue4fa" },
  "hands-holding-circle": {iconSet: 'font awesome', code: "\ue4fb" },
  "hands-praying": {iconSet: 'font awesome', code: "\uf684" },
  "praying-hands": {iconSet: 'font awesome', code: "\uf684" },
  "handshake": {iconSet: 'font awesome', code: "\uf2b5" },
  "handshake-angle": {iconSet: 'font awesome', code: "\uf4c4" },
  "hands-helping": {iconSet: 'font awesome', code: "\uf4c4" },
  "handshake-simple": {iconSet: 'font awesome', code: "\uf4c6" },
  "handshake-alt": {iconSet: 'font awesome', code: "\uf4c6" },
  "handshake-simple-slash": {iconSet: 'font awesome', code: "\ue05f" },
  "handshake-alt-slash": {iconSet: 'font awesome', code: "\ue05f" },
  "handshake-slash": {iconSet: 'font awesome', code: "\ue060" },
  "hanukiah": {iconSet: 'font awesome', code: "\uf6e6" },
  "hard-drive": {iconSet: 'font awesome', code: "\uf0a0" },
  "hdd": {iconSet: 'font awesome', code: "\uf0a0" },
  "hashtag": {iconSet: 'font awesome', code: "\u0023" },
  "hat-cowboy": {iconSet: 'font awesome', code: "\uf8c0" },
  "hat-cowboy-side": {iconSet: 'font awesome', code: "\uf8c1" },
  "hat-wizard": {iconSet: 'font awesome', code: "\uf6e8" },
  "head-side-cough": {iconSet: 'font awesome', code: "\ue061" },
  "head-side-cough-slash": {iconSet: 'font awesome', code: "\ue062" },
  "head-side-mask": {iconSet: 'font awesome', code: "\ue063" },
  "head-side-virus": {iconSet: 'font awesome', code: "\ue064" },
  "heading": {iconSet: 'font awesome', code: "\uf1dc" },
  "header": {iconSet: 'font awesome', code: "\uf1dc" },
  "headphones": {iconSet: 'font awesome', code: "\uf025" },
  "headphones-simple": {iconSet: 'font awesome', code: "\uf58f" },
  "headphones-alt": {iconSet: 'font awesome', code: "\uf58f" },
  "headset": {iconSet: 'font awesome', code: "\uf590" },
  "heart": {iconSet: 'font awesome', code: "\uf004" },
  "heart-circle-bolt": {iconSet: 'font awesome', code: "\ue4fc" },
  "heart-circle-check": {iconSet: 'font awesome', code: "\ue4fd" },
  "heart-circle-exclamation": {iconSet: 'font awesome', code: "\ue4fe" },
  "heart-circle-minus": {iconSet: 'font awesome', code: "\ue4ff" },
  "heart-circle-plus": {iconSet: 'font awesome', code: "\ue500" },
  "heart-circle-xmark": {iconSet: 'font awesome', code: "\ue501" },
  "heart-crack": {iconSet: 'font awesome', code: "\uf7a9" },
  "heart-broken": {iconSet: 'font awesome', code: "\uf7a9" },
  "heart-pulse": {iconSet: 'font awesome', code: "\uf21e" },
  "heartbeat": {iconSet: 'font awesome', code: "\uf21e" },
  "helicopter": {iconSet: 'font awesome', code: "\uf533" },
  "helicopter-symbol": {iconSet: 'font awesome', code: "\ue502" },
  "helmet-safety": {iconSet: 'font awesome', code: "\uf807" },
  "hard-hat": {iconSet: 'font awesome', code: "\uf807" },
  "hat-hard": {iconSet: 'font awesome', code: "\uf807" },
  "helmet-un": {iconSet: 'font awesome', code: "\ue503" },
  "highlighter": {iconSet: 'font awesome', code: "\uf591" },
  "hill-avalanche": {iconSet: 'font awesome', code: "\ue507" },
  "hill-rockslide": {iconSet: 'font awesome', code: "\ue508" },
  "hippo": {iconSet: 'font awesome', code: "\uf6ed" },
  "hockey-puck": {iconSet: 'font awesome', code: "\uf453" },
  "holly-berry": {iconSet: 'font awesome', code: "\uf7aa" },
  "horse": {iconSet: 'font awesome', code: "\uf6f0" },
  "horse-head": {iconSet: 'font awesome', code: "\uf7ab" },
  "hospital": {iconSet: 'font awesome', code: "\uf0f8" },
  "hospital-alt": {iconSet: 'font awesome', code: "\uf0f8" },
  "hospital-wide": {iconSet: 'font awesome', code: "\uf0f8" },
  "hospital-user": {iconSet: 'font awesome', code: "\uf80d" },
  "hot-tub-person": {iconSet: 'font awesome', code: "\uf593" },
  "hot-tub": {iconSet: 'font awesome', code: "\uf593" },
  "hotdog": {iconSet: 'font awesome', code: "\uf80f" },
  "hotel": {iconSet: 'font awesome', code: "\uf594" },
  "hourglass": {iconSet: 'font awesome', code: "\uf254" },
  "hourglass-2": {iconSet: 'font awesome', code: "\uf254" },
  "hourglass-half": {iconSet: 'font awesome', code: "\uf254" },
  "hourglass-empty": {iconSet: 'font awesome', code: "\uf252" },
  "hourglass-end": {iconSet: 'font awesome', code: "\uf253" },
  "hourglass-3": {iconSet: 'font awesome', code: "\uf253" },
  "hourglass-start": {iconSet: 'font awesome', code: "\uf251" },
  "hourglass-1": {iconSet: 'font awesome', code: "\uf251" },
  "house": {iconSet: 'font awesome', code: "\uf015" },
  "home": {iconSet: 'font awesome', code: "\uf015" },
  "home-alt": {iconSet: 'font awesome', code: "\uf015" },
  "home-lg-alt": {iconSet: 'font awesome', code: "\uf015" },
  "house-chimney": {iconSet: 'font awesome', code: "\ue3af" },
  "home-lg": {iconSet: 'font awesome', code: "\ue3af" },
  "house-chimney-crack": {iconSet: 'font awesome', code: "\uf6f1" },
  "house-damage": {iconSet: 'font awesome', code: "\uf6f1" },
  "house-chimney-medical": {iconSet: 'font awesome', code: "\uf7f2" },
  "clinic-medical": {iconSet: 'font awesome', code: "\uf7f2" },
  "house-chimney-user": {iconSet: 'font awesome', code: "\ue065" },
  "house-chimney-window": {iconSet: 'font awesome', code: "\ue00d" },
  "house-circle-check": {iconSet: 'font awesome', code: "\ue509" },
  "house-circle-exclamation": {iconSet: 'font awesome', code: "\ue50a" },
  "house-circle-xmark": {iconSet: 'font awesome', code: "\ue50b" },
  "house-crack": {iconSet: 'font awesome', code: "\ue3b1" },
  "house-fire": {iconSet: 'font awesome', code: "\ue50c" },
  "house-flag": {iconSet: 'font awesome', code: "\ue50d" },
  "house-flood-water": {iconSet: 'font awesome', code: "\ue50e" },
  "house-flood-water-circle-arrow-right": {iconSet: 'font awesome', code: "\ue50f" },
  "house-laptop": {iconSet: 'font awesome', code: "\ue066" },
  "laptop-house": {iconSet: 'font awesome', code: "\ue066" },
  "house-lock": {iconSet: 'font awesome', code: "\ue510" },
  "house-medical": {iconSet: 'font awesome', code: "\ue3b2" },
  "house-medical-circle-check": {iconSet: 'font awesome', code: "\ue511" },
  "house-medical-circle-exclamation": {iconSet: 'font awesome', code: "\ue512" },
  "house-medical-circle-xmark": {iconSet: 'font awesome', code: "\ue513" },
  "house-medical-flag": {iconSet: 'font awesome', code: "\ue514" },
  "house-signal": {iconSet: 'font awesome', code: "\ue012" },
  "house-tsunami": {iconSet: 'font awesome', code: "\ue515" },
  "house-user": {iconSet: 'font awesome', code: "\ue1b0" },
  "home-user": {iconSet: 'font awesome', code: "\ue1b0" },
  "hryvnia-sign": {iconSet: 'font awesome', code: "\uf6f2" },
  "hryvnia": {iconSet: 'font awesome', code: "\uf6f2" },
  "hurricane": {iconSet: 'font awesome', code: "\uf751" },
  "i": {iconSet: 'font awesome', code: "\u0049" },
  "i-cursor": {iconSet: 'font awesome', code: "\uf246" },
  "ice-cream": {iconSet: 'font awesome', code: "\uf810" },
  "icicles": {iconSet: 'font awesome', code: "\uf7ad" },
  "icons": {iconSet: 'font awesome', code: "\uf86d" },
  "heart-music-camera-bolt": {iconSet: 'font awesome', code: "\uf86d" },
  "id-badge": {iconSet: 'font awesome', code: "\uf2c1" },
  "id-card": {iconSet: 'font awesome', code: "\uf2c2" },
  "drivers-license": {iconSet: 'font awesome', code: "\uf2c2" },
  "id-card-clip": {iconSet: 'font awesome', code: "\uf47f" },
  "id-card-alt": {iconSet: 'font awesome', code: "\uf47f" },
  "igloo": {iconSet: 'font awesome', code: "\uf7ae" },
  "image": {iconSet: 'font awesome', code: "\uf03e" },
  "image-portrait": {iconSet: 'font awesome', code: "\uf3e0" },
  "portrait": {iconSet: 'font awesome', code: "\uf3e0" },
  "images": {iconSet: 'font awesome', code: "\uf302" },
  "inbox": {iconSet: 'font awesome', code: "\uf01c" },
  "indent": {iconSet: 'font awesome', code: "\uf03c" },
  "indian-rupee-sign": {iconSet: 'font awesome', code: "\ue1bc" },
  "indian-rupee": {iconSet: 'font awesome', code: "\ue1bc" },
  "inr": {iconSet: 'font awesome', code: "\ue1bc" },
  "industry": {iconSet: 'font awesome', code: "\uf275" },
  "infinity": {iconSet: 'font awesome', code: "\uf534" },
  "info": {iconSet: 'font awesome', code: "\uf129" },
  "italic": {iconSet: 'font awesome', code: "\uf033" },
  "j": {iconSet: 'font awesome', code: "\u004a" },
  "jar": {iconSet: 'font awesome', code: "\ue516" },
  "jar-wheat": {iconSet: 'font awesome', code: "\ue517" },
  "jedi": {iconSet: 'font awesome', code: "\uf669" },
  "jet-fighter": {iconSet: 'font awesome', code: "\uf0fb" },
  "fighter-jet": {iconSet: 'font awesome', code: "\uf0fb" },
  "jet-fighter-up": {iconSet: 'font awesome', code: "\ue518" },
  "joint": {iconSet: 'font awesome', code: "\uf595" },
  "jug-detergent": {iconSet: 'font awesome', code: "\ue519" },
  "k": {iconSet: 'font awesome', code: "\u004b" },
  "kaaba": {iconSet: 'font awesome', code: "\uf66b" },
  "key": {iconSet: 'font awesome', code: "\uf084" },
  "keyboard": {iconSet: 'font awesome', code: "\uf11c" },
  "khanda": {iconSet: 'font awesome', code: "\uf66d" },
  "kip-sign": {iconSet: 'font awesome', code: "\ue1c4" },
  "kit-medical": {iconSet: 'font awesome', code: "\uf479" },
  "first-aid": {iconSet: 'font awesome', code: "\uf479" },
  "kitchen-set": {iconSet: 'font awesome', code: "\ue51a" },
  "kiwi-bird": {iconSet: 'font awesome', code: "\uf535" },
  "l": {iconSet: 'font awesome', code: "\u004c" },
  "land-mine-on": {iconSet: 'font awesome', code: "\ue51b" },
  "landmark": {iconSet: 'font awesome', code: "\uf66f" },
  "landmark-dome": {iconSet: 'font awesome', code: "\uf752" },
  "landmark-alt": {iconSet: 'font awesome', code: "\uf752" },
  "landmark-flag": {iconSet: 'font awesome', code: "\ue51c" },
  "language": {iconSet: 'font awesome', code: "\uf1ab" },
  "laptop": {iconSet: 'font awesome', code: "\uf109" },
  "laptop-code": {iconSet: 'font awesome', code: "\uf5fc" },
  "laptop-file": {iconSet: 'font awesome', code: "\ue51d" },
  "laptop-medical": {iconSet: 'font awesome', code: "\uf812" },
  "lari-sign": {iconSet: 'font awesome', code: "\ue1c8" },
  "layer-group": {iconSet: 'font awesome', code: "\uf5fd" },
  "leaf": {iconSet: 'font awesome', code: "\uf06c" },
  "left-long": {iconSet: 'font awesome', code: "\uf30a" },
  "long-arrow-alt-left": {iconSet: 'font awesome', code: "\uf30a" },
  "left-right": {iconSet: 'font awesome', code: "\uf337" },
  "arrows-alt-h": {iconSet: 'font awesome', code: "\uf337" },
  "lemon": {iconSet: 'font awesome', code: "\uf094" },
  "less-than": {iconSet: 'font awesome', code: "\u003c" },
  "less-than-equal": {iconSet: 'font awesome', code: "\uf537" },
  "life-ring": {iconSet: 'font awesome', code: "\uf1cd" },
  "lightbulb": {iconSet: 'font awesome', code: "\uf0eb" },
  "lines-leaning": {iconSet: 'font awesome', code: "\ue51e" },
  "link": {iconSet: 'font awesome', code: "\uf0c1" },
  "chain": {iconSet: 'font awesome', code: "\uf0c1" },
  "link-slash": {iconSet: 'font awesome', code: "\uf127" },
  "chain-broken": {iconSet: 'font awesome', code: "\uf127" },
  "chain-slash": {iconSet: 'font awesome', code: "\uf127" },
  "unlink": {iconSet: 'font awesome', code: "\uf127" },
  "lira-sign": {iconSet: 'font awesome', code: "\uf195" },
  "list": {iconSet: 'font awesome', code: "\uf03a" },
  "list-squares": {iconSet: 'font awesome', code: "\uf03a" },
  "list-check": {iconSet: 'font awesome', code: "\uf0ae" },
  "tasks": {iconSet: 'font awesome', code: "\uf0ae" },
  "list-ol": {iconSet: 'font awesome', code: "\uf0cb" },
  "list-1-2": {iconSet: 'font awesome', code: "\uf0cb" },
  "list-numeric": {iconSet: 'font awesome', code: "\uf0cb" },
  "list-ul": {iconSet: 'font awesome', code: "\uf0ca" },
  "list-dots": {iconSet: 'font awesome', code: "\uf0ca" },
  "litecoin-sign": {iconSet: 'font awesome', code: "\ue1d3" },
  "location-arrow": {iconSet: 'font awesome', code: "\uf124" },
  "location-crosshairs": {iconSet: 'font awesome', code: "\uf601" },
  "location": {iconSet: 'font awesome', code: "\uf601" },
  "location-dot": {iconSet: 'font awesome', code: "\uf3c5" },
  "map-marker-alt": {iconSet: 'font awesome', code: "\uf3c5" },
  "location-pin": {iconSet: 'font awesome', code: "\uf041" },
  "map-marker": {iconSet: 'font awesome', code: "\uf041" },
  "location-pin-lock": {iconSet: 'font awesome', code: "\ue51f" },
  "lock": {iconSet: 'font awesome', code: "\uf023" },
  "lock-open": {iconSet: 'font awesome', code: "\uf3c1" },
  "locust": {iconSet: 'font awesome', code: "\ue520" },
  "lungs": {iconSet: 'font awesome', code: "\uf604" },
  "lungs-virus": {iconSet: 'font awesome', code: "\ue067" },
  "m": {iconSet: 'font awesome', code: "\u004d" },
  "magnet": {iconSet: 'font awesome', code: "\uf076" },
  "magnifying-glass": {iconSet: 'font awesome', code: "\uf002" },
  "search": {iconSet: 'font awesome', code: "\uf002" },
  "magnifying-glass-arrow-right": {iconSet: 'font awesome', code: "\ue521" },
  "magnifying-glass-chart": {iconSet: 'font awesome', code: "\ue522" },
  "magnifying-glass-dollar": {iconSet: 'font awesome', code: "\uf688" },
  "search-dollar": {iconSet: 'font awesome', code: "\uf688" },
  "magnifying-glass-location": {iconSet: 'font awesome', code: "\uf689" },
  "search-location": {iconSet: 'font awesome', code: "\uf689" },
  "magnifying-glass-minus": {iconSet: 'font awesome', code: "\uf010" },
  "search-minus": {iconSet: 'font awesome', code: "\uf010" },
  "magnifying-glass-plus": {iconSet: 'font awesome', code: "\uf00e" },
  "search-plus": {iconSet: 'font awesome', code: "\uf00e" },
  "manat-sign": {iconSet: 'font awesome', code: "\ue1d5" },
  "map": {iconSet: 'font awesome', code: "\uf279" },
  "map-location": {iconSet: 'font awesome', code: "\uf59f" },
  "map-marked": {iconSet: 'font awesome', code: "\uf59f" },
  "map-location-dot": {iconSet: 'font awesome', code: "\uf5a0" },
  "map-marked-alt": {iconSet: 'font awesome', code: "\uf5a0" },
  "map-pin": {iconSet: 'font awesome', code: "\uf276" },
  "marker": {iconSet: 'font awesome', code: "\uf5a1" },
  "mars": {iconSet: 'font awesome', code: "\uf222" },
  "mars-and-venus": {iconSet: 'font awesome', code: "\uf224" },
  "mars-and-venus-burst": {iconSet: 'font awesome', code: "\ue523" },
  "mars-double": {iconSet: 'font awesome', code: "\uf227" },
  "mars-stroke": {iconSet: 'font awesome', code: "\uf229" },
  "mars-stroke-right": {iconSet: 'font awesome', code: "\uf22b" },
  "mars-stroke-h": {iconSet: 'font awesome', code: "\uf22b" },
  "mars-stroke-up": {iconSet: 'font awesome', code: "\uf22a" },
  "mars-stroke-v": {iconSet: 'font awesome', code: "\uf22a" },
  "martini-glass": {iconSet: 'font awesome', code: "\uf57b" },
  "glass-martini-alt": {iconSet: 'font awesome', code: "\uf57b" },
  "martini-glass-citrus": {iconSet: 'font awesome', code: "\uf561" },
  "cocktail": {iconSet: 'font awesome', code: "\uf561" },
  "martini-glass-empty": {iconSet: 'font awesome', code: "\uf000" },
  "glass-martini": {iconSet: 'font awesome', code: "\uf000" },
  "mask": {iconSet: 'font awesome', code: "\uf6fa" },
  "mask-face": {iconSet: 'font awesome', code: "\ue1d7" },
  "mask-ventilator": {iconSet: 'font awesome', code: "\ue524" },
  "masks-theater": {iconSet: 'font awesome', code: "\uf630" },
  "theater-masks": {iconSet: 'font awesome', code: "\uf630" },
  "mattress-pillow": {iconSet: 'font awesome', code: "\ue525" },
  "maximize": {iconSet: 'font awesome', code: "\uf31e" },
  "expand-arrows-alt": {iconSet: 'font awesome', code: "\uf31e" },
  "medal": {iconSet: 'font awesome', code: "\uf5a2" },
  "memory": {iconSet: 'font awesome', code: "\uf538" },
  "menorah": {iconSet: 'font awesome', code: "\uf676" },
  "mercury": {iconSet: 'font awesome', code: "\uf223" },
  "message": {iconSet: 'font awesome', code: "\uf27a" },
  "comment-alt": {iconSet: 'font awesome', code: "\uf27a" },
  "meteor": {iconSet: 'font awesome', code: "\uf753" },
  "microchip": {iconSet: 'font awesome', code: "\uf2db" },
  "microphone": {iconSet: 'font awesome', code: "\uf130" },
  "microphone-lines": {iconSet: 'font awesome', code: "\uf3c9" },
  "microphone-alt": {iconSet: 'font awesome', code: "\uf3c9" },
  "microphone-lines-slash": {iconSet: 'font awesome', code: "\uf539" },
  "microphone-alt-slash": {iconSet: 'font awesome', code: "\uf539" },
  "microphone-slash": {iconSet: 'font awesome', code: "\uf131" },
  "microscope": {iconSet: 'font awesome', code: "\uf610" },
  "mill-sign": {iconSet: 'font awesome', code: "\ue1ed" },
  "minimize": {iconSet: 'font awesome', code: "\uf78c" },
  "compress-arrows-alt": {iconSet: 'font awesome', code: "\uf78c" },
  "minus": {iconSet: 'font awesome', code: "\uf068" },
  "subtract": {iconSet: 'font awesome', code: "\uf068" },
  "mitten": {iconSet: 'font awesome', code: "\uf7b5" },
  "mobile": {iconSet: 'font awesome', code: "\uf3ce" },
  "mobile-android": {iconSet: 'font awesome', code: "\uf3ce" },
  "mobile-phone": {iconSet: 'font awesome', code: "\uf3ce" },
  "mobile-button": {iconSet: 'font awesome', code: "\uf10b" },
  "mobile-retro": {iconSet: 'font awesome', code: "\ue527" },
  "mobile-screen": {iconSet: 'font awesome', code: "\uf3cf" },
  "mobile-android-alt": {iconSet: 'font awesome', code: "\uf3cf" },
  "mobile-screen-button": {iconSet: 'font awesome', code: "\uf3cd" },
  "mobile-alt": {iconSet: 'font awesome', code: "\uf3cd" },
  "money-bill": {iconSet: 'font awesome', code: "\uf0d6" },
  "money-bill-1": {iconSet: 'font awesome', code: "\uf3d1" },
  "money-bill-alt": {iconSet: 'font awesome', code: "\uf3d1" },
  "money-bill-1-wave": {iconSet: 'font awesome', code: "\uf53b" },
  "money-bill-wave-alt": {iconSet: 'font awesome', code: "\uf53b" },
  "money-bill-transfer": {iconSet: 'font awesome', code: "\ue528" },
  "money-bill-trend-up": {iconSet: 'font awesome', code: "\ue529" },
  "money-bill-wave": {iconSet: 'font awesome', code: "\uf53a" },
  "money-bill-wheat": {iconSet: 'font awesome', code: "\ue52a" },
  "money-bills": {iconSet: 'font awesome', code: "\ue1f3" },
  "money-check": {iconSet: 'font awesome', code: "\uf53c" },
  "money-check-dollar": {iconSet: 'font awesome', code: "\uf53d" },
  "money-check-alt": {iconSet: 'font awesome', code: "\uf53d" },
  "monument": {iconSet: 'font awesome', code: "\uf5a6" },
  "moon": {iconSet: 'font awesome', code: "\uf186" },
  "mortar-pestle": {iconSet: 'font awesome', code: "\uf5a7" },
  "mosque": {iconSet: 'font awesome', code: "\uf678" },
  "mosquito": {iconSet: 'font awesome', code: "\ue52b" },
  "mosquito-net": {iconSet: 'font awesome', code: "\ue52c" },
  "motorcycle": {iconSet: 'font awesome', code: "\uf21c" },
  "mound": {iconSet: 'font awesome', code: "\ue52d" },
  "mountain": {iconSet: 'font awesome', code: "\uf6fc" },
  "mountain-city": {iconSet: 'font awesome', code: "\ue52e" },
  "mountain-sun": {iconSet: 'font awesome', code: "\ue52f" },
  "mug-hot": {iconSet: 'font awesome', code: "\uf7b6" },
  "mug-saucer": {iconSet: 'font awesome', code: "\uf0f4" },
  "coffee": {iconSet: 'font awesome', code: "\uf0f4" },
  "music": {iconSet: 'font awesome', code: "\uf001" },
  "n": {iconSet: 'font awesome', code: "\u004e" },
  "naira-sign": {iconSet: 'font awesome', code: "\ue1f6" },
  "network-wired": {iconSet: 'font awesome', code: "\uf6ff" },
  "neuter": {iconSet: 'font awesome', code: "\uf22c" },
  "newspaper": {iconSet: 'font awesome', code: "\uf1ea" },
  "not-equal": {iconSet: 'font awesome', code: "\uf53e" },
  "note-sticky": {iconSet: 'font awesome', code: "\uf249" },
  "sticky-note": {iconSet: 'font awesome', code: "\uf249" },
  "notes-medical": {iconSet: 'font awesome', code: "\uf481" },
  "o": {iconSet: 'font awesome', code: "\u004f" },
  "object-group": {iconSet: 'font awesome', code: "\uf247" },
  "object-ungroup": {iconSet: 'font awesome', code: "\uf248" },
  "oil-can": {iconSet: 'font awesome', code: "\uf613" },
  "oil-well": {iconSet: 'font awesome', code: "\ue532" },
  "om": {iconSet: 'font awesome', code: "\uf679" },
  "otter": {iconSet: 'font awesome', code: "\uf700" },
  "outdent": {iconSet: 'font awesome', code: "\uf03b" },
  "dedent": {iconSet: 'font awesome', code: "\uf03b" },
  "p": {iconSet: 'font awesome', code: "\u0050" },
  "pager": {iconSet: 'font awesome', code: "\uf815" },
  "paint-roller": {iconSet: 'font awesome', code: "\uf5aa" },
  "paintbrush": {iconSet: 'font awesome', code: "\uf1fc" },
  "paint-brush": {iconSet: 'font awesome', code: "\uf1fc" },
  "palette": {iconSet: 'font awesome', code: "\uf53f" },
  "pallet": {iconSet: 'font awesome', code: "\uf482" },
  "panorama": {iconSet: 'font awesome', code: "\ue209" },
  "paper-plane": {iconSet: 'font awesome', code: "\uf1d8" },
  "paperclip": {iconSet: 'font awesome', code: "\uf0c6" },
  "parachute-box": {iconSet: 'font awesome', code: "\uf4cd" },
  "paragraph": {iconSet: 'font awesome', code: "\uf1dd" },
  "passport": {iconSet: 'font awesome', code: "\uf5ab" },
  "paste": {iconSet: 'font awesome', code: "\uf0ea" },
  "file-clipboard": {iconSet: 'font awesome', code: "\uf0ea" },
  "pause": {iconSet: 'font awesome', code: "\uf04c" },
  "paw": {iconSet: 'font awesome', code: "\uf1b0" },
  "peace": {iconSet: 'font awesome', code: "\uf67c" },
  "pen": {iconSet: 'font awesome', code: "\uf304" },
  "pen-clip": {iconSet: 'font awesome', code: "\uf305" },
  "pen-alt": {iconSet: 'font awesome', code: "\uf305" },
  "pen-fancy": {iconSet: 'font awesome', code: "\uf5ac" },
  "pen-nib": {iconSet: 'font awesome', code: "\uf5ad" },
  "pen-ruler": {iconSet: 'font awesome', code: "\uf5ae" },
  "pencil-ruler": {iconSet: 'font awesome', code: "\uf5ae" },
  "pen-to-square": {iconSet: 'font awesome', code: "\uf044" },
  "edit": {iconSet: 'font awesome', code: "\uf044" },
  "pencil": {iconSet: 'font awesome', code: "\uf303" },
  "pencil-alt": {iconSet: 'font awesome', code: "\uf303" },
  "people-arrows-left-right": {iconSet: 'font awesome', code: "\ue068" },
  "people-arrows": {iconSet: 'font awesome', code: "\ue068" },
  "people-carry-box": {iconSet: 'font awesome', code: "\uf4ce" },
  "people-carry": {iconSet: 'font awesome', code: "\uf4ce" },
  "people-group": {iconSet: 'font awesome', code: "\ue533" },
  "people-line": {iconSet: 'font awesome', code: "\ue534" },
  "people-pulling": {iconSet: 'font awesome', code: "\ue535" },
  "people-robbery": {iconSet: 'font awesome', code: "\ue536" },
  "people-roof": {iconSet: 'font awesome', code: "\ue537" },
  "pepper-hot": {iconSet: 'font awesome', code: "\uf816" },
  "percent": {iconSet: 'font awesome', code: "\u0025" },
  "percentage": {iconSet: 'font awesome', code: "\u0025" },
  "person": {iconSet: 'font awesome', code: "\uf183" },
  "male": {iconSet: 'font awesome', code: "\uf183" },
  "person-arrow-down-to-line": {iconSet: 'font awesome', code: "\ue538" },
  "person-arrow-up-from-line": {iconSet: 'font awesome', code: "\ue539" },
  "person-biking": {iconSet: 'font awesome', code: "\uf84a" },
  "biking": {iconSet: 'font awesome', code: "\uf84a" },
  "person-booth": {iconSet: 'font awesome', code: "\uf756" },
  "person-breastfeeding": {iconSet: 'font awesome', code: "\ue53a" },
  "person-burst": {iconSet: 'font awesome', code: "\ue53b" },
  "person-cane": {iconSet: 'font awesome', code: "\ue53c" },
  "person-chalkboard": {iconSet: 'font awesome', code: "\ue53d" },
  "person-circle-check": {iconSet: 'font awesome', code: "\ue53e" },
  "person-circle-exclamation": {iconSet: 'font awesome', code: "\ue53f" },
  "person-circle-minus": {iconSet: 'font awesome', code: "\ue540" },
  "person-circle-plus": {iconSet: 'font awesome', code: "\ue541" },
  "person-circle-question": {iconSet: 'font awesome', code: "\ue542" },
  "person-circle-xmark": {iconSet: 'font awesome', code: "\ue543" },
  "person-digging": {iconSet: 'font awesome', code: "\uf85e" },
  "digging": {iconSet: 'font awesome', code: "\uf85e" },
  "person-dots-from-line": {iconSet: 'font awesome', code: "\uf470" },
  "diagnoses": {iconSet: 'font awesome', code: "\uf470" },
  "person-dress": {iconSet: 'font awesome', code: "\uf182" },
  "female": {iconSet: 'font awesome', code: "\uf182" },
  "person-dress-burst": {iconSet: 'font awesome', code: "\ue544" },
  "person-drowning": {iconSet: 'font awesome', code: "\ue545" },
  "person-falling": {iconSet: 'font awesome', code: "\ue546" },
  "person-falling-burst": {iconSet: 'font awesome', code: "\ue547" },
  "person-half-dress": {iconSet: 'font awesome', code: "\ue548" },
  "person-harassing": {iconSet: 'font awesome', code: "\ue549" },
  "person-hiking": {iconSet: 'font awesome', code: "\uf6ec" },
  "hiking": {iconSet: 'font awesome', code: "\uf6ec" },
  "person-military-pointing": {iconSet: 'font awesome', code: "\ue54a" },
  "person-military-rifle": {iconSet: 'font awesome', code: "\ue54b" },
  "person-military-to-person": {iconSet: 'font awesome', code: "\ue54c" },
  "person-praying": {iconSet: 'font awesome', code: "\uf683" },
  "pray": {iconSet: 'font awesome', code: "\uf683" },
  "person-pregnant": {iconSet: 'font awesome', code: "\ue31e" },
  "person-rays": {iconSet: 'font awesome', code: "\ue54d" },
  "person-rifle": {iconSet: 'font awesome', code: "\ue54e" },
  "person-running": {iconSet: 'font awesome', code: "\uf70c" },
  "running": {iconSet: 'font awesome', code: "\uf70c" },
  "person-shelter": {iconSet: 'font awesome', code: "\ue54f" },
  "person-skating": {iconSet: 'font awesome', code: "\uf7c5" },
  "skating": {iconSet: 'font awesome', code: "\uf7c5" },
  "person-skiing": {iconSet: 'font awesome', code: "\uf7c9" },
  "skiing": {iconSet: 'font awesome', code: "\uf7c9" },
  "person-skiing-nordic": {iconSet: 'font awesome', code: "\uf7ca" },
  "skiing-nordic": {iconSet: 'font awesome', code: "\uf7ca" },
  "person-snowboarding": {iconSet: 'font awesome', code: "\uf7ce" },
  "snowboarding": {iconSet: 'font awesome', code: "\uf7ce" },
  "person-swimming": {iconSet: 'font awesome', code: "\uf5c4" },
  "swimmer": {iconSet: 'font awesome', code: "\uf5c4" },
  "person-through-window": {iconSet: 'font awesome', code: "\ue433" },
  "person-walking": {iconSet: 'font awesome', code: "\uf554" },
  "walking": {iconSet: 'font awesome', code: "\uf554" },
  "person-walking-arrow-loop-left": {iconSet: 'font awesome', code: "\ue551" },
  "person-walking-arrow-right": {iconSet: 'font awesome', code: "\ue552" },
  "person-walking-dashed-line-arrow-right": {iconSet: 'font awesome', code: "\ue553" },
  "person-walking-luggage": {iconSet: 'font awesome', code: "\ue554" },
  "person-walking-with-cane": {iconSet: 'font awesome', code: "\uf29d" },
  "blind": {iconSet: 'font awesome', code: "\uf29d" },
  "peseta-sign": {iconSet: 'font awesome', code: "\ue221" },
  "peso-sign": {iconSet: 'font awesome', code: "\ue222" },
  "phone": {iconSet: 'font awesome', code: "\uf095" },
  "phone-flip": {iconSet: 'font awesome', code: "\uf879" },
  "phone-alt": {iconSet: 'font awesome', code: "\uf879" },
  "phone-slash": {iconSet: 'font awesome', code: "\uf3dd" },
  "phone-volume": {iconSet: 'font awesome', code: "\uf2a0" },
  "volume-control-phone": {iconSet: 'font awesome', code: "\uf2a0" },
  "photo-film": {iconSet: 'font awesome', code: "\uf87c" },
  "photo-video": {iconSet: 'font awesome', code: "\uf87c" },
  "piggy-bank": {iconSet: 'font awesome', code: "\uf4d3" },
  "pills": {iconSet: 'font awesome', code: "\uf484" },
  "pizza-slice": {iconSet: 'font awesome', code: "\uf818" },
  "place-of-worship": {iconSet: 'font awesome', code: "\uf67f" },
  "plane": {iconSet: 'font awesome', code: "\uf072" },
  "plane-arrival": {iconSet: 'font awesome', code: "\uf5af" },
  "plane-circle-check": {iconSet: 'font awesome', code: "\ue555" },
  "plane-circle-exclamation": {iconSet: 'font awesome', code: "\ue556" },
  "plane-circle-xmark": {iconSet: 'font awesome', code: "\ue557" },
  "plane-departure": {iconSet: 'font awesome', code: "\uf5b0" },
  "plane-lock": {iconSet: 'font awesome', code: "\ue558" },
  "plane-slash": {iconSet: 'font awesome', code: "\ue069" },
  "plane-up": {iconSet: 'font awesome', code: "\ue22d" },
  "plant-wilt": {iconSet: 'font awesome', code: "\ue43b" },
  "plate-wheat": {iconSet: 'font awesome', code: "\ue55a" },
  "play": {iconSet: 'font awesome', code: "\uf04b" },
  "plug": {iconSet: 'font awesome', code: "\uf1e6" },
  "plug-circle-bolt": {iconSet: 'font awesome', code: "\ue55b" },
  "plug-circle-check": {iconSet: 'font awesome', code: "\ue55c" },
  "plug-circle-exclamation": {iconSet: 'font awesome', code: "\ue55d" },
  "plug-circle-minus": {iconSet: 'font awesome', code: "\ue55e" },
  "plug-circle-plus": {iconSet: 'font awesome', code: "\ue55f" },
  "plug-circle-xmark": {iconSet: 'font awesome', code: "\ue560" },
  "plus": {iconSet: 'font awesome', code: "\u002b" },
  "add": {iconSet: 'font awesome', code: "\u002b" },
  "plus-minus": {iconSet: 'font awesome', code: "\ue43c" },
  "podcast": {iconSet: 'font awesome', code: "\uf2ce" },
  "poo": {iconSet: 'font awesome', code: "\uf2fe" },
  "poo-storm": {iconSet: 'font awesome', code: "\uf75a" },
  "poo-bolt": {iconSet: 'font awesome', code: "\uf75a" },
  "poop": {iconSet: 'font awesome', code: "\uf619" },
  "power-off": {iconSet: 'font awesome', code: "\uf011" },
  "prescription": {iconSet: 'font awesome', code: "\uf5b1" },
  "prescription-bottle": {iconSet: 'font awesome', code: "\uf485" },
  "prescription-bottle-medical": {iconSet: 'font awesome', code: "\uf486" },
  "prescription-bottle-alt": {iconSet: 'font awesome', code: "\uf486" },
  "print": {iconSet: 'font awesome', code: "\uf02f" },
  "pump-medical": {iconSet: 'font awesome', code: "\ue06a" },
  "pump-soap": {iconSet: 'font awesome', code: "\ue06b" },
  "puzzle-piece": {iconSet: 'font awesome', code: "\uf12e" },
  "q": {iconSet: 'font awesome', code: "\u0051" },
  "qrcode": {iconSet: 'font awesome', code: "\uf029" },
  "question": {iconSet: 'font awesome', code: "\u003f" },
  "quote-left": {iconSet: 'font awesome', code: "\uf10d" },
  "quote-left-alt": {iconSet: 'font awesome', code: "\uf10d" },
  "quote-right": {iconSet: 'font awesome', code: "\uf10e" },
  "quote-right-alt": {iconSet: 'font awesome', code: "\uf10e" },
  "r": {iconSet: 'font awesome', code: "\u0052" },
  "radiation": {iconSet: 'font awesome', code: "\uf7b9" },
  "radio": {iconSet: 'font awesome', code: "\uf8d7" },
  "rainbow": {iconSet: 'font awesome', code: "\uf75b" },
  "ranking-star": {iconSet: 'font awesome', code: "\ue561" },
  "receipt": {iconSet: 'font awesome', code: "\uf543" },
  "record-vinyl": {iconSet: 'font awesome', code: "\uf8d9" },
  "rectangle-ad": {iconSet: 'font awesome', code: "\uf641" },
  "ad": {iconSet: 'font awesome', code: "\uf641" },
  "rectangle-list": {iconSet: 'font awesome', code: "\uf022" },
  "list-alt": {iconSet: 'font awesome', code: "\uf022" },
  "rectangle-xmark": {iconSet: 'font awesome', code: "\uf410" },
  "rectangle-times": {iconSet: 'font awesome', code: "\uf410" },
  "times-rectangle": {iconSet: 'font awesome', code: "\uf410" },
  "window-close": {iconSet: 'font awesome', code: "\uf410" },
  "recycle": {iconSet: 'font awesome', code: "\uf1b8" },
  "registered": {iconSet: 'font awesome', code: "\uf25d" },
  "repeat": {iconSet: 'font awesome', code: "\uf363" },
  "reply": {iconSet: 'font awesome', code: "\uf3e5" },
  "mail-reply": {iconSet: 'font awesome', code: "\uf3e5" },
  "reply-all": {iconSet: 'font awesome', code: "\uf122" },
  "mail-reply-all": {iconSet: 'font awesome', code: "\uf122" },
  "republican": {iconSet: 'font awesome', code: "\uf75e" },
  "restroom": {iconSet: 'font awesome', code: "\uf7bd" },
  "retweet": {iconSet: 'font awesome', code: "\uf079" },
  "ribbon": {iconSet: 'font awesome', code: "\uf4d6" },
  "right-from-bracket": {iconSet: 'font awesome', code: "\uf2f5" },
  "sign-out-alt": {iconSet: 'font awesome', code: "\uf2f5" },
  "right-left": {iconSet: 'font awesome', code: "\uf362" },
  "exchange-alt": {iconSet: 'font awesome', code: "\uf362" },
  "right-long": {iconSet: 'font awesome', code: "\uf30b" },
  "long-arrow-alt-right": {iconSet: 'font awesome', code: "\uf30b" },
  "right-to-bracket": {iconSet: 'font awesome', code: "\uf2f6" },
  "sign-in-alt": {iconSet: 'font awesome', code: "\uf2f6" },
  "ring": {iconSet: 'font awesome', code: "\uf70b" },
  "road": {iconSet: 'font awesome', code: "\uf018" },
  "road-barrier": {iconSet: 'font awesome', code: "\ue562" },
  "road-bridge": {iconSet: 'font awesome', code: "\ue563" },
  "road-circle-check": {iconSet: 'font awesome', code: "\ue564" },
  "road-circle-exclamation": {iconSet: 'font awesome', code: "\ue565" },
  "road-circle-xmark": {iconSet: 'font awesome', code: "\ue566" },
  "road-lock": {iconSet: 'font awesome', code: "\ue567" },
  "road-spikes": {iconSet: 'font awesome', code: "\ue568" },
  "robot": {iconSet: 'font awesome', code: "\uf544" },
  "rocket": {iconSet: 'font awesome', code: "\uf135" },
  "rotate": {iconSet: 'font awesome', code: "\uf2f1" },
  "sync-alt": {iconSet: 'font awesome', code: "\uf2f1" },
  "rotate-left": {iconSet: 'font awesome', code: "\uf2ea" },
  "rotate-back": {iconSet: 'font awesome', code: "\uf2ea" },
  "rotate-backward": {iconSet: 'font awesome', code: "\uf2ea" },
  "undo-alt": {iconSet: 'font awesome', code: "\uf2ea" },
  "rotate-right": {iconSet: 'font awesome', code: "\uf2f9" },
  "redo-alt": {iconSet: 'font awesome', code: "\uf2f9" },
  "rotate-forward": {iconSet: 'font awesome', code: "\uf2f9" },
  "route": {iconSet: 'font awesome', code: "\uf4d7" },
  "rss": {iconSet: 'font awesome', code: "\uf09e" },
  "feed": {iconSet: 'font awesome', code: "\uf09e" },
  "ruble-sign": {iconSet: 'font awesome', code: "\uf158" },
  "rouble": {iconSet: 'font awesome', code: "\uf158" },
  "rub": {iconSet: 'font awesome', code: "\uf158" },
  "ruble": {iconSet: 'font awesome', code: "\uf158" },
  "rug": {iconSet: 'font awesome', code: "\ue569" },
  "ruler": {iconSet: 'font awesome', code: "\uf545" },
  "ruler-combined": {iconSet: 'font awesome', code: "\uf546" },
  "ruler-horizontal": {iconSet: 'font awesome', code: "\uf547" },
  "ruler-vertical": {iconSet: 'font awesome', code: "\uf548" },
  "rupee-sign": {iconSet: 'font awesome', code: "\uf156" },
  "rupee": {iconSet: 'font awesome', code: "\uf156" },
  "rupiah-sign": {iconSet: 'font awesome', code: "\ue23d" },
  "s": {iconSet: 'font awesome', code: "\u0053" },
  "sack-dollar": {iconSet: 'font awesome', code: "\uf81d" },
  "sack-xmark": {iconSet: 'font awesome', code: "\ue56a" },
  "sailboat": {iconSet: 'font awesome', code: "\ue445" },
  "satellite": {iconSet: 'font awesome', code: "\uf7bf" },
  "satellite-dish": {iconSet: 'font awesome', code: "\uf7c0" },
  "scale-balanced": {iconSet: 'font awesome', code: "\uf24e" },
  "balance-scale": {iconSet: 'font awesome', code: "\uf24e" },
  "scale-unbalanced": {iconSet: 'font awesome', code: "\uf515" },
  "balance-scale-left": {iconSet: 'font awesome', code: "\uf515" },
  "scale-unbalanced-flip": {iconSet: 'font awesome', code: "\uf516" },
  "balance-scale-right": {iconSet: 'font awesome', code: "\uf516" },
  "school": {iconSet: 'font awesome', code: "\uf549" },
  "school-circle-check": {iconSet: 'font awesome', code: "\ue56b" },
  "school-circle-exclamation": {iconSet: 'font awesome', code: "\ue56c" },
  "school-circle-xmark": {iconSet: 'font awesome', code: "\ue56d" },
  "school-flag": {iconSet: 'font awesome', code: "\ue56e" },
  "school-lock": {iconSet: 'font awesome', code: "\ue56f" },
  "scissors": {iconSet: 'font awesome', code: "\uf0c4" },
  "cut": {iconSet: 'font awesome', code: "\uf0c4" },
  "screwdriver": {iconSet: 'font awesome', code: "\uf54a" },
  "screwdriver-wrench": {iconSet: 'font awesome', code: "\uf7d9" },
  "tools": {iconSet: 'font awesome', code: "\uf7d9" },
  "scroll": {iconSet: 'font awesome', code: "\uf70e" },
  "scroll-torah": {iconSet: 'font awesome', code: "\uf6a0" },
  "torah": {iconSet: 'font awesome', code: "\uf6a0" },
  "sd-card": {iconSet: 'font awesome', code: "\uf7c2" },
  "section": {iconSet: 'font awesome', code: "\ue447" },
  "seedling": {iconSet: 'font awesome', code: "\uf4d8" },
  "sprout": {iconSet: 'font awesome', code: "\uf4d8" },
  "server": {iconSet: 'font awesome', code: "\uf233" },
  "shapes": {iconSet: 'font awesome', code: "\uf61f" },
  "triangle-circle-square": {iconSet: 'font awesome', code: "\uf61f" },
  "share": {iconSet: 'font awesome', code: "\uf064" },
  "arrow-turn-right": {iconSet: 'font awesome', code: "\uf064" },
  "mail-forward": {iconSet: 'font awesome', code: "\uf064" },
  "share-from-square": {iconSet: 'font awesome', code: "\uf14d" },
  "share-square": {iconSet: 'font awesome', code: "\uf14d" },
  "share-nodes": {iconSet: 'font awesome', code: "\uf1e0" },
  "share-alt": {iconSet: 'font awesome', code: "\uf1e0" },
  "sheet-plastic": {iconSet: 'font awesome', code: "\ue571" },
  "shekel-sign": {iconSet: 'font awesome', code: "\uf20b" },
  "ils": {iconSet: 'font awesome', code: "\uf20b" },
  "shekel": {iconSet: 'font awesome', code: "\uf20b" },
  "sheqel": {iconSet: 'font awesome', code: "\uf20b" },
  "sheqel-sign": {iconSet: 'font awesome', code: "\uf20b" },
  "shield": {iconSet: 'font awesome', code: "\uf132" },
  "shield-blank": {iconSet: 'font awesome', code: "\uf132" },
  "shield-cat": {iconSet: 'font awesome', code: "\ue572" },
  "shield-dog": {iconSet: 'font awesome', code: "\ue573" },
  "shield-halved": {iconSet: 'font awesome', code: "\uf3ed" },
  "shield-alt": {iconSet: 'font awesome', code: "\uf3ed" },
  "shield-heart": {iconSet: 'font awesome', code: "\ue574" },
  "shield-virus": {iconSet: 'font awesome', code: "\ue06c" },
  "ship": {iconSet: 'font awesome', code: "\uf21a" },
  "shirt": {iconSet: 'font awesome', code: "\uf553" },
  "t-shirt": {iconSet: 'font awesome', code: "\uf553" },
  "tshirt": {iconSet: 'font awesome', code: "\uf553" },
  "shoe-prints": {iconSet: 'font awesome', code: "\uf54b" },
  "shop": {iconSet: 'font awesome', code: "\uf54f" },
  "store-alt": {iconSet: 'font awesome', code: "\uf54f" },
  "shop-lock": {iconSet: 'font awesome', code: "\ue4a5" },
  "shop-slash": {iconSet: 'font awesome', code: "\ue070" },
  "store-alt-slash": {iconSet: 'font awesome', code: "\ue070" },
  "shower": {iconSet: 'font awesome', code: "\uf2cc" },
  "shrimp": {iconSet: 'font awesome', code: "\ue448" },
  "shuffle": {iconSet: 'font awesome', code: "\uf074" },
  "random": {iconSet: 'font awesome', code: "\uf074" },
  "shuttle-space": {iconSet: 'font awesome', code: "\uf197" },
  "space-shuttle": {iconSet: 'font awesome', code: "\uf197" },
  "sign-hanging": {iconSet: 'font awesome', code: "\uf4d9" },
  "sign": {iconSet: 'font awesome', code: "\uf4d9" },
  "signal": {iconSet: 'font awesome', code: "\uf012" },
  "signal-5": {iconSet: 'font awesome', code: "\uf012" },
  "signal-perfect": {iconSet: 'font awesome', code: "\uf012" },
  "signature": {iconSet: 'font awesome', code: "\uf5b7" },
  "signs-post": {iconSet: 'font awesome', code: "\uf277" },
  "map-signs": {iconSet: 'font awesome', code: "\uf277" },
  "sim-card": {iconSet: 'font awesome', code: "\uf7c4" },
  "sink": {iconSet: 'font awesome', code: "\ue06d" },
  "sitemap": {iconSet: 'font awesome', code: "\uf0e8" },
  "skull": {iconSet: 'font awesome', code: "\uf54c" },
  "skull-crossbones": {iconSet: 'font awesome', code: "\uf714" },
  "slash": {iconSet: 'font awesome', code: "\uf715" },
  "sleigh": {iconSet: 'font awesome', code: "\uf7cc" },
  "sliders": {iconSet: 'font awesome', code: "\uf1de" },
  "sliders-h": {iconSet: 'font awesome', code: "\uf1de" },
  "smog": {iconSet: 'font awesome', code: "\uf75f" },
  "smoking": {iconSet: 'font awesome', code: "\uf48d" },
  "snowflake": {iconSet: 'font awesome', code: "\uf2dc" },
  "snowman": {iconSet: 'font awesome', code: "\uf7d0" },
  "snowplow": {iconSet: 'font awesome', code: "\uf7d2" },
  "soap": {iconSet: 'font awesome', code: "\ue06e" },
  "socks": {iconSet: 'font awesome', code: "\uf696" },
  "solar-panel": {iconSet: 'font awesome', code: "\uf5ba" },
  "sort": {iconSet: 'font awesome', code: "\uf0dc" },
  "unsorted": {iconSet: 'font awesome', code: "\uf0dc" },
  "sort-down": {iconSet: 'font awesome', code: "\uf0dd" },
  "sort-desc": {iconSet: 'font awesome', code: "\uf0dd" },
  "sort-up": {iconSet: 'font awesome', code: "\uf0de" },
  "sort-asc": {iconSet: 'font awesome', code: "\uf0de" },
  "spa": {iconSet: 'font awesome', code: "\uf5bb" },
  "spaghetti-monster-flying": {iconSet: 'font awesome', code: "\uf67b" },
  "pastafarianism": {iconSet: 'font awesome', code: "\uf67b" },
  "spell-check": {iconSet: 'font awesome', code: "\uf891" },
  "spider": {iconSet: 'font awesome', code: "\uf717" },
  "spinner": {iconSet: 'font awesome', code: "\uf110" },
  "splotch": {iconSet: 'font awesome', code: "\uf5bc" },
  "spoon": {iconSet: 'font awesome', code: "\uf2e5" },
  "utensil-spoon": {iconSet: 'font awesome', code: "\uf2e5" },
  "spray-can": {iconSet: 'font awesome', code: "\uf5bd" },
  "spray-can-sparkles": {iconSet: 'font awesome', code: "\uf5d0" },
  "air-freshener": {iconSet: 'font awesome', code: "\uf5d0" },
  "square": {iconSet: 'font awesome', code: "\uf0c8" },
  "square-arrow-up-right": {iconSet: 'font awesome', code: "\uf14c" },
  "external-link-square": {iconSet: 'font awesome', code: "\uf14c" },
  "square-caret-down": {iconSet: 'font awesome', code: "\uf150" },
  "caret-square-down": {iconSet: 'font awesome', code: "\uf150" },
  "square-caret-left": {iconSet: 'font awesome', code: "\uf191" },
  "caret-square-left": {iconSet: 'font awesome', code: "\uf191" },
  "square-caret-right": {iconSet: 'font awesome', code: "\uf152" },
  "caret-square-right": {iconSet: 'font awesome', code: "\uf152" },
  "square-caret-up": {iconSet: 'font awesome', code: "\uf151" },
  "caret-square-up": {iconSet: 'font awesome', code: "\uf151" },
  "square-check": {iconSet: 'font awesome', code: "\uf14a" },
  "check-square": {iconSet: 'font awesome', code: "\uf14a" },
  "square-envelope": {iconSet: 'font awesome', code: "\uf199" },
  "envelope-square": {iconSet: 'font awesome', code: "\uf199" },
  "square-full": {iconSet: 'font awesome', code: "\uf45c" },
  "square-h": {iconSet: 'font awesome', code: "\uf0fd" },
  "h-square": {iconSet: 'font awesome', code: "\uf0fd" },
  "square-minus": {iconSet: 'font awesome', code: "\uf146" },
  "minus-square": {iconSet: 'font awesome', code: "\uf146" },
  "square-nfi": {iconSet: 'font awesome', code: "\ue576" },
  "square-parking": {iconSet: 'font awesome', code: "\uf540" },
  "parking": {iconSet: 'font awesome', code: "\uf540" },
  "square-pen": {iconSet: 'font awesome', code: "\uf14b" },
  "pen-square": {iconSet: 'font awesome', code: "\uf14b" },
  "pencil-square": {iconSet: 'font awesome', code: "\uf14b" },
  "square-person-confined": {iconSet: 'font awesome', code: "\ue577" },
  "square-phone": {iconSet: 'font awesome', code: "\uf098" },
  "phone-square": {iconSet: 'font awesome', code: "\uf098" },
  "square-phone-flip": {iconSet: 'font awesome', code: "\uf87b" },
  "phone-square-alt": {iconSet: 'font awesome', code: "\uf87b" },
  "square-plus": {iconSet: 'font awesome', code: "\uf0fe" },
  "plus-square": {iconSet: 'font awesome', code: "\uf0fe" },
  "square-poll-horizontal": {iconSet: 'font awesome', code: "\uf682" },
  "poll-h": {iconSet: 'font awesome', code: "\uf682" },
  "square-poll-vertical": {iconSet: 'font awesome', code: "\uf681" },
  "poll": {iconSet: 'font awesome', code: "\uf681" },
  "square-root-variable": {iconSet: 'font awesome', code: "\uf698" },
  "square-root-alt": {iconSet: 'font awesome', code: "\uf698" },
  "square-rss": {iconSet: 'font awesome', code: "\uf143" },
  "rss-square": {iconSet: 'font awesome', code: "\uf143" },
  "square-share-nodes": {iconSet: 'font awesome', code: "\uf1e1" },
  "share-alt-square": {iconSet: 'font awesome', code: "\uf1e1" },
  "square-up-right": {iconSet: 'font awesome', code: "\uf360" },
  "external-link-square-alt": {iconSet: 'font awesome', code: "\uf360" },
  "square-virus": {iconSet: 'font awesome', code: "\ue578" },
  "square-xmark": {iconSet: 'font awesome', code: "\uf2d3" },
  "times-square": {iconSet: 'font awesome', code: "\uf2d3" },
  "xmark-square": {iconSet: 'font awesome', code: "\uf2d3" },
  "staff-aesculapius": {iconSet: 'font awesome', code: "\ue579" },
  "rod-asclepius": {iconSet: 'font awesome', code: "\ue579" },
  "rod-snake": {iconSet: 'font awesome', code: "\ue579" },
  "staff-snake": {iconSet: 'font awesome', code: "\ue579" },
  "stairs": {iconSet: 'font awesome', code: "\ue289" },
  "stamp": {iconSet: 'font awesome', code: "\uf5bf" },
  "star": {iconSet: 'font awesome', code: "\uf005" },
  "star-and-crescent": {iconSet: 'font awesome', code: "\uf699" },
  "star-half": {iconSet: 'font awesome', code: "\uf089" },
  "star-half-stroke": {iconSet: 'font awesome', code: "\uf5c0" },
  "star-half-alt": {iconSet: 'font awesome', code: "\uf5c0" },
  "star-of-david": {iconSet: 'font awesome', code: "\uf69a" },
  "star-of-life": {iconSet: 'font awesome', code: "\uf621" },
  "sterling-sign": {iconSet: 'font awesome', code: "\uf154" },
  "gbp": {iconSet: 'font awesome', code: "\uf154" },
  "pound-sign": {iconSet: 'font awesome', code: "\uf154" },
  "stethoscope": {iconSet: 'font awesome', code: "\uf0f1" },
  "stop": {iconSet: 'font awesome', code: "\uf04d" },
  "stopwatch": {iconSet: 'font awesome', code: "\uf2f2" },
  "stopwatch-20": {iconSet: 'font awesome', code: "\ue06f" },
  "store": {iconSet: 'font awesome', code: "\uf54e" },
  "store-slash": {iconSet: 'font awesome', code: "\ue071" },
  "street-view": {iconSet: 'font awesome', code: "\uf21d" },
  "strikethrough": {iconSet: 'font awesome', code: "\uf0cc" },
  "stroopwafel": {iconSet: 'font awesome', code: "\uf551" },
  "subscript": {iconSet: 'font awesome', code: "\uf12c" },
  "suitcase": {iconSet: 'font awesome', code: "\uf0f2" },
  "suitcase-medical": {iconSet: 'font awesome', code: "\uf0fa" },
  "medkit": {iconSet: 'font awesome', code: "\uf0fa" },
  "suitcase-rolling": {iconSet: 'font awesome', code: "\uf5c1" },
  "sun": {iconSet: 'font awesome', code: "\uf185" },
  "sun-plant-wilt": {iconSet: 'font awesome', code: "\ue57a" },
  "superscript": {iconSet: 'font awesome', code: "\uf12b" },
  "swatchbook": {iconSet: 'font awesome', code: "\uf5c3" },
  "synagogue": {iconSet: 'font awesome', code: "\uf69b" },
  "syringe": {iconSet: 'font awesome', code: "\uf48e" },
  "t": {iconSet: 'font awesome', code: "\u0054" },
  "table": {iconSet: 'font awesome', code: "\uf0ce" },
  "table-cells": {iconSet: 'font awesome', code: "\uf00a" },
  "th": {iconSet: 'font awesome', code: "\uf00a" },
  "table-cells-large": {iconSet: 'font awesome', code: "\uf009" },
  "th-large": {iconSet: 'font awesome', code: "\uf009" },
  "table-columns": {iconSet: 'font awesome', code: "\uf0db" },
  "columns": {iconSet: 'font awesome', code: "\uf0db" },
  "table-list": {iconSet: 'font awesome', code: "\uf00b" },
  "th-list": {iconSet: 'font awesome', code: "\uf00b" },
  "table-tennis-paddle-ball": {iconSet: 'font awesome', code: "\uf45d" },
  "ping-pong-paddle-ball": {iconSet: 'font awesome', code: "\uf45d" },
  "table-tennis": {iconSet: 'font awesome', code: "\uf45d" },
  "tablet": {iconSet: 'font awesome', code: "\uf3fb" },
  "tablet-android": {iconSet: 'font awesome', code: "\uf3fb" },
  "tablet-button": {iconSet: 'font awesome', code: "\uf10a" },
  "tablet-screen-button": {iconSet: 'font awesome', code: "\uf3fa" },
  "tablet-alt": {iconSet: 'font awesome', code: "\uf3fa" },
  "tablets": {iconSet: 'font awesome', code: "\uf490" },
  "tachograph-digital": {iconSet: 'font awesome', code: "\uf566" },
  "digital-tachograph": {iconSet: 'font awesome', code: "\uf566" },
  "tag": {iconSet: 'font awesome', code: "\uf02b" },
  "tags": {iconSet: 'font awesome', code: "\uf02c" },
  "tape": {iconSet: 'font awesome', code: "\uf4db" },
  "tarp": {iconSet: 'font awesome', code: "\ue57b" },
  "tarp-droplet": {iconSet: 'font awesome', code: "\ue57c" },
  "taxi": {iconSet: 'font awesome', code: "\uf1ba" },
  "cab": {iconSet: 'font awesome', code: "\uf1ba" },
  "teeth": {iconSet: 'font awesome', code: "\uf62e" },
  "teeth-open": {iconSet: 'font awesome', code: "\uf62f" },
  "temperature-arrow-down": {iconSet: 'font awesome', code: "\ue03f" },
  "temperature-down": {iconSet: 'font awesome', code: "\ue03f" },
  "temperature-arrow-up": {iconSet: 'font awesome', code: "\ue040" },
  "temperature-up": {iconSet: 'font awesome', code: "\ue040" },
  "temperature-empty": {iconSet: 'font awesome', code: "\uf2cb" },
  "temperature-0": {iconSet: 'font awesome', code: "\uf2cb" },
  "thermometer-0": {iconSet: 'font awesome', code: "\uf2cb" },
  "thermometer-empty": {iconSet: 'font awesome', code: "\uf2cb" },
  "temperature-full": {iconSet: 'font awesome', code: "\uf2c7" },
  "temperature-4": {iconSet: 'font awesome', code: "\uf2c7" },
  "thermometer-4": {iconSet: 'font awesome', code: "\uf2c7" },
  "thermometer-full": {iconSet: 'font awesome', code: "\uf2c7" },
  "temperature-half": {iconSet: 'font awesome', code: "\uf2c9" },
  "temperature-2": {iconSet: 'font awesome', code: "\uf2c9" },
  "thermometer-2": {iconSet: 'font awesome', code: "\uf2c9" },
  "thermometer-half": {iconSet: 'font awesome', code: "\uf2c9" },
  "temperature-high": {iconSet: 'font awesome', code: "\uf769" },
  "temperature-low": {iconSet: 'font awesome', code: "\uf76b" },
  "temperature-quarter": {iconSet: 'font awesome', code: "\uf2ca" },
  "temperature-1": {iconSet: 'font awesome', code: "\uf2ca" },
  "thermometer-1": {iconSet: 'font awesome', code: "\uf2ca" },
  "thermometer-quarter": {iconSet: 'font awesome', code: "\uf2ca" },
  "temperature-three-quarters": {iconSet: 'font awesome', code: "\uf2c8" },
  "temperature-3": {iconSet: 'font awesome', code: "\uf2c8" },
  "thermometer-3": {iconSet: 'font awesome', code: "\uf2c8" },
  "thermometer-three-quarters": {iconSet: 'font awesome', code: "\uf2c8" },
  "tenge-sign": {iconSet: 'font awesome', code: "\uf7d7" },
  "tenge": {iconSet: 'font awesome', code: "\uf7d7" },
  "tent": {iconSet: 'font awesome', code: "\ue57d" },
  "tent-arrow-down-to-line": {iconSet: 'font awesome', code: "\ue57e" },
  "tent-arrow-left-right": {iconSet: 'font awesome', code: "\ue57f" },
  "tent-arrow-turn-left": {iconSet: 'font awesome', code: "\ue580" },
  "tent-arrows-down": {iconSet: 'font awesome', code: "\ue581" },
  "tents": {iconSet: 'font awesome', code: "\ue582" },
  "terminal": {iconSet: 'font awesome', code: "\uf120" },
  "text-height": {iconSet: 'font awesome', code: "\uf034" },
  "text-slash": {iconSet: 'font awesome', code: "\uf87d" },
  "remove-format": {iconSet: 'font awesome', code: "\uf87d" },
  "text-width": {iconSet: 'font awesome', code: "\uf035" },
  "thermometer": {iconSet: 'font awesome', code: "\uf491" },
  "thumbs-down": {iconSet: 'font awesome', code: "\uf165" },
  "thumbs-up": {iconSet: 'font awesome', code: "\uf164" },
  "thumbtack": {iconSet: 'font awesome', code: "\uf08d" },
  "thumb-tack": {iconSet: 'font awesome', code: "\uf08d" },
  "ticket": {iconSet: 'font awesome', code: "\uf145" },
  "ticket-simple": {iconSet: 'font awesome', code: "\uf3ff" },
  "ticket-alt": {iconSet: 'font awesome', code: "\uf3ff" },
  "timeline": {iconSet: 'font awesome', code: "\ue29c" },
  "toggle-off": {iconSet: 'font awesome', code: "\uf204" },
  "toggle-on": {iconSet: 'font awesome', code: "\uf205" },
  "toilet": {iconSet: 'font awesome', code: "\uf7d8" },
  "toilet-paper": {iconSet: 'font awesome', code: "\uf71e" },
  "toilet-paper-slash": {iconSet: 'font awesome', code: "\ue072" },
  "toilet-portable": {iconSet: 'font awesome', code: "\ue583" },
  "toilets-portable": {iconSet: 'font awesome', code: "\ue584" },
  "toolbox": {iconSet: 'font awesome', code: "\uf552" },
  "tooth": {iconSet: 'font awesome', code: "\uf5c9" },
  "torii-gate": {iconSet: 'font awesome', code: "\uf6a1" },
  "tornado": {iconSet: 'font awesome', code: "\uf76f" },
  "tower-broadcast": {iconSet: 'font awesome', code: "\uf519" },
  "broadcast-tower": {iconSet: 'font awesome', code: "\uf519" },
  "tower-cell": {iconSet: 'font awesome', code: "\ue585" },
  "tower-observation": {iconSet: 'font awesome', code: "\ue586" },
  "tractor": {iconSet: 'font awesome', code: "\uf722" },
  "trademark": {iconSet: 'font awesome', code: "\uf25c" },
  "traffic-light": {iconSet: 'font awesome', code: "\uf637" },
  "trailer": {iconSet: 'font awesome', code: "\ue041" },
  "train": {iconSet: 'font awesome', code: "\uf238" },
  "train-subway": {iconSet: 'font awesome', code: "\uf239" },
  "subway": {iconSet: 'font awesome', code: "\uf239" },
  "train-tram": {iconSet: 'font awesome', code: "\uf7da" },
  "tram": {iconSet: 'font awesome', code: "\uf7da" },
  "transgender": {iconSet: 'font awesome', code: "\uf225" },
  "transgender-alt": {iconSet: 'font awesome', code: "\uf225" },
  "trash": {iconSet: 'font awesome', code: "\uf1f8" },
  "trash-arrow-up": {iconSet: 'font awesome', code: "\uf829" },
  "trash-restore": {iconSet: 'font awesome', code: "\uf829" },
  "trash-can": {iconSet: 'font awesome', code: "\uf2ed" },
  "trash-alt": {iconSet: 'font awesome', code: "\uf2ed" },
  "trash-can-arrow-up": {iconSet: 'font awesome', code: "\uf82a" },
  "trash-restore-alt": {iconSet: 'font awesome', code: "\uf82a" },
  "tree": {iconSet: 'font awesome', code: "\uf1bb" },
  "tree-city": {iconSet: 'font awesome', code: "\ue587" },
  "triangle-exclamation": {iconSet: 'font awesome', code: "\uf071" },
  "exclamation-triangle": {iconSet: 'font awesome', code: "\uf071" },
  "warning": {iconSet: 'font awesome', code: "\uf071" },
  "trophy": {iconSet: 'font awesome', code: "\uf091" },
  "trowel": {iconSet: 'font awesome', code: "\ue589" },
  "trowel-bricks": {iconSet: 'font awesome', code: "\ue58a" },
  "truck": {iconSet: 'font awesome', code: "\uf0d1" },
  "truck-arrow-right": {iconSet: 'font awesome', code: "\ue58b" },
  "truck-droplet": {iconSet: 'font awesome', code: "\ue58c" },
  "truck-fast": {iconSet: 'font awesome', code: "\uf48b" },
  "shipping-fast": {iconSet: 'font awesome', code: "\uf48b" },
  "truck-field": {iconSet: 'font awesome', code: "\ue58d" },
  "truck-field-un": {iconSet: 'font awesome', code: "\ue58e" },
  "truck-front": {iconSet: 'font awesome', code: "\ue2b7" },
  "truck-medical": {iconSet: 'font awesome', code: "\uf0f9" },
  "ambulance": {iconSet: 'font awesome', code: "\uf0f9" },
  "truck-monster": {iconSet: 'font awesome', code: "\uf63b" },
  "truck-moving": {iconSet: 'font awesome', code: "\uf4df" },
  "truck-pickup": {iconSet: 'font awesome', code: "\uf63c" },
  "truck-plane": {iconSet: 'font awesome', code: "\ue58f" },
  "truck-ramp-box": {iconSet: 'font awesome', code: "\uf4de" },
  "truck-loading": {iconSet: 'font awesome', code: "\uf4de" },
  "tty": {iconSet: 'font awesome', code: "\uf1e4" },
  "teletype": {iconSet: 'font awesome', code: "\uf1e4" },
  "turkish-lira-sign": {iconSet: 'font awesome', code: "\ue2bb" },
  "try": {iconSet: 'font awesome', code: "\ue2bb" },
  "turkish-lira": {iconSet: 'font awesome', code: "\ue2bb" },
  "turn-down": {iconSet: 'font awesome', code: "\uf3be" },
  "level-down-alt": {iconSet: 'font awesome', code: "\uf3be" },
  "turn-up": {iconSet: 'font awesome', code: "\uf3bf" },
  "level-up-alt": {iconSet: 'font awesome', code: "\uf3bf" },
  "tv": {iconSet: 'font awesome', code: "\uf26c" },
  "television": {iconSet: 'font awesome', code: "\uf26c" },
  "tv-alt": {iconSet: 'font awesome', code: "\uf26c" },
  "u": {iconSet: 'font awesome', code: "\u0055" },
  "umbrella": {iconSet: 'font awesome', code: "\uf0e9" },
  "umbrella-beach": {iconSet: 'font awesome', code: "\uf5ca" },
  "underline": {iconSet: 'font awesome', code: "\uf0cd" },
  "universal-access": {iconSet: 'font awesome', code: "\uf29a" },
  "unlock": {iconSet: 'font awesome', code: "\uf09c" },
  "unlock-keyhole": {iconSet: 'font awesome', code: "\uf13e" },
  "unlock-alt": {iconSet: 'font awesome', code: "\uf13e" },
  "up-down": {iconSet: 'font awesome', code: "\uf338" },
  "arrows-alt-v": {iconSet: 'font awesome', code: "\uf338" },
  "up-down-left-right": {iconSet: 'font awesome', code: "\uf0b2" },
  "arrows-alt": {iconSet: 'font awesome', code: "\uf0b2" },
  "up-long": {iconSet: 'font awesome', code: "\uf30c" },
  "long-arrow-alt-up": {iconSet: 'font awesome', code: "\uf30c" },
  "up-right-and-down-left-from-center": {iconSet: 'font awesome', code: "\uf424" },
  "expand-alt": {iconSet: 'font awesome', code: "\uf424" },
  "up-right-from-square": {iconSet: 'font awesome', code: "\uf35d" },
  "external-link-alt": {iconSet: 'font awesome', code: "\uf35d" },
  "upload": {iconSet: 'font awesome', code: "\uf093" },
  "user": {iconSet: 'font awesome', code: "\uf007" },
  "user-astronaut": {iconSet: 'font awesome', code: "\uf4fb" },
  "user-check": {iconSet: 'font awesome', code: "\uf4fc" },
  "user-clock": {iconSet: 'font awesome', code: "\uf4fd" },
  "user-doctor": {iconSet: 'font awesome', code: "\uf0f0" },
  "user-md": {iconSet: 'font awesome', code: "\uf0f0" },
  "user-gear": {iconSet: 'font awesome', code: "\uf4fe" },
  "user-cog": {iconSet: 'font awesome', code: "\uf4fe" },
  "user-graduate": {iconSet: 'font awesome', code: "\uf501" },
  "user-group": {iconSet: 'font awesome', code: "\uf500" },
  "user-friends": {iconSet: 'font awesome', code: "\uf500" },
  "user-injured": {iconSet: 'font awesome', code: "\uf728" },
  "user-large": {iconSet: 'font awesome', code: "\uf406" },
  "user-alt": {iconSet: 'font awesome', code: "\uf406" },
  "user-large-slash": {iconSet: 'font awesome', code: "\uf4fa" },
  "user-alt-slash": {iconSet: 'font awesome', code: "\uf4fa" },
  "user-lock": {iconSet: 'font awesome', code: "\uf502" },
  "user-minus": {iconSet: 'font awesome', code: "\uf503" },
  "user-ninja": {iconSet: 'font awesome', code: "\uf504" },
  "user-nurse": {iconSet: 'font awesome', code: "\uf82f" },
  "user-pen": {iconSet: 'font awesome', code: "\uf4ff" },
  "user-edit": {iconSet: 'font awesome', code: "\uf4ff" },
  "user-plus": {iconSet: 'font awesome', code: "\uf234" },
  "user-secret": {iconSet: 'font awesome', code: "\uf21b" },
  "user-shield": {iconSet: 'font awesome', code: "\uf505" },
  "user-slash": {iconSet: 'font awesome', code: "\uf506" },
  "user-tag": {iconSet: 'font awesome', code: "\uf507" },
  "user-tie": {iconSet: 'font awesome', code: "\uf508" },
  "user-xmark": {iconSet: 'font awesome', code: "\uf235" },
  "user-times": {iconSet: 'font awesome', code: "\uf235" },
  "users": {iconSet: 'font awesome', code: "\uf0c0" },
  "users-between-lines": {iconSet: 'font awesome', code: "\ue591" },
  "users-gear": {iconSet: 'font awesome', code: "\uf509" },
  "users-cog": {iconSet: 'font awesome', code: "\uf509" },
  "users-line": {iconSet: 'font awesome', code: "\ue592" },
  "users-rays": {iconSet: 'font awesome', code: "\ue593" },
  "users-rectangle": {iconSet: 'font awesome', code: "\ue594" },
  "users-slash": {iconSet: 'font awesome', code: "\ue073" },
  "users-viewfinder": {iconSet: 'font awesome', code: "\ue595" },
  "utensils": {iconSet: 'font awesome', code: "\uf2e7" },
  "cutlery": {iconSet: 'font awesome', code: "\uf2e7" },
  "v": {iconSet: 'font awesome', code: "\u0056" },
  "van-shuttle": {iconSet: 'font awesome', code: "\uf5b6" },
  "shuttle-van": {iconSet: 'font awesome', code: "\uf5b6" },
  "vault": {iconSet: 'font awesome', code: "\ue2c5" },
  "vector-square": {iconSet: 'font awesome', code: "\uf5cb" },
  "venus": {iconSet: 'font awesome', code: "\uf221" },
  "venus-double": {iconSet: 'font awesome', code: "\uf226" },
  "venus-mars": {iconSet: 'font awesome', code: "\uf228" },
  "vest": {iconSet: 'font awesome', code: "\ue085" },
  "vest-patches": {iconSet: 'font awesome', code: "\ue086" },
  "vial": {iconSet: 'font awesome', code: "\uf492" },
  "vial-circle-check": {iconSet: 'font awesome', code: "\ue596" },
  "vial-virus": {iconSet: 'font awesome', code: "\ue597" },
  "vials": {iconSet: 'font awesome', code: "\uf493" },
  "video": {iconSet: 'font awesome', code: "\uf03d" },
  "video-camera": {iconSet: 'font awesome', code: "\uf03d" },
  "video-slash": {iconSet: 'font awesome', code: "\uf4e2" },
  "vihara": {iconSet: 'font awesome', code: "\uf6a7" },
  "virus": {iconSet: 'font awesome', code: "\ue074" },
  "virus-covid": {iconSet: 'font awesome', code: "\ue4a8" },
  "virus-covid-slash": {iconSet: 'font awesome', code: "\ue4a9" },
  "virus-slash": {iconSet: 'font awesome', code: "\ue075" },
  "viruses": {iconSet: 'font awesome', code: "\ue076" },
  "voicemail": {iconSet: 'font awesome', code: "\uf897" },
  "volcano": {iconSet: 'font awesome', code: "\uf770" },
  "volleyball": {iconSet: 'font awesome', code: "\uf45f" },
  "volleyball-ball": {iconSet: 'font awesome', code: "\uf45f" },
  "volume-high": {iconSet: 'font awesome', code: "\uf028" },
  "volume-up": {iconSet: 'font awesome', code: "\uf028" },
  "volume-low": {iconSet: 'font awesome', code: "\uf027" },
  "volume-down": {iconSet: 'font awesome', code: "\uf027" },
  "volume-off": {iconSet: 'font awesome', code: "\uf026" },
  "volume-xmark": {iconSet: 'font awesome', code: "\uf6a9" },
  "volume-mute": {iconSet: 'font awesome', code: "\uf6a9" },
  "volume-times": {iconSet: 'font awesome', code: "\uf6a9" },
  "vr-cardboard": {iconSet: 'font awesome', code: "\uf729" },
  "w": {iconSet: 'font awesome', code: "\u0057" },
  "walkie-talkie": {iconSet: 'font awesome', code: "\uf8ef" },
  "wallet": {iconSet: 'font awesome', code: "\uf555" },
  "wand-magic": {iconSet: 'font awesome', code: "\uf0d0" },
  "magic": {iconSet: 'font awesome', code: "\uf0d0" },
  "wand-magic-sparkles": {iconSet: 'font awesome', code: "\ue2ca" },
  "magic-wand-sparkles": {iconSet: 'font awesome', code: "\ue2ca" },
  "wand-sparkles": {iconSet: 'font awesome', code: "\uf72b" },
  "warehouse": {iconSet: 'font awesome', code: "\uf494" },
  "water": {iconSet: 'font awesome', code: "\uf773" },
  "water-ladder": {iconSet: 'font awesome', code: "\uf5c5" },
  "ladder-water": {iconSet: 'font awesome', code: "\uf5c5" },
  "swimming-pool": {iconSet: 'font awesome', code: "\uf5c5" },
  "wave-square": {iconSet: 'font awesome', code: "\uf83e" },
  "weight-hanging": {iconSet: 'font awesome', code: "\uf5cd" },
  "weight-scale": {iconSet: 'font awesome', code: "\uf496" },
  "weight": {iconSet: 'font awesome', code: "\uf496" },
  "wheat-awn": {iconSet: 'font awesome', code: "\ue2cd" },
  "wheat-alt": {iconSet: 'font awesome', code: "\ue2cd" },
  "wheat-awn-circle-exclamation": {iconSet: 'font awesome', code: "\ue598" },
  "wheelchair": {iconSet: 'font awesome', code: "\uf193" },
  "wheelchair-move": {iconSet: 'font awesome', code: "\ue2ce" },
  "wheelchair-alt": {iconSet: 'font awesome', code: "\ue2ce" },
  "whiskey-glass": {iconSet: 'font awesome', code: "\uf7a0" },
  "glass-whiskey": {iconSet: 'font awesome', code: "\uf7a0" },
  "wifi": {iconSet: 'font awesome', code: "\uf1eb" },
  "wifi-3": {iconSet: 'font awesome', code: "\uf1eb" },
  "wifi-strong": {iconSet: 'font awesome', code: "\uf1eb" },
  "wind": {iconSet: 'font awesome', code: "\uf72e" },
  "window-maximize": {iconSet: 'font awesome', code: "\uf2d0" },
  "window-minimize": {iconSet: 'font awesome', code: "\uf2d1" },
  "window-restore": {iconSet: 'font awesome', code: "\uf2d2" },
  "wine-bottle": {iconSet: 'font awesome', code: "\uf72f" },
  "wine-glass": {iconSet: 'font awesome', code: "\uf4e3" },
  "wine-glass-empty": {iconSet: 'font awesome', code: "\uf5ce" },
  "wine-glass-alt": {iconSet: 'font awesome', code: "\uf5ce" },
  "won-sign": {iconSet: 'font awesome', code: "\uf159" },
  "krw": {iconSet: 'font awesome', code: "\uf159" },
  "won": {iconSet: 'font awesome', code: "\uf159" },
  "worm": {iconSet: 'font awesome', code: "\ue599" },
  "wrench": {iconSet: 'font awesome', code: "\uf0ad" },
  "x": {iconSet: 'font awesome', code: "\u0058" },
  "x-ray": {iconSet: 'font awesome', code: "\uf497" },
  "xmark": {iconSet: 'font awesome', code: "\uf00d" },
  "close": {iconSet: 'font awesome', code: "\uf00d" },
  "multiply": {iconSet: 'font awesome', code: "\uf00d" },
  "remove": {iconSet: 'font awesome', code: "\uf00d" },
  "times": {iconSet: 'font awesome', code: "\uf00d" },
  "xmarks-lines": {iconSet: 'font awesome', code: "\ue59a" },
  "y": {iconSet: 'font awesome', code: "\u0059" },
  "yen-sign": {iconSet: 'font awesome', code: "\uf157" },
  "cny": {iconSet: 'font awesome', code: "\uf157" },
  "jpy": {iconSet: 'font awesome', code: "\uf157" },
  "rmb": {iconSet: 'font awesome', code: "\uf157" },
  "yen": {iconSet: 'font awesome', code: "\uf157" },
  "yin-yang": {iconSet: 'font awesome', code: "\uf6ad" },
  "z": {iconSet: 'font awesome', code: "\u005a" },
  "42-group": {iconSet: 'font awesome', code: "\ue080" },
  "innosoft": {iconSet: 'font awesome', code: "\ue080" },
  "500px": {iconSet: 'font awesome', code: "\uf26e" },
  "accessible-icon": {iconSet: 'font awesome', code: "\uf368" },
  "accusoft": {iconSet: 'font awesome', code: "\uf369" },
  "adn": {iconSet: 'font awesome', code: "\uf170" },
  "adversal": {iconSet: 'font awesome', code: "\uf36a" },
  "affiliatetheme": {iconSet: 'font awesome', code: "\uf36b" },
  "airbnb": {iconSet: 'font awesome', code: "\uf834" },
  "algolia": {iconSet: 'font awesome', code: "\uf36c" },
  "alipay": {iconSet: 'font awesome', code: "\uf642" },
  "amazon": {iconSet: 'font awesome', code: "\uf270" },
  "amazon-pay": {iconSet: 'font awesome', code: "\uf42c" },
  "amilia": {iconSet: 'font awesome', code: "\uf36d" },
  "android": {iconSet: 'font awesome', code: "\uf17b" },
  "angellist": {iconSet: 'font awesome', code: "\uf209" },
  "angrycreative": {iconSet: 'font awesome', code: "\uf36e" },
  "angular": {iconSet: 'font awesome', code: "\uf420" },
  "app-store": {iconSet: 'font awesome', code: "\uf36f" },
  "app-store-ios": {iconSet: 'font awesome', code: "\uf370" },
  "apper": {iconSet: 'font awesome', code: "\uf371" },
  "apple": {iconSet: 'font awesome', code: "\uf179" },
  "apple-pay": {iconSet: 'font awesome', code: "\uf415" },
  "artstation": {iconSet: 'font awesome', code: "\uf77a" },
  "asymmetrik": {iconSet: 'font awesome', code: "\uf372" },
  "atlassian": {iconSet: 'font awesome', code: "\uf77b" },
  "audible": {iconSet: 'font awesome', code: "\uf373" },
  "autoprefixer": {iconSet: 'font awesome', code: "\uf41c" },
  "avianex": {iconSet: 'font awesome', code: "\uf374" },
  "aviato": {iconSet: 'font awesome', code: "\uf421" },
  "aws": {iconSet: 'font awesome', code: "\uf375" },
  "bandcamp": {iconSet: 'font awesome', code: "\uf2d5" },
  "battle-net": {iconSet: 'font awesome', code: "\uf835" },
  "behance": {iconSet: 'font awesome', code: "\uf1b4" },
  "behance-square": {iconSet: 'font awesome', code: "\uf1b5" },
  "bilibili": {iconSet: 'font awesome', code: "\ue3d9" },
  "bimobject": {iconSet: 'font awesome', code: "\uf378" },
  "bitbucket": {iconSet: 'font awesome', code: "\uf171" },
  "bitcoin": {iconSet: 'font awesome', code: "\uf379" },
  "bity": {iconSet: 'font awesome', code: "\uf37a" },
  "black-tie": {iconSet: 'font awesome', code: "\uf27e" },
  "blackberry": {iconSet: 'font awesome', code: "\uf37b" },
  "blogger": {iconSet: 'font awesome', code: "\uf37c" },
  "blogger-b": {iconSet: 'font awesome', code: "\uf37d" },
  "bluetooth": {iconSet: 'font awesome', code: "\uf293" },
  "bluetooth-b": {iconSet: 'font awesome', code: "\uf294" },
  "bootstrap": {iconSet: 'font awesome', code: "\uf836" },
  "bots": {iconSet: 'font awesome', code: "\ue340" },
  "btc": {iconSet: 'font awesome', code: "\uf15a" },
  "buffer": {iconSet: 'font awesome', code: "\uf837" },
  "buromobelexperte": {iconSet: 'font awesome', code: "\uf37f" },
  "buy-n-large": {iconSet: 'font awesome', code: "\uf8a6" },
  "buysellads": {iconSet: 'font awesome', code: "\uf20d" },
  "canadian-maple-leaf": {iconSet: 'font awesome', code: "\uf785" },
  "cc-amazon-pay": {iconSet: 'font awesome', code: "\uf42d" },
  "cc-amex": {iconSet: 'font awesome', code: "\uf1f3" },
  "cc-apple-pay": {iconSet: 'font awesome', code: "\uf416" },
  "cc-diners-club": {iconSet: 'font awesome', code: "\uf24c" },
  "cc-discover": {iconSet: 'font awesome', code: "\uf1f2" },
  "cc-jcb": {iconSet: 'font awesome', code: "\uf24b" },
  "cc-mastercard": {iconSet: 'font awesome', code: "\uf1f1" },
  "cc-paypal": {iconSet: 'font awesome', code: "\uf1f4" },
  "cc-stripe": {iconSet: 'font awesome', code: "\uf1f5" },
  "cc-visa": {iconSet: 'font awesome', code: "\uf1f0" },
  "centercode": {iconSet: 'font awesome', code: "\uf380" },
  "centos": {iconSet: 'font awesome', code: "\uf789" },
  "chrome": {iconSet: 'font awesome', code: "\uf268" },
  "chromecast": {iconSet: 'font awesome', code: "\uf838" },
  "cloudflare": {iconSet: 'font awesome', code: "\ue07d" },
  "cloudscale": {iconSet: 'font awesome', code: "\uf383" },
  "cloudsmith": {iconSet: 'font awesome', code: "\uf384" },
  "cloudversify": {iconSet: 'font awesome', code: "\uf385" },
  "cmplid": {iconSet: 'font awesome', code: "\ue360" },
  "codepen": {iconSet: 'font awesome', code: "\uf1cb" },
  "codiepie": {iconSet: 'font awesome', code: "\uf284" },
  "confluence": {iconSet: 'font awesome', code: "\uf78d" },
  "connectdevelop": {iconSet: 'font awesome', code: "\uf20e" },
  "contao": {iconSet: 'font awesome', code: "\uf26d" },
  "cotton-bureau": {iconSet: 'font awesome', code: "\uf89e" },
  "cpanel": {iconSet: 'font awesome', code: "\uf388" },
  "creative-commons": {iconSet: 'font awesome', code: "\uf25e" },
  "creative-commons-by": {iconSet: 'font awesome', code: "\uf4e7" },
  "creative-commons-nc": {iconSet: 'font awesome', code: "\uf4e8" },
  "creative-commons-nc-eu": {iconSet: 'font awesome', code: "\uf4e9" },
  "creative-commons-nc-jp": {iconSet: 'font awesome', code: "\uf4ea" },
  "creative-commons-nd": {iconSet: 'font awesome', code: "\uf4eb" },
  "creative-commons-pd": {iconSet: 'font awesome', code: "\uf4ec" },
  "creative-commons-pd-alt": {iconSet: 'font awesome', code: "\uf4ed" },
  "creative-commons-remix": {iconSet: 'font awesome', code: "\uf4ee" },
  "creative-commons-sa": {iconSet: 'font awesome', code: "\uf4ef" },
  "creative-commons-sampling": {iconSet: 'font awesome', code: "\uf4f0" },
  "creative-commons-sampling-plus": {iconSet: 'font awesome', code: "\uf4f1" },
  "creative-commons-share": {iconSet: 'font awesome', code: "\uf4f2" },
  "creative-commons-zero": {iconSet: 'font awesome', code: "\uf4f3" },
  "critical-role": {iconSet: 'font awesome', code: "\uf6c9" },
  "css3": {iconSet: 'font awesome', code: "\uf13c" },
  "css3-alt": {iconSet: 'font awesome', code: "\uf38b" },
  "cuttlefish": {iconSet: 'font awesome', code: "\uf38c" },
  "d-and-d": {iconSet: 'font awesome', code: "\uf38d" },
  "d-and-d-beyond": {iconSet: 'font awesome', code: "\uf6ca" },
  "dailymotion": {iconSet: 'font awesome', code: "\ue052" },
  "dashcube": {iconSet: 'font awesome', code: "\uf210" },
  "deezer": {iconSet: 'font awesome', code: "\ue077" },
  "delicious": {iconSet: 'font awesome', code: "\uf1a5" },
  "deploydog": {iconSet: 'font awesome', code: "\uf38e" },
  "deskpro": {iconSet: 'font awesome', code: "\uf38f" },
  "dev": {iconSet: 'font awesome', code: "\uf6cc" },
  "deviantart": {iconSet: 'font awesome', code: "\uf1bd" },
  "dhl": {iconSet: 'font awesome', code: "\uf790" },
  "diaspora": {iconSet: 'font awesome', code: "\uf791" },
  "digg": {iconSet: 'font awesome', code: "\uf1a6" },
  "digital-ocean": {iconSet: 'font awesome', code: "\uf391" },
  "discord": {iconSet: 'font awesome', code: "\uf392" },
  "discourse": {iconSet: 'font awesome', code: "\uf393" },
  "dochub": {iconSet: 'font awesome', code: "\uf394" },
  "docker": {iconSet: 'font awesome', code: "\uf395" },
  "draft2digital": {iconSet: 'font awesome', code: "\uf396" },
  "dribbble": {iconSet: 'font awesome', code: "\uf17d" },
  "dribbble-square": {iconSet: 'font awesome', code: "\uf397" },
  "dropbox": {iconSet: 'font awesome', code: "\uf16b" },
  "drupal": {iconSet: 'font awesome', code: "\uf1a9" },
  "dyalog": {iconSet: 'font awesome', code: "\uf399" },
  "earlybirds": {iconSet: 'font awesome', code: "\uf39a" },
  "ebay": {iconSet: 'font awesome', code: "\uf4f4" },
  "edge": {iconSet: 'font awesome', code: "\uf282" },
  "edge-legacy": {iconSet: 'font awesome', code: "\ue078" },
  "elementor": {iconSet: 'font awesome', code: "\uf430" },
  "ello": {iconSet: 'font awesome', code: "\uf5f1" },
  "ember": {iconSet: 'font awesome', code: "\uf423" },
  "empire": {iconSet: 'font awesome', code: "\uf1d1" },
  "envira": {iconSet: 'font awesome', code: "\uf299" },
  "erlang": {iconSet: 'font awesome', code: "\uf39d" },
  "ethereum": {iconSet: 'font awesome', code: "\uf42e" },
  "etsy": {iconSet: 'font awesome', code: "\uf2d7" },
  "evernote": {iconSet: 'font awesome', code: "\uf839" },
  "expeditedssl": {iconSet: 'font awesome', code: "\uf23e" },
  "facebook": {iconSet: 'font awesome', code: "\uf09a" },
  "facebook-f": {iconSet: 'font awesome', code: "\uf39e" },
  "facebook-messenger": {iconSet: 'font awesome', code: "\uf39f" },
  "facebook-square": {iconSet: 'font awesome', code: "\uf082" },
  "fantasy-flight-games": {iconSet: 'font awesome', code: "\uf6dc" },
  "fedex": {iconSet: 'font awesome', code: "\uf797" },
  "fedora": {iconSet: 'font awesome', code: "\uf798" },
  "figma": {iconSet: 'font awesome', code: "\uf799" },
  "firefox": {iconSet: 'font awesome', code: "\uf269" },
  "firefox-browser": {iconSet: 'font awesome', code: "\ue007" },
  "first-order": {iconSet: 'font awesome', code: "\uf2b0" },
  "first-order-alt": {iconSet: 'font awesome', code: "\uf50a" },
  "firstdraft": {iconSet: 'font awesome', code: "\uf3a1" },
  "flickr": {iconSet: 'font awesome', code: "\uf16e" },
  "flipboard": {iconSet: 'font awesome', code: "\uf44d" },
  "fly": {iconSet: 'font awesome', code: "\uf417" },
  "font-awesome": {iconSet: 'font awesome', code: "\uf2b4" },
  "font-awesome-flag": {iconSet: 'font awesome', code: "\uf2b4" },
  "font-awesome-logo-full": {iconSet: 'font awesome', code: "\uf2b4" },
  "fonticons": {iconSet: 'font awesome', code: "\uf280" },
  "fonticons-fi": {iconSet: 'font awesome', code: "\uf3a2" },
  "fort-awesome": {iconSet: 'font awesome', code: "\uf286" },
  "fort-awesome-alt": {iconSet: 'font awesome', code: "\uf3a3" },
  "forumbee": {iconSet: 'font awesome', code: "\uf211" },
  "foursquare": {iconSet: 'font awesome', code: "\uf180" },
  "free-code-camp": {iconSet: 'font awesome', code: "\uf2c5" },
  "freebsd": {iconSet: 'font awesome', code: "\uf3a4" },
  "fulcrum": {iconSet: 'font awesome', code: "\uf50b" },
  "galactic-republic": {iconSet: 'font awesome', code: "\uf50c" },
  "galactic-senate": {iconSet: 'font awesome', code: "\uf50d" },
  "get-pocket": {iconSet: 'font awesome', code: "\uf265" },
  "gg": {iconSet: 'font awesome', code: "\uf260" },
  "gg-circle": {iconSet: 'font awesome', code: "\uf261" },
  "git": {iconSet: 'font awesome', code: "\uf1d3" },
  "git-alt": {iconSet: 'font awesome', code: "\uf841" },
  "git-square": {iconSet: 'font awesome', code: "\uf1d2" },
  "github": {iconSet: 'font awesome', code: "\uf09b" },
  "github-alt": {iconSet: 'font awesome', code: "\uf113" },
  "github-square": {iconSet: 'font awesome', code: "\uf092" },
  "gitkraken": {iconSet: 'font awesome', code: "\uf3a6" },
  "gitlab": {iconSet: 'font awesome', code: "\uf296" },
  "gitter": {iconSet: 'font awesome', code: "\uf426" },
  "glide": {iconSet: 'font awesome', code: "\uf2a5" },
  "glide-g": {iconSet: 'font awesome', code: "\uf2a6" },
  "gofore": {iconSet: 'font awesome', code: "\uf3a7" },
  "golang": {iconSet: 'font awesome', code: "\ue40f" },
  "goodreads": {iconSet: 'font awesome', code: "\uf3a8" },
  "goodreads-g": {iconSet: 'font awesome', code: "\uf3a9" },
  "google": {iconSet: 'font awesome', code: "\uf1a0" },
  "google-drive": {iconSet: 'font awesome', code: "\uf3aa" },
  "google-pay": {iconSet: 'font awesome', code: "\ue079" },
  "google-play": {iconSet: 'font awesome', code: "\uf3ab" },
  "google-plus": {iconSet: 'font awesome', code: "\uf2b3" },
  "google-plus-g": {iconSet: 'font awesome', code: "\uf0d5" },
  "google-plus-square": {iconSet: 'font awesome', code: "\uf0d4" },
  "google-wallet": {iconSet: 'font awesome', code: "\uf1ee" },
  "gratipay": {iconSet: 'font awesome', code: "\uf184" },
  "grav": {iconSet: 'font awesome', code: "\uf2d6" },
  "gripfire": {iconSet: 'font awesome', code: "\uf3ac" },
  "grunt": {iconSet: 'font awesome', code: "\uf3ad" },
  "guilded": {iconSet: 'font awesome', code: "\ue07e" },
  "gulp": {iconSet: 'font awesome', code: "\uf3ae" },
  "hacker-news": {iconSet: 'font awesome', code: "\uf1d4" },
  "hacker-news-square": {iconSet: 'font awesome', code: "\uf3af" },
  "hackerrank": {iconSet: 'font awesome', code: "\uf5f7" },
  "hashnode": {iconSet: 'font awesome', code: "\ue499" },
  "hips": {iconSet: 'font awesome', code: "\uf452" },
  "hire-a-helper": {iconSet: 'font awesome', code: "\uf3b0" },
  "hive": {iconSet: 'font awesome', code: "\ue07f" },
  "hooli": {iconSet: 'font awesome', code: "\uf427" },
  "hornbill": {iconSet: 'font awesome', code: "\uf592" },
  "hotjar": {iconSet: 'font awesome', code: "\uf3b1" },
  "houzz": {iconSet: 'font awesome', code: "\uf27c" },
  "html5": {iconSet: 'font awesome', code: "\uf13b" },
  "hubspot": {iconSet: 'font awesome', code: "\uf3b2" },
  "ideal": {iconSet: 'font awesome', code: "\ue013" },
  "imdb": {iconSet: 'font awesome', code: "\uf2d8" },
  "instagram": {iconSet: 'font awesome', code: "\uf16d" },
  "instagram-square": {iconSet: 'font awesome', code: "\ue055" },
  "instalod": {iconSet: 'font awesome', code: "\ue081" },
  "intercom": {iconSet: 'font awesome', code: "\uf7af" },
  "internet-explorer": {iconSet: 'font awesome', code: "\uf26b" },
  "invision": {iconSet: 'font awesome', code: "\uf7b0" },
  "ioxhost": {iconSet: 'font awesome', code: "\uf208" },
  "itch-io": {iconSet: 'font awesome', code: "\uf83a" },
  "itunes": {iconSet: 'font awesome', code: "\uf3b4" },
  "itunes-note": {iconSet: 'font awesome', code: "\uf3b5" },
  "java": {iconSet: 'font awesome', code: "\uf4e4" },
  "jedi-order": {iconSet: 'font awesome', code: "\uf50e" },
  "jenkins": {iconSet: 'font awesome', code: "\uf3b6" },
  "jira": {iconSet: 'font awesome', code: "\uf7b1" },
  "joget": {iconSet: 'font awesome', code: "\uf3b7" },
  "joomla": {iconSet: 'font awesome', code: "\uf1aa" },
  "js": {iconSet: 'font awesome', code: "\uf3b8" },
  "js-square": {iconSet: 'font awesome', code: "\uf3b9" },
  "jsfiddle": {iconSet: 'font awesome', code: "\uf1cc" },
  "kaggle": {iconSet: 'font awesome', code: "\uf5fa" },
  "keybase": {iconSet: 'font awesome', code: "\uf4f5" },
  "keycdn": {iconSet: 'font awesome', code: "\uf3ba" },
  "kickstarter": {iconSet: 'font awesome', code: "\uf3bb" },
  "kickstarter-k": {iconSet: 'font awesome', code: "\uf3bc" },
  "korvue": {iconSet: 'font awesome', code: "\uf42f" },
  "laravel": {iconSet: 'font awesome', code: "\uf3bd" },
  "lastfm": {iconSet: 'font awesome', code: "\uf202" },
  "lastfm-square": {iconSet: 'font awesome', code: "\uf203" },
  "leanpub": {iconSet: 'font awesome', code: "\uf212" },
  "less": {iconSet: 'font awesome', code: "\uf41d" },
  "line": {iconSet: 'font awesome', code: "\uf3c0" },
  "linkedin": {iconSet: 'font awesome', code: "\uf08c" },
  "linkedin-in": {iconSet: 'font awesome', code: "\uf0e1" },
  "linode": {iconSet: 'font awesome', code: "\uf2b8" },
  "linux": {iconSet: 'font awesome', code: "\uf17c" },
  "lyft": {iconSet: 'font awesome', code: "\uf3c3" },
  "magento": {iconSet: 'font awesome', code: "\uf3c4" },
  "mailchimp": {iconSet: 'font awesome', code: "\uf59e" },
  "mandalorian": {iconSet: 'font awesome', code: "\uf50f" },
  "markdown": {iconSet: 'font awesome', code: "\uf60f" },
  "mastodon": {iconSet: 'font awesome', code: "\uf4f6" },
  "maxcdn": {iconSet: 'font awesome', code: "\uf136" },
  "mdb": {iconSet: 'font awesome', code: "\uf8ca" },
  "medapps": {iconSet: 'font awesome', code: "\uf3c6" },
  "medium": {iconSet: 'font awesome', code: "\uf23a" },
  "medium-m": {iconSet: 'font awesome', code: "\uf23a" },
  "medrt": {iconSet: 'font awesome', code: "\uf3c8" },
  "meetup": {iconSet: 'font awesome', code: "\uf2e0" },
  "megaport": {iconSet: 'font awesome', code: "\uf5a3" },
  "mendeley": {iconSet: 'font awesome', code: "\uf7b3" },
  "microblog": {iconSet: 'font awesome', code: "\ue01a" },
  "microsoft": {iconSet: 'font awesome', code: "\uf3ca" },
  "mix": {iconSet: 'font awesome', code: "\uf3cb" },
  "mixcloud": {iconSet: 'font awesome', code: "\uf289" },
  "mixer": {iconSet: 'font awesome', code: "\ue056" },
  "mizuni": {iconSet: 'font awesome', code: "\uf3cc" },
  "modx": {iconSet: 'font awesome', code: "\uf285" },
  "monero": {iconSet: 'font awesome', code: "\uf3d0" },
  "napster": {iconSet: 'font awesome', code: "\uf3d2" },
  "neos": {iconSet: 'font awesome', code: "\uf612" },
  "nfc-directional": {iconSet: 'font awesome', code: "\ue530" },
  "nfc-symbol": {iconSet: 'font awesome', code: "\ue531" },
  "nimblr": {iconSet: 'font awesome', code: "\uf5a8" },
  "node": {iconSet: 'font awesome', code: "\uf419" },
  "node-js": {iconSet: 'font awesome', code: "\uf3d3" },
  "npm": {iconSet: 'font awesome', code: "\uf3d4" },
  "ns8": {iconSet: 'font awesome', code: "\uf3d5" },
  "nutritionix": {iconSet: 'font awesome', code: "\uf3d6" },
  "octopus-deploy": {iconSet: 'font awesome', code: "\ue082" },
  "odnoklassniki": {iconSet: 'font awesome', code: "\uf263" },
  "odnoklassniki-square": {iconSet: 'font awesome', code: "\uf264" },
  "old-republic": {iconSet: 'font awesome', code: "\uf510" },
  "opencart": {iconSet: 'font awesome', code: "\uf23d" },
  "openid": {iconSet: 'font awesome', code: "\uf19b" },
  "opera": {iconSet: 'font awesome', code: "\uf26a" },
  "optin-monster": {iconSet: 'font awesome', code: "\uf23c" },
  "orcid": {iconSet: 'font awesome', code: "\uf8d2" },
  "osi": {iconSet: 'font awesome', code: "\uf41a" },
  "padlet": {iconSet: 'font awesome', code: "\ue4a0" },
  "page4": {iconSet: 'font awesome', code: "\uf3d7" },
  "pagelines": {iconSet: 'font awesome', code: "\uf18c" },
  "palfed": {iconSet: 'font awesome', code: "\uf3d8" },
  "patreon": {iconSet: 'font awesome', code: "\uf3d9" },
  "paypal": {iconSet: 'font awesome', code: "\uf1ed" },
  "perbyte": {iconSet: 'font awesome', code: "\ue083" },
  "periscope": {iconSet: 'font awesome', code: "\uf3da" },
  "phabricator": {iconSet: 'font awesome', code: "\uf3db" },
  "phoenix-framework": {iconSet: 'font awesome', code: "\uf3dc" },
  "phoenix-squadron": {iconSet: 'font awesome', code: "\uf511" },
  "php": {iconSet: 'font awesome', code: "\uf457" },
  "pied-piper": {iconSet: 'font awesome', code: "\uf2ae" },
  "pied-piper-alt": {iconSet: 'font awesome', code: "\uf1a8" },
  "pied-piper-hat": {iconSet: 'font awesome', code: "\uf4e5" },
  "pied-piper-pp": {iconSet: 'font awesome', code: "\uf1a7" },
  "pied-piper-square": {iconSet: 'font awesome', code: "\ue01e" },
  "pinterest": {iconSet: 'font awesome', code: "\uf0d2" },
  "pinterest-p": {iconSet: 'font awesome', code: "\uf231" },
  "pinterest-square": {iconSet: 'font awesome', code: "\uf0d3" },
  "pix": {iconSet: 'font awesome', code: "\ue43a" },
  "playstation": {iconSet: 'font awesome', code: "\uf3df" },
  "product-hunt": {iconSet: 'font awesome', code: "\uf288" },
  "pushed": {iconSet: 'font awesome', code: "\uf3e1" },
  "python": {iconSet: 'font awesome', code: "\uf3e2" },
  "qq": {iconSet: 'font awesome', code: "\uf1d6" },
  "quinscape": {iconSet: 'font awesome', code: "\uf459" },
  "quora": {iconSet: 'font awesome', code: "\uf2c4" },
  "r-project": {iconSet: 'font awesome', code: "\uf4f7" },
  "raspberry-pi": {iconSet: 'font awesome', code: "\uf7bb" },
  "ravelry": {iconSet: 'font awesome', code: "\uf2d9" },
  "react": {iconSet: 'font awesome', code: "\uf41b" },
  "reacteurope": {iconSet: 'font awesome', code: "\uf75d" },
  "readme": {iconSet: 'font awesome', code: "\uf4d5" },
  "rebel": {iconSet: 'font awesome', code: "\uf1d0" },
  "red-river": {iconSet: 'font awesome', code: "\uf3e3" },
  "reddit": {iconSet: 'font awesome', code: "\uf1a1" },
  "reddit-alien": {iconSet: 'font awesome', code: "\uf281" },
  "reddit-square": {iconSet: 'font awesome', code: "\uf1a2" },
  "redhat": {iconSet: 'font awesome', code: "\uf7bc" },
  "renren": {iconSet: 'font awesome', code: "\uf18b" },
  "replyd": {iconSet: 'font awesome', code: "\uf3e6" },
  "researchgate": {iconSet: 'font awesome', code: "\uf4f8" },
  "resolving": {iconSet: 'font awesome', code: "\uf3e7" },
  "rev": {iconSet: 'font awesome', code: "\uf5b2" },
  "rocketchat": {iconSet: 'font awesome', code: "\uf3e8" },
  "rockrms": {iconSet: 'font awesome', code: "\uf3e9" },
  "rust": {iconSet: 'font awesome', code: "\ue07a" },
  "safari": {iconSet: 'font awesome', code: "\uf267" },
  "salesforce": {iconSet: 'font awesome', code: "\uf83b" },
  "sass": {iconSet: 'font awesome', code: "\uf41e" },
  "schlix": {iconSet: 'font awesome', code: "\uf3ea" },
  "screenpal": {iconSet: 'font awesome', code: "\ue570" },
  "scribd": {iconSet: 'font awesome', code: "\uf28a" },
  "searchengin": {iconSet: 'font awesome', code: "\uf3eb" },
  "sellcast": {iconSet: 'font awesome', code: "\uf2da" },
  "sellsy": {iconSet: 'font awesome', code: "\uf213" },
  "servicestack": {iconSet: 'font awesome', code: "\uf3ec" },
  "shirtsinbulk": {iconSet: 'font awesome', code: "\uf214" },
  "shopify": {iconSet: 'font awesome', code: "\ue057" },
  "shopware": {iconSet: 'font awesome', code: "\uf5b5" },
  "simplybuilt": {iconSet: 'font awesome', code: "\uf215" },
  "sistrix": {iconSet: 'font awesome', code: "\uf3ee" },
  "sith": {iconSet: 'font awesome', code: "\uf512" },
  "sitrox": {iconSet: 'font awesome', code: "\ue44a" },
  "sketch": {iconSet: 'font awesome', code: "\uf7c6" },
  "skyatlas": {iconSet: 'font awesome', code: "\uf216" },
  "skype": {iconSet: 'font awesome', code: "\uf17e" },
  "slack": {iconSet: 'font awesome', code: "\uf198" },
  "slack-hash": {iconSet: 'font awesome', code: "\uf198" },
  "slideshare": {iconSet: 'font awesome', code: "\uf1e7" },
  "snapchat": {iconSet: 'font awesome', code: "\uf2ab" },
  "snapchat-ghost": {iconSet: 'font awesome', code: "\uf2ab" },
  "snapchat-square": {iconSet: 'font awesome', code: "\uf2ad" },
  "soundcloud": {iconSet: 'font awesome', code: "\uf1be" },
  "sourcetree": {iconSet: 'font awesome', code: "\uf7d3" },
  "speakap": {iconSet: 'font awesome', code: "\uf3f3" },
  "speaker-deck": {iconSet: 'font awesome', code: "\uf83c" },
  "spotify": {iconSet: 'font awesome', code: "\uf1bc" },
  "square-font-awesome": {iconSet: 'font awesome', code: "\uf425" },
  "square-font-awesome-stroke": {iconSet: 'font awesome', code: "\uf35c" },
  "font-awesome-alt": {iconSet: 'font awesome', code: "\uf35c" },
  "squarespace": {iconSet: 'font awesome', code: "\uf5be" },
  "stack-exchange": {iconSet: 'font awesome', code: "\uf18d" },
  "stack-overflow": {iconSet: 'font awesome', code: "\uf16c" },
  "stackpath": {iconSet: 'font awesome', code: "\uf842" },
  "staylinked": {iconSet: 'font awesome', code: "\uf3f5" },
  "steam": {iconSet: 'font awesome', code: "\uf1b6" },
  "steam-square": {iconSet: 'font awesome', code: "\uf1b7" },
  "steam-symbol": {iconSet: 'font awesome', code: "\uf3f6" },
  "sticker-mule": {iconSet: 'font awesome', code: "\uf3f7" },
  "strava": {iconSet: 'font awesome', code: "\uf428" },
  "stripe": {iconSet: 'font awesome', code: "\uf429" },
  "stripe-s": {iconSet: 'font awesome', code: "\uf42a" },
  "studiovinari": {iconSet: 'font awesome', code: "\uf3f8" },
  "stumbleupon": {iconSet: 'font awesome', code: "\uf1a4" },
  "stumbleupon-circle": {iconSet: 'font awesome', code: "\uf1a3" },
  "superpowers": {iconSet: 'font awesome', code: "\uf2dd" },
  "supple": {iconSet: 'font awesome', code: "\uf3f9" },
  "suse": {iconSet: 'font awesome', code: "\uf7d6" },
  "swift": {iconSet: 'font awesome', code: "\uf8e1" },
  "symfony": {iconSet: 'font awesome', code: "\uf83d" },
  "teamspeak": {iconSet: 'font awesome', code: "\uf4f9" },
  "telegram": {iconSet: 'font awesome', code: "\uf2c6" },
  "telegram-plane": {iconSet: 'font awesome', code: "\uf2c6" },
  "tencent-weibo": {iconSet: 'font awesome', code: "\uf1d5" },
  "the-red-yeti": {iconSet: 'font awesome', code: "\uf69d" },
  "themeco": {iconSet: 'font awesome', code: "\uf5c6" },
  "themeisle": {iconSet: 'font awesome', code: "\uf2b2" },
  "think-peaks": {iconSet: 'font awesome', code: "\uf731" },
  "tiktok": {iconSet: 'font awesome', code: "\ue07b" },
  "trade-federation": {iconSet: 'font awesome', code: "\uf513" },
  "trello": {iconSet: 'font awesome', code: "\uf181" },
  "tumblr": {iconSet: 'font awesome', code: "\uf173" },
  "tumblr-square": {iconSet: 'font awesome', code: "\uf174" },
  "twitch": {iconSet: 'font awesome', code: "\uf1e8" },
  "twitter": {iconSet: 'font awesome', code: "\uf099" },
  "twitter-square": {iconSet: 'font awesome', code: "\uf081" },
  "typo3": {iconSet: 'font awesome', code: "\uf42b" },
  "uber": {iconSet: 'font awesome', code: "\uf402" },
  "ubuntu": {iconSet: 'font awesome', code: "\uf7df" },
  "uikit": {iconSet: 'font awesome', code: "\uf403" },
  "umbraco": {iconSet: 'font awesome', code: "\uf8e8" },
  "uncharted": {iconSet: 'font awesome', code: "\ue084" },
  "uniregistry": {iconSet: 'font awesome', code: "\uf404" },
  "unity": {iconSet: 'font awesome', code: "\ue049" },
  "unsplash": {iconSet: 'font awesome', code: "\ue07c" },
  "untappd": {iconSet: 'font awesome', code: "\uf405" },
  "ups": {iconSet: 'font awesome', code: "\uf7e0" },
  "usb": {iconSet: 'font awesome', code: "\uf287" },
  "usps": {iconSet: 'font awesome', code: "\uf7e1" },
  "ussunnah": {iconSet: 'font awesome', code: "\uf407" },
  "vaadin": {iconSet: 'font awesome', code: "\uf408" },
  "viacoin": {iconSet: 'font awesome', code: "\uf237" },
  "viadeo": {iconSet: 'font awesome', code: "\uf2a9" },
  "viadeo-square": {iconSet: 'font awesome', code: "\uf2aa" },
  "viber": {iconSet: 'font awesome', code: "\uf409" },
  "vimeo": {iconSet: 'font awesome', code: "\uf40a" },
  "vimeo-square": {iconSet: 'font awesome', code: "\uf194" },
  "vimeo-v": {iconSet: 'font awesome', code: "\uf27d" },
  "vine": {iconSet: 'font awesome', code: "\uf1ca" },
  "vk": {iconSet: 'font awesome', code: "\uf189" },
  "vnv": {iconSet: 'font awesome', code: "\uf40b" },
  "vuejs": {iconSet: 'font awesome', code: "\uf41f" },
  "watchman-monitoring": {iconSet: 'font awesome', code: "\ue087" },
  "waze": {iconSet: 'font awesome', code: "\uf83f" },
  "weebly": {iconSet: 'font awesome', code: "\uf5cc" },
  "weibo": {iconSet: 'font awesome', code: "\uf18a" },
  "weixin": {iconSet: 'font awesome', code: "\uf1d7" },
  "whatsapp": {iconSet: 'font awesome', code: "\uf232" },
  "whatsapp-square": {iconSet: 'font awesome', code: "\uf40c" },
  "whmcs": {iconSet: 'font awesome', code: "\uf40d" },
  "wikipedia-w": {iconSet: 'font awesome', code: "\uf266" },
  "windows": {iconSet: 'font awesome', code: "\uf17a" },
  "wirsindhandwerk": {iconSet: 'font awesome', code: "\ue2d0" },
  "wsh": {iconSet: 'font awesome', code: "\ue2d0" },
  "wix": {iconSet: 'font awesome', code: "\uf5cf" },
  "wizards-of-the-coast": {iconSet: 'font awesome', code: "\uf730" },
  "wodu": {iconSet: 'font awesome', code: "\ue088" },
  "wolf-pack-battalion": {iconSet: 'font awesome', code: "\uf514" },
  "wordpress": {iconSet: 'font awesome', code: "\uf19a" },
  "wordpress-simple": {iconSet: 'font awesome', code: "\uf411" },
  "wpbeginner": {iconSet: 'font awesome', code: "\uf297" },
  "wpexplorer": {iconSet: 'font awesome', code: "\uf2de" },
  "wpforms": {iconSet: 'font awesome', code: "\uf298" },
  "wpressr": {iconSet: 'font awesome', code: "\uf3e4" },
  "xbox": {iconSet: 'font awesome', code: "\uf412" },
  "xing": {iconSet: 'font awesome', code: "\uf168" },
  "xing-square": {iconSet: 'font awesome', code: "\uf169" },
  "y-combinator": {iconSet: 'font awesome', code: "\uf23b" },
  "yahoo": {iconSet: 'font awesome', code: "\uf19e" },
  "yammer": {iconSet: 'font awesome', code: "\uf840" },
  "yandex": {iconSet: 'font awesome', code: "\uf413" },
  "yandex-international": {iconSet: 'font awesome', code: "\uf414" },
  "yarn": {iconSet: 'font awesome', code: "\uf7e3" },
  "yelp": {iconSet: 'font awesome', code: "\uf1e9" },
  "yoast": {iconSet: 'font awesome', code: "\uf2b1" },
  "youtube": {iconSet: 'font awesome', code: "\uf167" },
  "youtube-square": {iconSet: 'font awesome', code: "\uf431" },
  "zhihu": {iconSet: 'font awesome', code: "\uf63f" },


  "ti-123" : {
    iconSet: 'tabler icons', code: "\uf554"
  },
  
  "ti-24-hours" : {
    iconSet: 'tabler icons', code: "\uf5e7"
  },
  
  "ti-2fa" : {
    iconSet: 'tabler icons', code: "\ueca0"
  },
  
  "ti-360" : {
    iconSet: 'tabler icons', code: "\uf62f"
  },
  
  "ti-360-view" : {
    iconSet: 'tabler icons', code: "\uf566"
  },
  
  "ti-3d-cube-sphere" : {
    iconSet: 'tabler icons', code: "\uecd7"
  },
  
  "ti-3d-cube-sphere-off" : {
    iconSet: 'tabler icons', code: "\uf3b5"
  },
  
  "ti-3d-rotate" : {
    iconSet: 'tabler icons', code: "\uf020"
  },
  
  "ti-a-b" : {
    iconSet: 'tabler icons', code: "\uec36"
  },
  
  "ti-a-b-2" : {
    iconSet: 'tabler icons', code: "\uf25f"
  },
  
  "ti-a-b-off" : {
    iconSet: 'tabler icons', code: "\uf0a6"
  },
  
  "ti-abacus" : {
    iconSet: 'tabler icons', code: "\uf05c"
  },
  
  "ti-abacus-off" : {
    iconSet: 'tabler icons', code: "\uf3b6"
  },
  
  "ti-abc" : {
    iconSet: 'tabler icons', code: "\uf567"
  },
  
  "ti-access-point" : {
    iconSet: 'tabler icons', code: "\ued1b"
  },
  
  "ti-access-point-off" : {
    iconSet: 'tabler icons', code: "\ued1a"
  },
  
  "ti-accessible" : {
    iconSet: 'tabler icons', code: "\ueba9"
  },
  
  "ti-accessible-off" : {
    iconSet: 'tabler icons', code: "\uf0a7"
  },
  
  "ti-accessible-off-filled" : {
    iconSet: 'tabler icons', code: "\uf6ea"
  },
  
  "ti-activity" : {
    iconSet: 'tabler icons', code: "\ued23"
  },
  
  "ti-activity-heartbeat" : {
    iconSet: 'tabler icons', code: "\uf0db"
  },
  
  "ti-ad" : {
    iconSet: 'tabler icons', code: "\uea02"
  },
  
  "ti-ad-2" : {
    iconSet: 'tabler icons', code: "\uef1f"
  },
  
  "ti-ad-circle" : {
    iconSet: 'tabler icons', code: "\uf79e"
  },
  
  "ti-ad-circle-filled" : {
    iconSet: 'tabler icons', code: "\uf7d3"
  },
  
  "ti-ad-circle-off" : {
    iconSet: 'tabler icons', code: "\uf79d"
  },
  
  "ti-ad-filled" : {
    iconSet: 'tabler icons', code: "\uf6eb"
  },
  
  "ti-ad-off" : {
    iconSet: 'tabler icons', code: "\uf3b7"
  },
  
  "ti-address-book" : {
    iconSet: 'tabler icons', code: "\uf021"
  },
  
  "ti-address-book-off" : {
    iconSet: 'tabler icons', code: "\uf3b8"
  },
  
  "ti-adjustments" : {
    iconSet: 'tabler icons', code: "\uea03"
  },
  
  "ti-adjustments-alt" : {
    iconSet: 'tabler icons', code: "\uec37"
  },
  
  "ti-adjustments-bolt" : {
    iconSet: 'tabler icons', code: "\uf7fb"
  },
  
  "ti-adjustments-cancel" : {
    iconSet: 'tabler icons', code: "\uf7fc"
  },
  
  "ti-adjustments-check" : {
    iconSet: 'tabler icons', code: "\uf7fd"
  },
  
  "ti-adjustments-code" : {
    iconSet: 'tabler icons', code: "\uf7fe"
  },
  
  "ti-adjustments-cog" : {
    iconSet: 'tabler icons', code: "\uf7ff"
  },
  
  "ti-adjustments-dollar" : {
    iconSet: 'tabler icons', code: "\uf800"
  },
  
  "ti-adjustments-down" : {
    iconSet: 'tabler icons', code: "\uf801"
  },
  
  "ti-adjustments-exclamation" : {
    iconSet: 'tabler icons', code: "\uf802"
  },
  
  "ti-adjustments-filled" : {
    iconSet: 'tabler icons', code: "\uf6ec"
  },
  
  "ti-adjustments-heart" : {
    iconSet: 'tabler icons', code: "\uf803"
  },
  
  "ti-adjustments-horizontal" : {
    iconSet: 'tabler icons', code: "\uec38"
  },
  
  "ti-adjustments-minus" : {
    iconSet: 'tabler icons', code: "\uf804"
  },
  
  "ti-adjustments-off" : {
    iconSet: 'tabler icons', code: "\uf0a8"
  },
  
  "ti-adjustments-pause" : {
    iconSet: 'tabler icons', code: "\uf805"
  },
  
  "ti-adjustments-pin" : {
    iconSet: 'tabler icons', code: "\uf806"
  },
  
  "ti-adjustments-plus" : {
    iconSet: 'tabler icons', code: "\uf807"
  },
  
  "ti-adjustments-question" : {
    iconSet: 'tabler icons', code: "\uf808"
  },
  
  "ti-adjustments-search" : {
    iconSet: 'tabler icons', code: "\uf809"
  },
  
  "ti-adjustments-share" : {
    iconSet: 'tabler icons', code: "\uf80a"
  },
  
  "ti-adjustments-star" : {
    iconSet: 'tabler icons', code: "\uf80b"
  },
  
  "ti-adjustments-up" : {
    iconSet: 'tabler icons', code: "\uf80c"
  },
  
  "ti-adjustments-x" : {
    iconSet: 'tabler icons', code: "\uf80d"
  },
  
  "ti-aerial-lift" : {
    iconSet: 'tabler icons', code: "\uedfe"
  },
  
  "ti-affiliate" : {
    iconSet: 'tabler icons', code: "\uedff"
  },
  
  "ti-affiliate-filled" : {
    iconSet: 'tabler icons', code: "\uf6ed"
  },
  
  "ti-air-balloon" : {
    iconSet: 'tabler icons', code: "\uf4a6"
  },
  
  "ti-air-conditioning" : {
    iconSet: 'tabler icons', code: "\uf3a2"
  },
  
  "ti-air-conditioning-disabled" : {
    iconSet: 'tabler icons', code: "\uf542"
  },
  
  "ti-alarm" : {
    iconSet: 'tabler icons', code: "\uea04"
  },
  
  "ti-alarm-filled" : {
    iconSet: 'tabler icons', code: "\uf709"
  },
  
  "ti-alarm-minus" : {
    iconSet: 'tabler icons', code: "\uf630"
  },
  
  "ti-alarm-minus-filled" : {
    iconSet: 'tabler icons', code: "\uf70a"
  },
  
  "ti-alarm-off" : {
    iconSet: 'tabler icons', code: "\uf0a9"
  },
  
  "ti-alarm-plus" : {
    iconSet: 'tabler icons', code: "\uf631"
  },
  
  "ti-alarm-plus-filled" : {
    iconSet: 'tabler icons', code: "\uf70b"
  },
  
  "ti-alarm-snooze" : {
    iconSet: 'tabler icons', code: "\uf632"
  },
  
  "ti-alarm-snooze-filled" : {
    iconSet: 'tabler icons', code: "\uf70c"
  },
  
  "ti-album" : {
    iconSet: 'tabler icons', code: "\uf022"
  },
  
  "ti-album-off" : {
    iconSet: 'tabler icons', code: "\uf3b9"
  },
  
  "ti-alert-circle" : {
    iconSet: 'tabler icons', code: "\uea05"
  },
  
  "ti-alert-circle-filled" : {
    iconSet: 'tabler icons', code: "\uf6ee"
  },
  
  "ti-alert-hexagon" : {
    iconSet: 'tabler icons', code: "\uf80e"
  },
  
  "ti-alert-octagon" : {
    iconSet: 'tabler icons', code: "\uecc6"
  },
  
  "ti-alert-octagon-filled" : {
    iconSet: 'tabler icons', code: "\uf6ef"
  },
  
  "ti-alert-small" : {
    iconSet: 'tabler icons', code: "\uf80f"
  },
  
  "ti-alert-square" : {
    iconSet: 'tabler icons', code: "\uf811"
  },
  
  "ti-alert-square-rounded" : {
    iconSet: 'tabler icons', code: "\uf810"
  },
  
  "ti-alert-triangle" : {
    iconSet: 'tabler icons', code: "\uea06"
  },
  
  "ti-alert-triangle-filled" : {
    iconSet: 'tabler icons', code: "\uf6f0"
  },
  
  "ti-alien" : {
    iconSet: 'tabler icons', code: "\uebde"
  },
  
  "ti-alien-filled" : {
    iconSet: 'tabler icons', code: "\uf70d"
  },
  
  "ti-align-box-bottom-center" : {
    iconSet: 'tabler icons', code: "\uf530"
  },
  
  "ti-align-box-bottom-center-filled" : {
    iconSet: 'tabler icons', code: "\uf70e"
  },
  
  "ti-align-box-bottom-left" : {
    iconSet: 'tabler icons', code: "\uf531"
  },
  
  "ti-align-box-bottom-left-filled" : {
    iconSet: 'tabler icons', code: "\uf70f"
  },
  
  "ti-align-box-bottom-right" : {
    iconSet: 'tabler icons', code: "\uf532"
  },
  
  "ti-align-box-bottom-right-filled" : {
    iconSet: 'tabler icons', code: "\uf710"
  },
  
  "ti-align-box-center-middle" : {
    iconSet: 'tabler icons', code: "\uf79f"
  },
  
  "ti-align-box-center-middle-filled" : {
    iconSet: 'tabler icons', code: "\uf7d4"
  },
  
  "ti-align-box-left-bottom" : {
    iconSet: 'tabler icons', code: "\uf533"
  },
  
  "ti-align-box-left-bottom-filled" : {
    iconSet: 'tabler icons', code: "\uf711"
  },
  
  "ti-align-box-left-middle" : {
    iconSet: 'tabler icons', code: "\uf534"
  },
  
  "ti-align-box-left-middle-filled" : {
    iconSet: 'tabler icons', code: "\uf712"
  },
  
  "ti-align-box-left-top" : {
    iconSet: 'tabler icons', code: "\uf535"
  },
  
  "ti-align-box-left-top-filled" : {
    iconSet: 'tabler icons', code: "\uf713"
  },
  
  "ti-align-box-right-bottom" : {
    iconSet: 'tabler icons', code: "\uf536"
  },
  
  "ti-align-box-right-bottom-filled" : {
    iconSet: 'tabler icons', code: "\uf714"
  },
  
  "ti-align-box-right-middle" : {
    iconSet: 'tabler icons', code: "\uf537"
  },
  
  "ti-align-box-right-middle-filled" : {
    iconSet: 'tabler icons', code: "\uf7d5"
  },
  
  "ti-align-box-right-top" : {
    iconSet: 'tabler icons', code: "\uf538"
  },
  
  "ti-align-box-right-top-filled" : {
    iconSet: 'tabler icons', code: "\uf715"
  },
  
  "ti-align-box-top-center" : {
    iconSet: 'tabler icons', code: "\uf539"
  },
  
  "ti-align-box-top-center-filled" : {
    iconSet: 'tabler icons', code: "\uf716"
  },
  
  "ti-align-box-top-left" : {
    iconSet: 'tabler icons', code: "\uf53a"
  },
  
  "ti-align-box-top-left-filled" : {
    iconSet: 'tabler icons', code: "\uf717"
  },
  
  "ti-align-box-top-right" : {
    iconSet: 'tabler icons', code: "\uf53b"
  },
  
  "ti-align-box-top-right-filled" : {
    iconSet: 'tabler icons', code: "\uf718"
  },
  
  "ti-align-center" : {
    iconSet: 'tabler icons', code: "\uea07"
  },
  
  "ti-align-justified" : {
    iconSet: 'tabler icons', code: "\uea08"
  },
  
  "ti-align-left" : {
    iconSet: 'tabler icons', code: "\uea09"
  },
  
  "ti-align-right" : {
    iconSet: 'tabler icons', code: "\uea0a"
  },
  
  "ti-alpha" : {
    iconSet: 'tabler icons', code: "\uf543"
  },
  
  "ti-alphabet-cyrillic" : {
    iconSet: 'tabler icons', code: "\uf1df"
  },
  
  "ti-alphabet-greek" : {
    iconSet: 'tabler icons', code: "\uf1e0"
  },
  
  "ti-alphabet-latin" : {
    iconSet: 'tabler icons', code: "\uf1e1"
  },
  
  "ti-ambulance" : {
    iconSet: 'tabler icons', code: "\uebf5"
  },
  
  "ti-ampersand" : {
    iconSet: 'tabler icons', code: "\uf229"
  },
  
  "ti-analyze" : {
    iconSet: 'tabler icons', code: "\uf3a3"
  },
  
  "ti-analyze-filled" : {
    iconSet: 'tabler icons', code: "\uf719"
  },
  
  "ti-analyze-off" : {
    iconSet: 'tabler icons', code: "\uf3ba"
  },
  
  "ti-anchor" : {
    iconSet: 'tabler icons', code: "\ueb76"
  },
  
  "ti-anchor-off" : {
    iconSet: 'tabler icons', code: "\uf0f7"
  },
  
  "ti-angle" : {
    iconSet: 'tabler icons', code: "\uef20"
  },
  
  "ti-ankh" : {
    iconSet: 'tabler icons', code: "\uf1cd"
  },
  
  "ti-antenna" : {
    iconSet: 'tabler icons', code: "\uf094"
  },
  
  "ti-antenna-bars-1" : {
    iconSet: 'tabler icons', code: "\uecc7"
  },
  
  "ti-antenna-bars-2" : {
    iconSet: 'tabler icons', code: "\uecc8"
  },
  
  "ti-antenna-bars-3" : {
    iconSet: 'tabler icons', code: "\uecc9"
  },
  
  "ti-antenna-bars-4" : {
    iconSet: 'tabler icons', code: "\uecca"
  },
  
  "ti-antenna-bars-5" : {
    iconSet: 'tabler icons', code: "\ueccb"
  },
  
  "ti-antenna-bars-off" : {
    iconSet: 'tabler icons', code: "\uf0aa"
  },
  
  "ti-antenna-off" : {
    iconSet: 'tabler icons', code: "\uf3bb"
  },
  
  "ti-aperture" : {
    iconSet: 'tabler icons', code: "\ueb58"
  },
  
  "ti-aperture-off" : {
    iconSet: 'tabler icons', code: "\uf3bc"
  },
  
  "ti-api" : {
    iconSet: 'tabler icons', code: "\ueffd"
  },
  
  "ti-api-app" : {
    iconSet: 'tabler icons', code: "\ueffc"
  },
  
  "ti-api-app-off" : {
    iconSet: 'tabler icons', code: "\uf0ab"
  },
  
  "ti-api-off" : {
    iconSet: 'tabler icons', code: "\uf0f8"
  },
  
  "ti-app-window" : {
    iconSet: 'tabler icons', code: "\uefe6"
  },
  
  "ti-app-window-filled" : {
    iconSet: 'tabler icons', code: "\uf71a"
  },
  
  "ti-apple" : {
    iconSet: 'tabler icons', code: "\uef21"
  },
  
  "ti-apps" : {
    iconSet: 'tabler icons', code: "\uebb6"
  },
  
  "ti-apps-filled" : {
    iconSet: 'tabler icons', code: "\uf6f1"
  },
  
  "ti-apps-off" : {
    iconSet: 'tabler icons', code: "\uf0ac"
  },
  
  "ti-archive" : {
    iconSet: 'tabler icons', code: "\uea0b"
  },
  
  "ti-archive-off" : {
    iconSet: 'tabler icons', code: "\uf0ad"
  },
  
  "ti-armchair" : {
    iconSet: 'tabler icons', code: "\uef9e"
  },
  
  "ti-armchair-2" : {
    iconSet: 'tabler icons', code: "\uefe7"
  },
  
  "ti-armchair-2-off" : {
    iconSet: 'tabler icons', code: "\uf3bd"
  },
  
  "ti-armchair-off" : {
    iconSet: 'tabler icons', code: "\uf3be"
  },
  
  "ti-arrow-autofit-content" : {
    iconSet: 'tabler icons', code: "\uef31"
  },
  
  "ti-arrow-autofit-content-filled" : {
    iconSet: 'tabler icons', code: "\uf6f2"
  },
  
  "ti-arrow-autofit-down" : {
    iconSet: 'tabler icons', code: "\uef32"
  },
  
  "ti-arrow-autofit-height" : {
    iconSet: 'tabler icons', code: "\uef33"
  },
  
  "ti-arrow-autofit-left" : {
    iconSet: 'tabler icons', code: "\uef34"
  },
  
  "ti-arrow-autofit-right" : {
    iconSet: 'tabler icons', code: "\uef35"
  },
  
  "ti-arrow-autofit-up" : {
    iconSet: 'tabler icons', code: "\uef36"
  },
  
  "ti-arrow-autofit-width" : {
    iconSet: 'tabler icons', code: "\uef37"
  },
  
  "ti-arrow-back" : {
    iconSet: 'tabler icons', code: "\uea0c"
  },
  
  "ti-arrow-back-up" : {
    iconSet: 'tabler icons', code: "\ueb77"
  },
  
  "ti-arrow-back-up-double" : {
    iconSet: 'tabler icons', code: "\uf9ec"
  },
  
  "ti-arrow-badge-down" : {
    iconSet: 'tabler icons', code: "\uf60b"
  },
  
  "ti-arrow-badge-down-filled" : {
    iconSet: 'tabler icons', code: "\uf7d6"
  },
  
  "ti-arrow-badge-left" : {
    iconSet: 'tabler icons', code: "\uf60c"
  },
  
  "ti-arrow-badge-left-filled" : {
    iconSet: 'tabler icons', code: "\uf7d7"
  },
  
  "ti-arrow-badge-right" : {
    iconSet: 'tabler icons', code: "\uf60d"
  },
  
  "ti-arrow-badge-right-filled" : {
    iconSet: 'tabler icons', code: "\uf7d8"
  },
  
  "ti-arrow-badge-up" : {
    iconSet: 'tabler icons', code: "\uf60e"
  },
  
  "ti-arrow-badge-up-filled" : {
    iconSet: 'tabler icons', code: "\uf7d9"
  },
  
  "ti-arrow-bar-down" : {
    iconSet: 'tabler icons', code: "\uea0d"
  },
  
  "ti-arrow-bar-left" : {
    iconSet: 'tabler icons', code: "\uea0e"
  },
  
  "ti-arrow-bar-right" : {
    iconSet: 'tabler icons', code: "\uea0f"
  },
  
  "ti-arrow-bar-to-down" : {
    iconSet: 'tabler icons', code: "\uec88"
  },
  
  "ti-arrow-bar-to-left" : {
    iconSet: 'tabler icons', code: "\uec89"
  },
  
  "ti-arrow-bar-to-right" : {
    iconSet: 'tabler icons', code: "\uec8a"
  },
  
  "ti-arrow-bar-to-up" : {
    iconSet: 'tabler icons', code: "\uec8b"
  },
  
  "ti-arrow-bar-up" : {
    iconSet: 'tabler icons', code: "\uea10"
  },
  
  "ti-arrow-bear-left" : {
    iconSet: 'tabler icons', code: "\uf045"
  },
  
  "ti-arrow-bear-left-2" : {
    iconSet: 'tabler icons', code: "\uf044"
  },
  
  "ti-arrow-bear-right" : {
    iconSet: 'tabler icons', code: "\uf047"
  },
  
  "ti-arrow-bear-right-2" : {
    iconSet: 'tabler icons', code: "\uf046"
  },
  
  "ti-arrow-big-down" : {
    iconSet: 'tabler icons', code: "\uedda"
  },
  
  "ti-arrow-big-down-filled" : {
    iconSet: 'tabler icons', code: "\uf6c6"
  },
  
  "ti-arrow-big-down-line" : {
    iconSet: 'tabler icons', code: "\uefe8"
  },
  
  "ti-arrow-big-down-line-filled" : {
    iconSet: 'tabler icons', code: "\uf6c7"
  },
  
  "ti-arrow-big-down-lines" : {
    iconSet: 'tabler icons', code: "\uefe9"
  },
  
  "ti-arrow-big-down-lines-filled" : {
    iconSet: 'tabler icons', code: "\uf6c8"
  },
  
  "ti-arrow-big-left" : {
    iconSet: 'tabler icons', code: "\ueddb"
  },
  
  "ti-arrow-big-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6c9"
  },
  
  "ti-arrow-big-left-line" : {
    iconSet: 'tabler icons', code: "\uefea"
  },
  
  "ti-arrow-big-left-line-filled" : {
    iconSet: 'tabler icons', code: "\uf6ca"
  },
  
  "ti-arrow-big-left-lines" : {
    iconSet: 'tabler icons', code: "\uefeb"
  },
  
  "ti-arrow-big-left-lines-filled" : {
    iconSet: 'tabler icons', code: "\uf6cb"
  },
  
  "ti-arrow-big-right" : {
    iconSet: 'tabler icons', code: "\ueddc"
  },
  
  "ti-arrow-big-right-filled" : {
    iconSet: 'tabler icons', code: "\uf6cc"
  },
  
  "ti-arrow-big-right-line" : {
    iconSet: 'tabler icons', code: "\uefec"
  },
  
  "ti-arrow-big-right-line-filled" : {
    iconSet: 'tabler icons', code: "\uf6cd"
  },
  
  "ti-arrow-big-right-lines" : {
    iconSet: 'tabler icons', code: "\uefed"
  },
  
  "ti-arrow-big-right-lines-filled" : {
    iconSet: 'tabler icons', code: "\uf6ce"
  },
  
  "ti-arrow-big-up" : {
    iconSet: 'tabler icons', code: "\ueddd"
  },
  
  "ti-arrow-big-up-filled" : {
    iconSet: 'tabler icons', code: "\uf6cf"
  },
  
  "ti-arrow-big-up-line" : {
    iconSet: 'tabler icons', code: "\uefee"
  },
  
  "ti-arrow-big-up-line-filled" : {
    iconSet: 'tabler icons', code: "\uf6d0"
  },
  
  "ti-arrow-big-up-lines" : {
    iconSet: 'tabler icons', code: "\uefef"
  },
  
  "ti-arrow-big-up-lines-filled" : {
    iconSet: 'tabler icons', code: "\uf6d1"
  },
  
  "ti-arrow-bounce" : {
    iconSet: 'tabler icons', code: "\uf3a4"
  },
  
  "ti-arrow-curve-left" : {
    iconSet: 'tabler icons', code: "\uf048"
  },
  
  "ti-arrow-curve-right" : {
    iconSet: 'tabler icons', code: "\uf049"
  },
  
  "ti-arrow-down" : {
    iconSet: 'tabler icons', code: "\uea16"
  },
  
  "ti-arrow-down-bar" : {
    iconSet: 'tabler icons', code: "\ued98"
  },
  
  "ti-arrow-down-circle" : {
    iconSet: 'tabler icons', code: "\uea11"
  },
  
  "ti-arrow-down-left" : {
    iconSet: 'tabler icons', code: "\uea13"
  },
  
  "ti-arrow-down-left-circle" : {
    iconSet: 'tabler icons', code: "\uea12"
  },
  
  "ti-arrow-down-rhombus" : {
    iconSet: 'tabler icons', code: "\uf61d"
  },
  
  "ti-arrow-down-right" : {
    iconSet: 'tabler icons', code: "\uea15"
  },
  
  "ti-arrow-down-right-circle" : {
    iconSet: 'tabler icons', code: "\uea14"
  },
  
  "ti-arrow-down-square" : {
    iconSet: 'tabler icons', code: "\ued9a"
  },
  
  "ti-arrow-down-tail" : {
    iconSet: 'tabler icons', code: "\ued9b"
  },
  
  "ti-arrow-elbow-left" : {
    iconSet: 'tabler icons', code: "\uf9ed"
  },
  
  "ti-arrow-elbow-right" : {
    iconSet: 'tabler icons', code: "\uf9ee"
  },
  
  "ti-arrow-fork" : {
    iconSet: 'tabler icons', code: "\uf04a"
  },
  
  "ti-arrow-forward" : {
    iconSet: 'tabler icons', code: "\uea17"
  },
  
  "ti-arrow-forward-up" : {
    iconSet: 'tabler icons', code: "\ueb78"
  },
  
  "ti-arrow-forward-up-double" : {
    iconSet: 'tabler icons', code: "\uf9ef"
  },
  
  "ti-arrow-guide" : {
    iconSet: 'tabler icons', code: "\uf22a"
  },
  
  "ti-arrow-iteration" : {
    iconSet: 'tabler icons', code: "\uf578"
  },
  
  "ti-arrow-left" : {
    iconSet: 'tabler icons', code: "\uea19"
  },
  
  "ti-arrow-left-bar" : {
    iconSet: 'tabler icons', code: "\ued9c"
  },
  
  "ti-arrow-left-circle" : {
    iconSet: 'tabler icons', code: "\uea18"
  },
  
  "ti-arrow-left-rhombus" : {
    iconSet: 'tabler icons', code: "\uf61e"
  },
  
  "ti-arrow-left-right" : {
    iconSet: 'tabler icons', code: "\uf04b"
  },
  
  "ti-arrow-left-square" : {
    iconSet: 'tabler icons', code: "\ued9d"
  },
  
  "ti-arrow-left-tail" : {
    iconSet: 'tabler icons', code: "\ued9e"
  },
  
  "ti-arrow-loop-left" : {
    iconSet: 'tabler icons', code: "\ued9f"
  },
  
  "ti-arrow-loop-left-2" : {
    iconSet: 'tabler icons', code: "\uf04c"
  },
  
  "ti-arrow-loop-right" : {
    iconSet: 'tabler icons', code: "\ueda0"
  },
  
  "ti-arrow-loop-right-2" : {
    iconSet: 'tabler icons', code: "\uf04d"
  },
  
  "ti-arrow-merge" : {
    iconSet: 'tabler icons', code: "\uf04e"
  },
  
  "ti-arrow-merge-both" : {
    iconSet: 'tabler icons', code: "\uf23b"
  },
  
  "ti-arrow-merge-left" : {
    iconSet: 'tabler icons', code: "\uf23c"
  },
  
  "ti-arrow-merge-right" : {
    iconSet: 'tabler icons', code: "\uf23d"
  },
  
  "ti-arrow-move-down" : {
    iconSet: 'tabler icons', code: "\uf2ba"
  },
  
  "ti-arrow-move-left" : {
    iconSet: 'tabler icons', code: "\uf2bb"
  },
  
  "ti-arrow-move-right" : {
    iconSet: 'tabler icons', code: "\uf2bc"
  },
  
  "ti-arrow-move-up" : {
    iconSet: 'tabler icons', code: "\uf2bd"
  },
  
  "ti-arrow-narrow-down" : {
    iconSet: 'tabler icons', code: "\uea1a"
  },
  
  "ti-arrow-narrow-left" : {
    iconSet: 'tabler icons', code: "\uea1b"
  },
  
  "ti-arrow-narrow-right" : {
    iconSet: 'tabler icons', code: "\uea1c"
  },
  
  "ti-arrow-narrow-up" : {
    iconSet: 'tabler icons', code: "\uea1d"
  },
  
  "ti-arrow-ramp-left" : {
    iconSet: 'tabler icons', code: "\ued3c"
  },
  
  "ti-arrow-ramp-left-2" : {
    iconSet: 'tabler icons', code: "\uf04f"
  },
  
  "ti-arrow-ramp-left-3" : {
    iconSet: 'tabler icons', code: "\uf050"
  },
  
  "ti-arrow-ramp-right" : {
    iconSet: 'tabler icons', code: "\ued3d"
  },
  
  "ti-arrow-ramp-right-2" : {
    iconSet: 'tabler icons', code: "\uf051"
  },
  
  "ti-arrow-ramp-right-3" : {
    iconSet: 'tabler icons', code: "\uf052"
  },
  
  "ti-arrow-right" : {
    iconSet: 'tabler icons', code: "\uea1f"
  },
  
  "ti-arrow-right-bar" : {
    iconSet: 'tabler icons', code: "\ueda1"
  },
  
  "ti-arrow-right-circle" : {
    iconSet: 'tabler icons', code: "\uea1e"
  },
  
  "ti-arrow-right-rhombus" : {
    iconSet: 'tabler icons', code: "\uf61f"
  },
  
  "ti-arrow-right-square" : {
    iconSet: 'tabler icons', code: "\ueda2"
  },
  
  "ti-arrow-right-tail" : {
    iconSet: 'tabler icons', code: "\ueda3"
  },
  
  "ti-arrow-rotary-first-left" : {
    iconSet: 'tabler icons', code: "\uf053"
  },
  
  "ti-arrow-rotary-first-right" : {
    iconSet: 'tabler icons', code: "\uf054"
  },
  
  "ti-arrow-rotary-last-left" : {
    iconSet: 'tabler icons', code: "\uf055"
  },
  
  "ti-arrow-rotary-last-right" : {
    iconSet: 'tabler icons', code: "\uf056"
  },
  
  "ti-arrow-rotary-left" : {
    iconSet: 'tabler icons', code: "\uf057"
  },
  
  "ti-arrow-rotary-right" : {
    iconSet: 'tabler icons', code: "\uf058"
  },
  
  "ti-arrow-rotary-straight" : {
    iconSet: 'tabler icons', code: "\uf059"
  },
  
  "ti-arrow-roundabout-left" : {
    iconSet: 'tabler icons', code: "\uf22b"
  },
  
  "ti-arrow-roundabout-right" : {
    iconSet: 'tabler icons', code: "\uf22c"
  },
  
  "ti-arrow-sharp-turn-left" : {
    iconSet: 'tabler icons', code: "\uf05a"
  },
  
  "ti-arrow-sharp-turn-right" : {
    iconSet: 'tabler icons', code: "\uf05b"
  },
  
  "ti-arrow-up" : {
    iconSet: 'tabler icons', code: "\uea25"
  },
  
  "ti-arrow-up-bar" : {
    iconSet: 'tabler icons', code: "\ueda4"
  },
  
  "ti-arrow-up-circle" : {
    iconSet: 'tabler icons', code: "\uea20"
  },
  
  "ti-arrow-up-left" : {
    iconSet: 'tabler icons', code: "\uea22"
  },
  
  "ti-arrow-up-left-circle" : {
    iconSet: 'tabler icons', code: "\uea21"
  },
  
  "ti-arrow-up-rhombus" : {
    iconSet: 'tabler icons', code: "\uf620"
  },
  
  "ti-arrow-up-right" : {
    iconSet: 'tabler icons', code: "\uea24"
  },
  
  "ti-arrow-up-right-circle" : {
    iconSet: 'tabler icons', code: "\uea23"
  },
  
  "ti-arrow-up-square" : {
    iconSet: 'tabler icons', code: "\ueda6"
  },
  
  "ti-arrow-up-tail" : {
    iconSet: 'tabler icons', code: "\ueda7"
  },
  
  "ti-arrow-wave-left-down" : {
    iconSet: 'tabler icons', code: "\ueda8"
  },
  
  "ti-arrow-wave-left-up" : {
    iconSet: 'tabler icons', code: "\ueda9"
  },
  
  "ti-arrow-wave-right-down" : {
    iconSet: 'tabler icons', code: "\uedaa"
  },
  
  "ti-arrow-wave-right-up" : {
    iconSet: 'tabler icons', code: "\uedab"
  },
  
  "ti-arrow-zig-zag" : {
    iconSet: 'tabler icons', code: "\uf4a7"
  },
  
  "ti-arrows-cross" : {
    iconSet: 'tabler icons', code: "\ueffe"
  },
  
  "ti-arrows-diagonal" : {
    iconSet: 'tabler icons', code: "\uea27"
  },
  
  "ti-arrows-diagonal-2" : {
    iconSet: 'tabler icons', code: "\uea26"
  },
  
  "ti-arrows-diagonal-minimize" : {
    iconSet: 'tabler icons', code: "\uef39"
  },
  
  "ti-arrows-diagonal-minimize-2" : {
    iconSet: 'tabler icons', code: "\uef38"
  },
  
  "ti-arrows-diff" : {
    iconSet: 'tabler icons', code: "\uf296"
  },
  
  "ti-arrows-double-ne-sw" : {
    iconSet: 'tabler icons', code: "\uedde"
  },
  
  "ti-arrows-double-nw-se" : {
    iconSet: 'tabler icons', code: "\ueddf"
  },
  
  "ti-arrows-double-se-nw" : {
    iconSet: 'tabler icons', code: "\uede0"
  },
  
  "ti-arrows-double-sw-ne" : {
    iconSet: 'tabler icons', code: "\uede1"
  },
  
  "ti-arrows-down" : {
    iconSet: 'tabler icons', code: "\uedad"
  },
  
  "ti-arrows-down-up" : {
    iconSet: 'tabler icons', code: "\uedac"
  },
  
  "ti-arrows-exchange" : {
    iconSet: 'tabler icons', code: "\uf1f4"
  },
  
  "ti-arrows-exchange-2" : {
    iconSet: 'tabler icons', code: "\uf1f3"
  },
  
  "ti-arrows-horizontal" : {
    iconSet: 'tabler icons', code: "\ueb59"
  },
  
  "ti-arrows-join" : {
    iconSet: 'tabler icons', code: "\uedaf"
  },
  
  "ti-arrows-join-2" : {
    iconSet: 'tabler icons', code: "\uedae"
  },
  
  "ti-arrows-left" : {
    iconSet: 'tabler icons', code: "\uedb1"
  },
  
  "ti-arrows-left-down" : {
    iconSet: 'tabler icons', code: "\uee00"
  },
  
  "ti-arrows-left-right" : {
    iconSet: 'tabler icons', code: "\uedb0"
  },
  
  "ti-arrows-maximize" : {
    iconSet: 'tabler icons', code: "\uea28"
  },
  
  "ti-arrows-minimize" : {
    iconSet: 'tabler icons', code: "\uea29"
  },
  
  "ti-arrows-move" : {
    iconSet: 'tabler icons', code: "\uf22f"
  },
  
  "ti-arrows-move-horizontal" : {
    iconSet: 'tabler icons', code: "\uf22d"
  },
  
  "ti-arrows-move-vertical" : {
    iconSet: 'tabler icons', code: "\uf22e"
  },
  
  "ti-arrows-random" : {
    iconSet: 'tabler icons', code: "\uf095"
  },
  
  "ti-arrows-right" : {
    iconSet: 'tabler icons', code: "\uedb3"
  },
  
  "ti-arrows-right-down" : {
    iconSet: 'tabler icons', code: "\uee01"
  },
  
  "ti-arrows-right-left" : {
    iconSet: 'tabler icons', code: "\uedb2"
  },
  
  "ti-arrows-shuffle" : {
    iconSet: 'tabler icons', code: "\uf000"
  },
  
  "ti-arrows-shuffle-2" : {
    iconSet: 'tabler icons', code: "\uefff"
  },
  
  "ti-arrows-sort" : {
    iconSet: 'tabler icons', code: "\ueb5a"
  },
  
  "ti-arrows-split" : {
    iconSet: 'tabler icons', code: "\uedb5"
  },
  
  "ti-arrows-split-2" : {
    iconSet: 'tabler icons', code: "\uedb4"
  },
  
  "ti-arrows-transfer-down" : {
    iconSet: 'tabler icons', code: "\uf2cc"
  },
  
  "ti-arrows-transfer-up" : {
    iconSet: 'tabler icons', code: "\uf2cd"
  },
  
  "ti-arrows-up" : {
    iconSet: 'tabler icons', code: "\uedb7"
  },
  
  "ti-arrows-up-down" : {
    iconSet: 'tabler icons', code: "\uedb6"
  },
  
  "ti-arrows-up-left" : {
    iconSet: 'tabler icons', code: "\uee02"
  },
  
  "ti-arrows-up-right" : {
    iconSet: 'tabler icons', code: "\uee03"
  },
  
  "ti-arrows-vertical" : {
    iconSet: 'tabler icons', code: "\ueb5b"
  },
  
  "ti-artboard" : {
    iconSet: 'tabler icons', code: "\uea2a"
  },
  
  "ti-artboard-off" : {
    iconSet: 'tabler icons', code: "\uf0ae"
  },
  
  "ti-article" : {
    iconSet: 'tabler icons', code: "\uf1e2"
  },
  
  "ti-article-filled-filled" : {
    iconSet: 'tabler icons', code: "\uf7da"
  },
  
  "ti-article-off" : {
    iconSet: 'tabler icons', code: "\uf3bf"
  },
  
  "ti-aspect-ratio" : {
    iconSet: 'tabler icons', code: "\ued30"
  },
  
  "ti-aspect-ratio-filled" : {
    iconSet: 'tabler icons', code: "\uf7db"
  },
  
  "ti-aspect-ratio-off" : {
    iconSet: 'tabler icons', code: "\uf0af"
  },
  
  "ti-assembly" : {
    iconSet: 'tabler icons', code: "\uf24d"
  },
  
  "ti-assembly-off" : {
    iconSet: 'tabler icons', code: "\uf3c0"
  },
  
  "ti-asset" : {
    iconSet: 'tabler icons', code: "\uf1ce"
  },
  
  "ti-asterisk" : {
    iconSet: 'tabler icons', code: "\uefd5"
  },
  
  "ti-asterisk-simple" : {
    iconSet: 'tabler icons', code: "\uefd4"
  },
  
  "ti-at" : {
    iconSet: 'tabler icons', code: "\uea2b"
  },
  
  "ti-at-off" : {
    iconSet: 'tabler icons', code: "\uf0b0"
  },
  
  "ti-atom" : {
    iconSet: 'tabler icons', code: "\ueb79"
  },
  
  "ti-atom-2" : {
    iconSet: 'tabler icons', code: "\uebdf"
  },
  
  "ti-atom-2-filled" : {
    iconSet: 'tabler icons', code: "\uf71b"
  },
  
  "ti-atom-off" : {
    iconSet: 'tabler icons', code: "\uf0f9"
  },
  
  "ti-augmented-reality" : {
    iconSet: 'tabler icons', code: "\uf023"
  },
  
  "ti-augmented-reality-2" : {
    iconSet: 'tabler icons', code: "\uf37e"
  },
  
  "ti-augmented-reality-off" : {
    iconSet: 'tabler icons', code: "\uf3c1"
  },
  
  "ti-award" : {
    iconSet: 'tabler icons', code: "\uea2c"
  },
  
  "ti-award-filled" : {
    iconSet: 'tabler icons', code: "\uf71c"
  },
  
  "ti-award-off" : {
    iconSet: 'tabler icons', code: "\uf0fa"
  },
  
  "ti-axe" : {
    iconSet: 'tabler icons', code: "\uef9f"
  },
  
  "ti-axis-x" : {
    iconSet: 'tabler icons', code: "\uef45"
  },
  
  "ti-axis-y" : {
    iconSet: 'tabler icons', code: "\uef46"
  },
  
  "ti-baby-bottle" : {
    iconSet: 'tabler icons', code: "\uf5d2"
  },
  
  "ti-baby-carriage" : {
    iconSet: 'tabler icons', code: "\uf05d"
  },
  
  "ti-backhoe" : {
    iconSet: 'tabler icons', code: "\ued86"
  },
  
  "ti-backpack" : {
    iconSet: 'tabler icons', code: "\uef47"
  },
  
  "ti-backpack-off" : {
    iconSet: 'tabler icons', code: "\uf3c2"
  },
  
  "ti-backspace" : {
    iconSet: 'tabler icons', code: "\uea2d"
  },
  
  "ti-backspace-filled" : {
    iconSet: 'tabler icons', code: "\uf7dc"
  },
  
  "ti-badge" : {
    iconSet: 'tabler icons', code: "\uefc2"
  },
  
  "ti-badge-3d" : {
    iconSet: 'tabler icons', code: "\uf555"
  },
  
  "ti-badge-4k" : {
    iconSet: 'tabler icons', code: "\uf556"
  },
  
  "ti-badge-8k" : {
    iconSet: 'tabler icons', code: "\uf557"
  },
  
  "ti-badge-ad" : {
    iconSet: 'tabler icons', code: "\uf558"
  },
  
  "ti-badge-ar" : {
    iconSet: 'tabler icons', code: "\uf559"
  },
  
  "ti-badge-cc" : {
    iconSet: 'tabler icons', code: "\uf55a"
  },
  
  "ti-badge-filled" : {
    iconSet: 'tabler icons', code: "\uf667"
  },
  
  "ti-badge-hd" : {
    iconSet: 'tabler icons', code: "\uf55b"
  },
  
  "ti-badge-off" : {
    iconSet: 'tabler icons', code: "\uf0fb"
  },
  
  "ti-badge-sd" : {
    iconSet: 'tabler icons', code: "\uf55c"
  },
  
  "ti-badge-tm" : {
    iconSet: 'tabler icons', code: "\uf55d"
  },
  
  "ti-badge-vo" : {
    iconSet: 'tabler icons', code: "\uf55e"
  },
  
  "ti-badge-vr" : {
    iconSet: 'tabler icons', code: "\uf55f"
  },
  
  "ti-badge-wc" : {
    iconSet: 'tabler icons', code: "\uf560"
  },
  
  "ti-badges" : {
    iconSet: 'tabler icons', code: "\uefc3"
  },
  
  "ti-badges-filled" : {
    iconSet: 'tabler icons', code: "\uf7dd"
  },
  
  "ti-badges-off" : {
    iconSet: 'tabler icons', code: "\uf0fc"
  },
  
  "ti-baguette" : {
    iconSet: 'tabler icons', code: "\uf3a5"
  },
  
  "ti-ball-american-football" : {
    iconSet: 'tabler icons', code: "\uee04"
  },
  
  "ti-ball-american-football-off" : {
    iconSet: 'tabler icons', code: "\uf3c3"
  },
  
  "ti-ball-baseball" : {
    iconSet: 'tabler icons', code: "\uefa0"
  },
  
  "ti-ball-basketball" : {
    iconSet: 'tabler icons', code: "\uec28"
  },
  
  "ti-ball-bowling" : {
    iconSet: 'tabler icons', code: "\uec29"
  },
  
  "ti-ball-football" : {
    iconSet: 'tabler icons', code: "\uee06"
  },
  
  "ti-ball-football-off" : {
    iconSet: 'tabler icons', code: "\uee05"
  },
  
  "ti-ball-tennis" : {
    iconSet: 'tabler icons', code: "\uec2a"
  },
  
  "ti-ball-volleyball" : {
    iconSet: 'tabler icons', code: "\uec2b"
  },
  
  "ti-balloon" : {
    iconSet: 'tabler icons', code: "\uef3a"
  },
  
  "ti-balloon-off" : {
    iconSet: 'tabler icons', code: "\uf0fd"
  },
  
  "ti-ballpen" : {
    iconSet: 'tabler icons', code: "\uf06e"
  },
  
  "ti-ballpen-off" : {
    iconSet: 'tabler icons', code: "\uf0b1"
  },
  
  "ti-ban" : {
    iconSet: 'tabler icons', code: "\uea2e"
  },
  
  "ti-bandage" : {
    iconSet: 'tabler icons', code: "\ueb7a"
  },
  
  "ti-bandage-filled" : {
    iconSet: 'tabler icons', code: "\uf7de"
  },
  
  "ti-bandage-off" : {
    iconSet: 'tabler icons', code: "\uf3c4"
  },
  
  "ti-barbell" : {
    iconSet: 'tabler icons', code: "\ueff0"
  },
  
  "ti-barbell-off" : {
    iconSet: 'tabler icons', code: "\uf0b2"
  },
  
  "ti-barcode" : {
    iconSet: 'tabler icons', code: "\uebc6"
  },
  
  "ti-barcode-off" : {
    iconSet: 'tabler icons', code: "\uf0b3"
  },
  
  "ti-barrel" : {
    iconSet: 'tabler icons', code: "\uf0b4"
  },
  
  "ti-barrel-off" : {
    iconSet: 'tabler icons', code: "\uf0fe"
  },
  
  "ti-barrier-block" : {
    iconSet: 'tabler icons', code: "\uf00e"
  },
  
  "ti-barrier-block-off" : {
    iconSet: 'tabler icons', code: "\uf0b5"
  },
  
  "ti-baseline" : {
    iconSet: 'tabler icons', code: "\uf024"
  },
  
  "ti-baseline-density-large" : {
    iconSet: 'tabler icons', code: "\uf9f0"
  },
  
  "ti-baseline-density-medium" : {
    iconSet: 'tabler icons', code: "\uf9f1"
  },
  
  "ti-baseline-density-small" : {
    iconSet: 'tabler icons', code: "\uf9f2"
  },
  
  "ti-basket" : {
    iconSet: 'tabler icons', code: "\uebe1"
  },
  
  "ti-basket-filled" : {
    iconSet: 'tabler icons', code: "\uf7df"
  },
  
  "ti-basket-off" : {
    iconSet: 'tabler icons', code: "\uf0b6"
  },
  
  "ti-bat" : {
    iconSet: 'tabler icons', code: "\uf284"
  },
  
  "ti-bath" : {
    iconSet: 'tabler icons', code: "\uef48"
  },
  
  "ti-bath-filled" : {
    iconSet: 'tabler icons', code: "\uf71d"
  },
  
  "ti-bath-off" : {
    iconSet: 'tabler icons', code: "\uf0ff"
  },
  
  "ti-battery" : {
    iconSet: 'tabler icons', code: "\uea34"
  },
  
  "ti-battery-1" : {
    iconSet: 'tabler icons', code: "\uea2f"
  },
  
  "ti-battery-1-filled" : {
    iconSet: 'tabler icons', code: "\uf71e"
  },
  
  "ti-battery-2" : {
    iconSet: 'tabler icons', code: "\uea30"
  },
  
  "ti-battery-2-filled" : {
    iconSet: 'tabler icons', code: "\uf71f"
  },
  
  "ti-battery-3" : {
    iconSet: 'tabler icons', code: "\uea31"
  },
  
  "ti-battery-3-filled" : {
    iconSet: 'tabler icons', code: "\uf720"
  },
  
  "ti-battery-4" : {
    iconSet: 'tabler icons', code: "\uea32"
  },
  
  "ti-battery-4-filled" : {
    iconSet: 'tabler icons', code: "\uf721"
  },
  
  "ti-battery-automotive" : {
    iconSet: 'tabler icons', code: "\uee07"
  },
  
  "ti-battery-charging" : {
    iconSet: 'tabler icons', code: "\uea33"
  },
  
  "ti-battery-charging-2" : {
    iconSet: 'tabler icons', code: "\uef3b"
  },
  
  "ti-battery-eco" : {
    iconSet: 'tabler icons', code: "\uef3c"
  },
  
  "ti-battery-filled" : {
    iconSet: 'tabler icons', code: "\uf668"
  },
  
  "ti-battery-off" : {
    iconSet: 'tabler icons', code: "\ued1c"
  },
  
  "ti-beach" : {
    iconSet: 'tabler icons', code: "\uef3d"
  },
  
  "ti-beach-off" : {
    iconSet: 'tabler icons', code: "\uf0b7"
  },
  
  "ti-bed" : {
    iconSet: 'tabler icons', code: "\ueb5c"
  },
  
  "ti-bed-filled" : {
    iconSet: 'tabler icons', code: "\uf7e0"
  },
  
  "ti-bed-off" : {
    iconSet: 'tabler icons', code: "\uf100"
  },
  
  "ti-beer" : {
    iconSet: 'tabler icons', code: "\uefa1"
  },
  
  "ti-beer-filled" : {
    iconSet: 'tabler icons', code: "\uf7e1"
  },
  
  "ti-beer-off" : {
    iconSet: 'tabler icons', code: "\uf101"
  },
  
  "ti-bell" : {
    iconSet: 'tabler icons', code: "\uea35"
  },
  
  "ti-bell-bolt" : {
    iconSet: 'tabler icons', code: "\uf812"
  },
  
  "ti-bell-cancel" : {
    iconSet: 'tabler icons', code: "\uf813"
  },
  
  "ti-bell-check" : {
    iconSet: 'tabler icons', code: "\uf814"
  },
  
  "ti-bell-code" : {
    iconSet: 'tabler icons', code: "\uf815"
  },
  
  "ti-bell-cog" : {
    iconSet: 'tabler icons', code: "\uf816"
  },
  
  "ti-bell-dollar" : {
    iconSet: 'tabler icons', code: "\uf817"
  },
  
  "ti-bell-down" : {
    iconSet: 'tabler icons', code: "\uf818"
  },
  
  "ti-bell-exclamation" : {
    iconSet: 'tabler icons', code: "\uf819"
  },
  
  "ti-bell-filled" : {
    iconSet: 'tabler icons', code: "\uf669"
  },
  
  "ti-bell-heart" : {
    iconSet: 'tabler icons', code: "\uf81a"
  },
  
  "ti-bell-minus" : {
    iconSet: 'tabler icons', code: "\uede2"
  },
  
  "ti-bell-minus-filled" : {
    iconSet: 'tabler icons', code: "\uf722"
  },
  
  "ti-bell-off" : {
    iconSet: 'tabler icons', code: "\uece9"
  },
  
  "ti-bell-pause" : {
    iconSet: 'tabler icons', code: "\uf81b"
  },
  
  "ti-bell-pin" : {
    iconSet: 'tabler icons', code: "\uf81c"
  },
  
  "ti-bell-plus" : {
    iconSet: 'tabler icons', code: "\uede3"
  },
  
  "ti-bell-plus-filled" : {
    iconSet: 'tabler icons', code: "\uf723"
  },
  
  "ti-bell-question" : {
    iconSet: 'tabler icons', code: "\uf81d"
  },
  
  "ti-bell-ringing" : {
    iconSet: 'tabler icons', code: "\ued07"
  },
  
  "ti-bell-ringing-2" : {
    iconSet: 'tabler icons', code: "\uede4"
  },
  
  "ti-bell-ringing-2-filled" : {
    iconSet: 'tabler icons', code: "\uf724"
  },
  
  "ti-bell-ringing-filled" : {
    iconSet: 'tabler icons', code: "\uf725"
  },
  
  "ti-bell-school" : {
    iconSet: 'tabler icons', code: "\uf05e"
  },
  
  "ti-bell-search" : {
    iconSet: 'tabler icons', code: "\uf81e"
  },
  
  "ti-bell-share" : {
    iconSet: 'tabler icons', code: "\uf81f"
  },
  
  "ti-bell-star" : {
    iconSet: 'tabler icons', code: "\uf820"
  },
  
  "ti-bell-up" : {
    iconSet: 'tabler icons', code: "\uf821"
  },
  
  "ti-bell-x" : {
    iconSet: 'tabler icons', code: "\uede5"
  },
  
  "ti-bell-x-filled" : {
    iconSet: 'tabler icons', code: "\uf726"
  },
  
  "ti-bell-z" : {
    iconSet: 'tabler icons', code: "\ueff1"
  },
  
  "ti-bell-z-filled" : {
    iconSet: 'tabler icons', code: "\uf727"
  },
  
  "ti-beta" : {
    iconSet: 'tabler icons', code: "\uf544"
  },
  
  "ti-bible" : {
    iconSet: 'tabler icons', code: "\uefc4"
  },
  
  "ti-bike" : {
    iconSet: 'tabler icons', code: "\uea36"
  },
  
  "ti-bike-off" : {
    iconSet: 'tabler icons', code: "\uf0b8"
  },
  
  "ti-binary" : {
    iconSet: 'tabler icons', code: "\uee08"
  },
  
  "ti-binary-off" : {
    iconSet: 'tabler icons', code: "\uf3c5"
  },
  
  "ti-binary-tree" : {
    iconSet: 'tabler icons', code: "\uf5d4"
  },
  
  "ti-binary-tree-2" : {
    iconSet: 'tabler icons', code: "\uf5d3"
  },
  
  "ti-biohazard" : {
    iconSet: 'tabler icons', code: "\uecb8"
  },
  
  "ti-biohazard-off" : {
    iconSet: 'tabler icons', code: "\uf0b9"
  },
  
  "ti-blade" : {
    iconSet: 'tabler icons', code: "\uf4bd"
  },
  
  "ti-blade-filled" : {
    iconSet: 'tabler icons', code: "\uf7e2"
  },
  
  "ti-bleach" : {
    iconSet: 'tabler icons', code: "\uf2f3"
  },
  
  "ti-bleach-chlorine" : {
    iconSet: 'tabler icons', code: "\uf2f0"
  },
  
  "ti-bleach-no-chlorine" : {
    iconSet: 'tabler icons', code: "\uf2f1"
  },
  
  "ti-bleach-off" : {
    iconSet: 'tabler icons', code: "\uf2f2"
  },
  
  "ti-blockquote" : {
    iconSet: 'tabler icons', code: "\uee09"
  },
  
  "ti-bluetooth" : {
    iconSet: 'tabler icons', code: "\uea37"
  },
  
  "ti-bluetooth-connected" : {
    iconSet: 'tabler icons', code: "\uecea"
  },
  
  "ti-bluetooth-off" : {
    iconSet: 'tabler icons', code: "\ueceb"
  },
  
  "ti-bluetooth-x" : {
    iconSet: 'tabler icons', code: "\uf081"
  },
  
  "ti-blur" : {
    iconSet: 'tabler icons', code: "\uef8c"
  },
  
  "ti-blur-off" : {
    iconSet: 'tabler icons', code: "\uf3c6"
  },
  
  "ti-bmp" : {
    iconSet: 'tabler icons', code: "\uf3a6"
  },
  
  "ti-bold" : {
    iconSet: 'tabler icons', code: "\ueb7b"
  },
  
  "ti-bold-off" : {
    iconSet: 'tabler icons', code: "\uf0ba"
  },
  
  "ti-bolt" : {
    iconSet: 'tabler icons', code: "\uea38"
  },
  
  "ti-bolt-off" : {
    iconSet: 'tabler icons', code: "\uecec"
  },
  
  "ti-bomb" : {
    iconSet: 'tabler icons', code: "\uf59c"
  },
  
  "ti-bone" : {
    iconSet: 'tabler icons', code: "\uedb8"
  },
  
  "ti-bone-off" : {
    iconSet: 'tabler icons', code: "\uf0bb"
  },
  
  "ti-bong" : {
    iconSet: 'tabler icons', code: "\uf3a7"
  },
  
  "ti-bong-off" : {
    iconSet: 'tabler icons', code: "\uf3c7"
  },
  
  "ti-book" : {
    iconSet: 'tabler icons', code: "\uea39"
  },
  
  "ti-book-2" : {
    iconSet: 'tabler icons', code: "\uefc5"
  },
  
  "ti-book-download" : {
    iconSet: 'tabler icons', code: "\uf070"
  },
  
  "ti-book-off" : {
    iconSet: 'tabler icons', code: "\uf0bc"
  },
  
  "ti-book-upload" : {
    iconSet: 'tabler icons', code: "\uf071"
  },
  
  "ti-bookmark" : {
    iconSet: 'tabler icons', code: "\uea3a"
  },
  
  "ti-bookmark-off" : {
    iconSet: 'tabler icons', code: "\ueced"
  },
  
  "ti-bookmarks" : {
    iconSet: 'tabler icons', code: "\ued08"
  },
  
  "ti-bookmarks-off" : {
    iconSet: 'tabler icons', code: "\uf0bd"
  },
  
  "ti-books" : {
    iconSet: 'tabler icons', code: "\ueff2"
  },
  
  "ti-books-off" : {
    iconSet: 'tabler icons', code: "\uf0be"
  },
  
  "ti-border-all" : {
    iconSet: 'tabler icons', code: "\uea3b"
  },
  
  "ti-border-bottom" : {
    iconSet: 'tabler icons', code: "\uea3c"
  },
  
  "ti-border-corners" : {
    iconSet: 'tabler icons', code: "\uf7a0"
  },
  
  "ti-border-horizontal" : {
    iconSet: 'tabler icons', code: "\uea3d"
  },
  
  "ti-border-inner" : {
    iconSet: 'tabler icons', code: "\uea3e"
  },
  
  "ti-border-left" : {
    iconSet: 'tabler icons', code: "\uea3f"
  },
  
  "ti-border-none" : {
    iconSet: 'tabler icons', code: "\uea40"
  },
  
  "ti-border-outer" : {
    iconSet: 'tabler icons', code: "\uea41"
  },
  
  "ti-border-radius" : {
    iconSet: 'tabler icons', code: "\ueb7c"
  },
  
  "ti-border-right" : {
    iconSet: 'tabler icons', code: "\uea42"
  },
  
  "ti-border-sides" : {
    iconSet: 'tabler icons', code: "\uf7a1"
  },
  
  "ti-border-style" : {
    iconSet: 'tabler icons', code: "\uee0a"
  },
  
  "ti-border-style-2" : {
    iconSet: 'tabler icons', code: "\uef22"
  },
  
  "ti-border-top" : {
    iconSet: 'tabler icons', code: "\uea43"
  },
  
  "ti-border-vertical" : {
    iconSet: 'tabler icons', code: "\uea44"
  },
  
  "ti-bottle" : {
    iconSet: 'tabler icons', code: "\uef0b"
  },
  
  "ti-bottle-off" : {
    iconSet: 'tabler icons', code: "\uf3c8"
  },
  
  "ti-bounce-left" : {
    iconSet: 'tabler icons', code: "\uf59d"
  },
  
  "ti-bounce-right" : {
    iconSet: 'tabler icons', code: "\uf59e"
  },
  
  "ti-bow" : {
    iconSet: 'tabler icons', code: "\uf096"
  },
  
  "ti-bowl" : {
    iconSet: 'tabler icons', code: "\uf4fa"
  },
  
  "ti-box" : {
    iconSet: 'tabler icons', code: "\uea45"
  },
  
  "ti-box-align-bottom" : {
    iconSet: 'tabler icons', code: "\uf2a8"
  },
  
  "ti-box-align-bottom-left" : {
    iconSet: 'tabler icons', code: "\uf2ce"
  },
  
  "ti-box-align-bottom-right" : {
    iconSet: 'tabler icons', code: "\uf2cf"
  },
  
  "ti-box-align-left" : {
    iconSet: 'tabler icons', code: "\uf2a9"
  },
  
  "ti-box-align-right" : {
    iconSet: 'tabler icons', code: "\uf2aa"
  },
  
  "ti-box-align-top" : {
    iconSet: 'tabler icons', code: "\uf2ab"
  },
  
  "ti-box-align-top-left" : {
    iconSet: 'tabler icons', code: "\uf2d0"
  },
  
  "ti-box-align-top-right" : {
    iconSet: 'tabler icons', code: "\uf2d1"
  },
  
  "ti-box-margin" : {
    iconSet: 'tabler icons', code: "\uee0b"
  },
  
  "ti-box-model" : {
    iconSet: 'tabler icons', code: "\uee0c"
  },
  
  "ti-box-model-2" : {
    iconSet: 'tabler icons', code: "\uef23"
  },
  
  "ti-box-model-2-off" : {
    iconSet: 'tabler icons', code: "\uf3c9"
  },
  
  "ti-box-model-off" : {
    iconSet: 'tabler icons', code: "\uf3ca"
  },
  
  "ti-box-multiple" : {
    iconSet: 'tabler icons', code: "\uee17"
  },
  
  "ti-box-multiple-0" : {
    iconSet: 'tabler icons', code: "\uee0d"
  },
  
  "ti-box-multiple-1" : {
    iconSet: 'tabler icons', code: "\uee0e"
  },
  
  "ti-box-multiple-2" : {
    iconSet: 'tabler icons', code: "\uee0f"
  },
  
  "ti-box-multiple-3" : {
    iconSet: 'tabler icons', code: "\uee10"
  },
  
  "ti-box-multiple-4" : {
    iconSet: 'tabler icons', code: "\uee11"
  },
  
  "ti-box-multiple-5" : {
    iconSet: 'tabler icons', code: "\uee12"
  },
  
  "ti-box-multiple-6" : {
    iconSet: 'tabler icons', code: "\uee13"
  },
  
  "ti-box-multiple-7" : {
    iconSet: 'tabler icons', code: "\uee14"
  },
  
  "ti-box-multiple-8" : {
    iconSet: 'tabler icons', code: "\uee15"
  },
  
  "ti-box-multiple-9" : {
    iconSet: 'tabler icons', code: "\uee16"
  },
  
  "ti-box-off" : {
    iconSet: 'tabler icons', code: "\uf102"
  },
  
  "ti-box-padding" : {
    iconSet: 'tabler icons', code: "\uee18"
  },
  
  "ti-box-seam" : {
    iconSet: 'tabler icons', code: "\uf561"
  },
  
  "ti-braces" : {
    iconSet: 'tabler icons', code: "\uebcc"
  },
  
  "ti-braces-off" : {
    iconSet: 'tabler icons', code: "\uf0bf"
  },
  
  "ti-brackets" : {
    iconSet: 'tabler icons', code: "\uebcd"
  },
  
  "ti-brackets-contain" : {
    iconSet: 'tabler icons', code: "\uf1e5"
  },
  
  "ti-brackets-contain-end" : {
    iconSet: 'tabler icons', code: "\uf1e3"
  },
  
  "ti-brackets-contain-start" : {
    iconSet: 'tabler icons', code: "\uf1e4"
  },
  
  "ti-brackets-off" : {
    iconSet: 'tabler icons', code: "\uf0c0"
  },
  
  "ti-braille" : {
    iconSet: 'tabler icons', code: "\uf545"
  },
  
  "ti-brain" : {
    iconSet: 'tabler icons', code: "\uf59f"
  },
  
  "ti-brand-4chan" : {
    iconSet: 'tabler icons', code: "\uf494"
  },
  
  "ti-brand-abstract" : {
    iconSet: 'tabler icons', code: "\uf495"
  },
  
  "ti-brand-adobe" : {
    iconSet: 'tabler icons', code: "\uf0dc"
  },
  
  "ti-brand-adonis-js" : {
    iconSet: 'tabler icons', code: "\uf496"
  },
  
  "ti-brand-airbnb" : {
    iconSet: 'tabler icons', code: "\ued68"
  },
  
  "ti-brand-airtable" : {
    iconSet: 'tabler icons', code: "\uef6a"
  },
  
  "ti-brand-algolia" : {
    iconSet: 'tabler icons', code: "\uf390"
  },
  
  "ti-brand-alipay" : {
    iconSet: 'tabler icons', code: "\uf7a2"
  },
  
  "ti-brand-alpine-js" : {
    iconSet: 'tabler icons', code: "\uf324"
  },
  
  "ti-brand-amazon" : {
    iconSet: 'tabler icons', code: "\uf230"
  },
  
  "ti-brand-amd" : {
    iconSet: 'tabler icons', code: "\uf653"
  },
  
  "ti-brand-amigo" : {
    iconSet: 'tabler icons', code: "\uf5f9"
  },
  
  "ti-brand-among-us" : {
    iconSet: 'tabler icons', code: "\uf205"
  },
  
  "ti-brand-android" : {
    iconSet: 'tabler icons', code: "\uec16"
  },
  
  "ti-brand-angular" : {
    iconSet: 'tabler icons', code: "\uef6b"
  },
  
  "ti-brand-ao3" : {
    iconSet: 'tabler icons', code: "\uf5e8"
  },
  
  "ti-brand-appgallery" : {
    iconSet: 'tabler icons', code: "\uf231"
  },
  
  "ti-brand-apple" : {
    iconSet: 'tabler icons', code: "\uec17"
  },
  
  "ti-brand-apple-arcade" : {
    iconSet: 'tabler icons', code: "\ued69"
  },
  
  "ti-brand-apple-podcast" : {
    iconSet: 'tabler icons', code: "\uf1e6"
  },
  
  "ti-brand-appstore" : {
    iconSet: 'tabler icons', code: "\ued24"
  },
  
  "ti-brand-asana" : {
    iconSet: 'tabler icons', code: "\uedc5"
  },
  
  "ti-brand-backbone" : {
    iconSet: 'tabler icons', code: "\uf325"
  },
  
  "ti-brand-badoo" : {
    iconSet: 'tabler icons', code: "\uf206"
  },
  
  "ti-brand-baidu" : {
    iconSet: 'tabler icons', code: "\uf5e9"
  },
  
  "ti-brand-bandcamp" : {
    iconSet: 'tabler icons', code: "\uf207"
  },
  
  "ti-brand-bandlab" : {
    iconSet: 'tabler icons', code: "\uf5fa"
  },
  
  "ti-brand-beats" : {
    iconSet: 'tabler icons', code: "\uf208"
  },
  
  "ti-brand-behance" : {
    iconSet: 'tabler icons', code: "\uec6e"
  },
  
  "ti-brand-bilibili" : {
    iconSet: 'tabler icons', code: "\uf6d2"
  },
  
  "ti-brand-binance" : {
    iconSet: 'tabler icons', code: "\uf5a0"
  },
  
  "ti-brand-bing" : {
    iconSet: 'tabler icons', code: "\uedc6"
  },
  
  "ti-brand-bitbucket" : {
    iconSet: 'tabler icons', code: "\uedc7"
  },
  
  "ti-brand-blackberry" : {
    iconSet: 'tabler icons', code: "\uf568"
  },
  
  "ti-brand-blender" : {
    iconSet: 'tabler icons', code: "\uf326"
  },
  
  "ti-brand-blogger" : {
    iconSet: 'tabler icons', code: "\uf35a"
  },
  
  "ti-brand-booking" : {
    iconSet: 'tabler icons', code: "\uedc8"
  },
  
  "ti-brand-bootstrap" : {
    iconSet: 'tabler icons', code: "\uef3e"
  },
  
  "ti-brand-bulma" : {
    iconSet: 'tabler icons', code: "\uf327"
  },
  
  "ti-brand-bumble" : {
    iconSet: 'tabler icons', code: "\uf5fb"
  },
  
  "ti-brand-bunpo" : {
    iconSet: 'tabler icons', code: "\uf4cf"
  },
  
  "ti-brand-c-sharp" : {
    iconSet: 'tabler icons', code: "\uf003"
  },
  
  "ti-brand-cake" : {
    iconSet: 'tabler icons', code: "\uf7a3"
  },
  
  "ti-brand-cakephp" : {
    iconSet: 'tabler icons', code: "\uf7af"
  },
  
  "ti-brand-campaignmonitor" : {
    iconSet: 'tabler icons', code: "\uf328"
  },
  
  "ti-brand-carbon" : {
    iconSet: 'tabler icons', code: "\uf348"
  },
  
  "ti-brand-cashapp" : {
    iconSet: 'tabler icons', code: "\uf391"
  },
  
  "ti-brand-chrome" : {
    iconSet: 'tabler icons', code: "\uec18"
  },
  
  "ti-brand-citymapper" : {
    iconSet: 'tabler icons', code: "\uf5fc"
  },
  
  "ti-brand-codecov" : {
    iconSet: 'tabler icons', code: "\uf329"
  },
  
  "ti-brand-codepen" : {
    iconSet: 'tabler icons', code: "\uec6f"
  },
  
  "ti-brand-codesandbox" : {
    iconSet: 'tabler icons', code: "\ued6a"
  },
  
  "ti-brand-cohost" : {
    iconSet: 'tabler icons', code: "\uf5d5"
  },
  
  "ti-brand-coinbase" : {
    iconSet: 'tabler icons', code: "\uf209"
  },
  
  "ti-brand-comedy-central" : {
    iconSet: 'tabler icons', code: "\uf217"
  },
  
  "ti-brand-coreos" : {
    iconSet: 'tabler icons', code: "\uf5fd"
  },
  
  "ti-brand-couchdb" : {
    iconSet: 'tabler icons', code: "\uf60f"
  },
  
  "ti-brand-couchsurfing" : {
    iconSet: 'tabler icons', code: "\uf392"
  },
  
  "ti-brand-cpp" : {
    iconSet: 'tabler icons', code: "\uf5fe"
  },
  
  "ti-brand-crunchbase" : {
    iconSet: 'tabler icons', code: "\uf7e3"
  },
  
  "ti-brand-css3" : {
    iconSet: 'tabler icons', code: "\ued6b"
  },
  
  "ti-brand-ctemplar" : {
    iconSet: 'tabler icons', code: "\uf4d0"
  },
  
  "ti-brand-cucumber" : {
    iconSet: 'tabler icons', code: "\uef6c"
  },
  
  "ti-brand-cupra" : {
    iconSet: 'tabler icons', code: "\uf4d1"
  },
  
  "ti-brand-cypress" : {
    iconSet: 'tabler icons', code: "\uf333"
  },
  
  "ti-brand-d3" : {
    iconSet: 'tabler icons', code: "\uf24e"
  },
  
  "ti-brand-days-counter" : {
    iconSet: 'tabler icons', code: "\uf4d2"
  },
  
  "ti-brand-dcos" : {
    iconSet: 'tabler icons', code: "\uf32a"
  },
  
  "ti-brand-debian" : {
    iconSet: 'tabler icons', code: "\uef57"
  },
  
  "ti-brand-deezer" : {
    iconSet: 'tabler icons', code: "\uf78b"
  },
  
  "ti-brand-deliveroo" : {
    iconSet: 'tabler icons', code: "\uf4d3"
  },
  
  "ti-brand-deno" : {
    iconSet: 'tabler icons', code: "\uf24f"
  },
  
  "ti-brand-denodo" : {
    iconSet: 'tabler icons', code: "\uf610"
  },
  
  "ti-brand-deviantart" : {
    iconSet: 'tabler icons', code: "\uecfb"
  },
  
  "ti-brand-dingtalk" : {
    iconSet: 'tabler icons', code: "\uf5ea"
  },
  
  "ti-brand-discord" : {
    iconSet: 'tabler icons', code: "\uece3"
  },
  
  "ti-brand-discord-filled" : {
    iconSet: 'tabler icons', code: "\uf7e4"
  },
  
  "ti-brand-disney" : {
    iconSet: 'tabler icons', code: "\uf20a"
  },
  
  "ti-brand-disqus" : {
    iconSet: 'tabler icons', code: "\uedc9"
  },
  
  "ti-brand-django" : {
    iconSet: 'tabler icons', code: "\uf349"
  },
  
  "ti-brand-docker" : {
    iconSet: 'tabler icons', code: "\uedca"
  },
  
  "ti-brand-doctrine" : {
    iconSet: 'tabler icons', code: "\uef6d"
  },
  
  "ti-brand-dolby-digital" : {
    iconSet: 'tabler icons', code: "\uf4d4"
  },
  
  "ti-brand-douban" : {
    iconSet: 'tabler icons', code: "\uf5ff"
  },
  
  "ti-brand-dribbble" : {
    iconSet: 'tabler icons', code: "\uec19"
  },
  
  "ti-brand-dribbble-filled" : {
    iconSet: 'tabler icons', code: "\uf7e5"
  },
  
  "ti-brand-drops" : {
    iconSet: 'tabler icons', code: "\uf4d5"
  },
  
  "ti-brand-drupal" : {
    iconSet: 'tabler icons', code: "\uf393"
  },
  
  "ti-brand-edge" : {
    iconSet: 'tabler icons', code: "\uecfc"
  },
  
  "ti-brand-elastic" : {
    iconSet: 'tabler icons', code: "\uf611"
  },
  
  "ti-brand-ember" : {
    iconSet: 'tabler icons', code: "\uf497"
  },
  
  "ti-brand-envato" : {
    iconSet: 'tabler icons', code: "\uf394"
  },
  
  "ti-brand-etsy" : {
    iconSet: 'tabler icons', code: "\uf654"
  },
  
  "ti-brand-evernote" : {
    iconSet: 'tabler icons', code: "\uf600"
  },
  
  "ti-brand-facebook" : {
    iconSet: 'tabler icons', code: "\uec1a"
  },
  
  "ti-brand-facebook-filled" : {
    iconSet: 'tabler icons', code: "\uf7e6"
  },
  
  "ti-brand-figma" : {
    iconSet: 'tabler icons', code: "\uec93"
  },
  
  "ti-brand-finder" : {
    iconSet: 'tabler icons', code: "\uf218"
  },
  
  "ti-brand-firebase" : {
    iconSet: 'tabler icons', code: "\uef6e"
  },
  
  "ti-brand-firefox" : {
    iconSet: 'tabler icons', code: "\uecfd"
  },
  
  "ti-brand-fiverr" : {
    iconSet: 'tabler icons', code: "\uf7a4"
  },
  
  "ti-brand-flickr" : {
    iconSet: 'tabler icons', code: "\uecfe"
  },
  
  "ti-brand-flightradar24" : {
    iconSet: 'tabler icons', code: "\uf4d6"
  },
  
  "ti-brand-flipboard" : {
    iconSet: 'tabler icons', code: "\uf20b"
  },
  
  "ti-brand-flutter" : {
    iconSet: 'tabler icons', code: "\uf395"
  },
  
  "ti-brand-fortnite" : {
    iconSet: 'tabler icons', code: "\uf260"
  },
  
  "ti-brand-foursquare" : {
    iconSet: 'tabler icons', code: "\uecff"
  },
  
  "ti-brand-framer" : {
    iconSet: 'tabler icons', code: "\uec1b"
  },
  
  "ti-brand-framer-motion" : {
    iconSet: 'tabler icons', code: "\uf78c"
  },
  
  "ti-brand-funimation" : {
    iconSet: 'tabler icons', code: "\uf655"
  },
  
  "ti-brand-gatsby" : {
    iconSet: 'tabler icons', code: "\uf396"
  },
  
  "ti-brand-git" : {
    iconSet: 'tabler icons', code: "\uef6f"
  },
  
  "ti-brand-github" : {
    iconSet: 'tabler icons', code: "\uec1c"
  },
  
  "ti-brand-github-copilot" : {
    iconSet: 'tabler icons', code: "\uf4a8"
  },
  
  "ti-brand-github-filled" : {
    iconSet: 'tabler icons', code: "\uf7e7"
  },
  
  "ti-brand-gitlab" : {
    iconSet: 'tabler icons', code: "\uec1d"
  },
  
  "ti-brand-gmail" : {
    iconSet: 'tabler icons', code: "\uefa2"
  },
  
  "ti-brand-golang" : {
    iconSet: 'tabler icons', code: "\uf78d"
  },
  
  "ti-brand-google" : {
    iconSet: 'tabler icons', code: "\uec1f"
  },
  
  "ti-brand-google-analytics" : {
    iconSet: 'tabler icons', code: "\uedcb"
  },
  
  "ti-brand-google-big-query" : {
    iconSet: 'tabler icons', code: "\uf612"
  },
  
  "ti-brand-google-drive" : {
    iconSet: 'tabler icons', code: "\uec1e"
  },
  
  "ti-brand-google-fit" : {
    iconSet: 'tabler icons', code: "\uf297"
  },
  
  "ti-brand-google-home" : {
    iconSet: 'tabler icons', code: "\uf601"
  },
  
  "ti-brand-google-one" : {
    iconSet: 'tabler icons', code: "\uf232"
  },
  
  "ti-brand-google-photos" : {
    iconSet: 'tabler icons', code: "\uf20c"
  },
  
  "ti-brand-google-play" : {
    iconSet: 'tabler icons', code: "\ued25"
  },
  
  "ti-brand-google-podcasts" : {
    iconSet: 'tabler icons', code: "\uf656"
  },
  
  "ti-brand-grammarly" : {
    iconSet: 'tabler icons', code: "\uf32b"
  },
  
  "ti-brand-graphql" : {
    iconSet: 'tabler icons', code: "\uf32c"
  },
  
  "ti-brand-gravatar" : {
    iconSet: 'tabler icons', code: "\uedcc"
  },
  
  "ti-brand-grindr" : {
    iconSet: 'tabler icons', code: "\uf20d"
  },
  
  "ti-brand-guardian" : {
    iconSet: 'tabler icons', code: "\uf4fb"
  },
  
  "ti-brand-gumroad" : {
    iconSet: 'tabler icons', code: "\uf5d6"
  },
  
  "ti-brand-hbo" : {
    iconSet: 'tabler icons', code: "\uf657"
  },
  
  "ti-brand-headlessui" : {
    iconSet: 'tabler icons', code: "\uf32d"
  },
  
  "ti-brand-hipchat" : {
    iconSet: 'tabler icons', code: "\uedcd"
  },
  
  "ti-brand-html5" : {
    iconSet: 'tabler icons', code: "\ued6c"
  },
  
  "ti-brand-inertia" : {
    iconSet: 'tabler icons', code: "\uf34a"
  },
  
  "ti-brand-instagram" : {
    iconSet: 'tabler icons', code: "\uec20"
  },
  
  "ti-brand-intercom" : {
    iconSet: 'tabler icons', code: "\uf1cf"
  },
  
  "ti-brand-itch" : {
    iconSet: 'tabler icons', code: "\ufa22"
  },
  
  "ti-brand-javascript" : {
    iconSet: 'tabler icons', code: "\uef0c"
  },
  
  "ti-brand-juejin" : {
    iconSet: 'tabler icons', code: "\uf7b0"
  },
  
  "ti-brand-kick" : {
    iconSet: 'tabler icons', code: "\ufa23"
  },
  
  "ti-brand-kickstarter" : {
    iconSet: 'tabler icons', code: "\uedce"
  },
  
  "ti-brand-kotlin" : {
    iconSet: 'tabler icons', code: "\ued6d"
  },
  
  "ti-brand-laravel" : {
    iconSet: 'tabler icons', code: "\uf34b"
  },
  
  "ti-brand-lastfm" : {
    iconSet: 'tabler icons', code: "\uf001"
  },
  
  "ti-brand-letterboxd" : {
    iconSet: 'tabler icons', code: "\ufa24"
  },
  
  "ti-brand-line" : {
    iconSet: 'tabler icons', code: "\uf7e8"
  },
  
  "ti-brand-linkedin" : {
    iconSet: 'tabler icons', code: "\uec8c"
  },
  
  "ti-brand-linktree" : {
    iconSet: 'tabler icons', code: "\uf1e7"
  },
  
  "ti-brand-linqpad" : {
    iconSet: 'tabler icons', code: "\uf562"
  },
  
  "ti-brand-loom" : {
    iconSet: 'tabler icons', code: "\uef70"
  },
  
  "ti-brand-mailgun" : {
    iconSet: 'tabler icons', code: "\uf32e"
  },
  
  "ti-brand-mantine" : {
    iconSet: 'tabler icons', code: "\uf32f"
  },
  
  "ti-brand-mastercard" : {
    iconSet: 'tabler icons', code: "\uef49"
  },
  
  "ti-brand-mastodon" : {
    iconSet: 'tabler icons', code: "\uf250"
  },
  
  "ti-brand-matrix" : {
    iconSet: 'tabler icons', code: "\uf5eb"
  },
  
  "ti-brand-mcdonalds" : {
    iconSet: 'tabler icons', code: "\uf251"
  },
  
  "ti-brand-medium" : {
    iconSet: 'tabler icons', code: "\uec70"
  },
  
  "ti-brand-mercedes" : {
    iconSet: 'tabler icons', code: "\uf072"
  },
  
  "ti-brand-messenger" : {
    iconSet: 'tabler icons', code: "\uec71"
  },
  
  "ti-brand-meta" : {
    iconSet: 'tabler icons', code: "\uefb0"
  },
  
  "ti-brand-miniprogram" : {
    iconSet: 'tabler icons', code: "\uf602"
  },
  
  "ti-brand-mixpanel" : {
    iconSet: 'tabler icons', code: "\uf397"
  },
  
  "ti-brand-monday" : {
    iconSet: 'tabler icons', code: "\uf219"
  },
  
  "ti-brand-mongodb" : {
    iconSet: 'tabler icons', code: "\uf613"
  },
  
  "ti-brand-my-oppo" : {
    iconSet: 'tabler icons', code: "\uf4d7"
  },
  
  "ti-brand-mysql" : {
    iconSet: 'tabler icons', code: "\uf614"
  },
  
  "ti-brand-national-geographic" : {
    iconSet: 'tabler icons', code: "\uf603"
  },
  
  "ti-brand-nem" : {
    iconSet: 'tabler icons', code: "\uf5a1"
  },
  
  "ti-brand-netbeans" : {
    iconSet: 'tabler icons', code: "\uef71"
  },
  
  "ti-brand-netease-music" : {
    iconSet: 'tabler icons', code: "\uf604"
  },
  
  "ti-brand-netflix" : {
    iconSet: 'tabler icons', code: "\uedcf"
  },
  
  "ti-brand-nexo" : {
    iconSet: 'tabler icons', code: "\uf5a2"
  },
  
  "ti-brand-nextcloud" : {
    iconSet: 'tabler icons', code: "\uf4d8"
  },
  
  "ti-brand-nextjs" : {
    iconSet: 'tabler icons', code: "\uf0dd"
  },
  
  "ti-brand-nord-vpn" : {
    iconSet: 'tabler icons', code: "\uf37f"
  },
  
  "ti-brand-notion" : {
    iconSet: 'tabler icons', code: "\uef7b"
  },
  
  "ti-brand-npm" : {
    iconSet: 'tabler icons', code: "\uf569"
  },
  
  "ti-brand-nuxt" : {
    iconSet: 'tabler icons', code: "\uf0de"
  },
  
  "ti-brand-nytimes" : {
    iconSet: 'tabler icons', code: "\uef8d"
  },
  
  "ti-brand-office" : {
    iconSet: 'tabler icons', code: "\uf398"
  },
  
  "ti-brand-ok-ru" : {
    iconSet: 'tabler icons', code: "\uf399"
  },
  
  "ti-brand-onedrive" : {
    iconSet: 'tabler icons', code: "\uf5d7"
  },
  
  "ti-brand-onlyfans" : {
    iconSet: 'tabler icons', code: "\uf605"
  },
  
  "ti-brand-open-source" : {
    iconSet: 'tabler icons', code: "\uedd0"
  },
  
  "ti-brand-openai" : {
    iconSet: 'tabler icons', code: "\uf78e"
  },
  
  "ti-brand-openvpn" : {
    iconSet: 'tabler icons', code: "\uf39a"
  },
  
  "ti-brand-opera" : {
    iconSet: 'tabler icons', code: "\uec21"
  },
  
  "ti-brand-pagekit" : {
    iconSet: 'tabler icons', code: "\uedd1"
  },
  
  "ti-brand-patreon" : {
    iconSet: 'tabler icons', code: "\uedd2"
  },
  
  "ti-brand-paypal" : {
    iconSet: 'tabler icons', code: "\uec22"
  },
  
  "ti-brand-paypal-filled" : {
    iconSet: 'tabler icons', code: "\uf7e9"
  },
  
  "ti-brand-paypay" : {
    iconSet: 'tabler icons', code: "\uf5ec"
  },
  
  "ti-brand-peanut" : {
    iconSet: 'tabler icons', code: "\uf39b"
  },
  
  "ti-brand-pepsi" : {
    iconSet: 'tabler icons', code: "\uf261"
  },
  
  "ti-brand-php" : {
    iconSet: 'tabler icons', code: "\uef72"
  },
  
  "ti-brand-picsart" : {
    iconSet: 'tabler icons', code: "\uf4d9"
  },
  
  "ti-brand-pinterest" : {
    iconSet: 'tabler icons', code: "\uec8d"
  },
  
  "ti-brand-planetscale" : {
    iconSet: 'tabler icons', code: "\uf78f"
  },
  
  "ti-brand-pocket" : {
    iconSet: 'tabler icons', code: "\ued00"
  },
  
  "ti-brand-polymer" : {
    iconSet: 'tabler icons', code: "\uf498"
  },
  
  "ti-brand-powershell" : {
    iconSet: 'tabler icons', code: "\uf5ed"
  },
  
  "ti-brand-prisma" : {
    iconSet: 'tabler icons', code: "\uf499"
  },
  
  "ti-brand-producthunt" : {
    iconSet: 'tabler icons', code: "\uedd3"
  },
  
  "ti-brand-pushbullet" : {
    iconSet: 'tabler icons', code: "\uf330"
  },
  
  "ti-brand-pushover" : {
    iconSet: 'tabler icons', code: "\uf20e"
  },
  
  "ti-brand-python" : {
    iconSet: 'tabler icons', code: "\ued01"
  },
  
  "ti-brand-qq" : {
    iconSet: 'tabler icons', code: "\uf606"
  },
  
  "ti-brand-radix-ui" : {
    iconSet: 'tabler icons', code: "\uf790"
  },
  
  "ti-brand-react" : {
    iconSet: 'tabler icons', code: "\uf34c"
  },
  
  "ti-brand-react-native" : {
    iconSet: 'tabler icons', code: "\uef73"
  },
  
  "ti-brand-reason" : {
    iconSet: 'tabler icons', code: "\uf49a"
  },
  
  "ti-brand-reddit" : {
    iconSet: 'tabler icons', code: "\uec8e"
  },
  
  "ti-brand-redhat" : {
    iconSet: 'tabler icons', code: "\uf331"
  },
  
  "ti-brand-redux" : {
    iconSet: 'tabler icons', code: "\uf3a8"
  },
  
  "ti-brand-revolut" : {
    iconSet: 'tabler icons', code: "\uf4da"
  },
  
  "ti-brand-safari" : {
    iconSet: 'tabler icons', code: "\uec23"
  },
  
  "ti-brand-samsungpass" : {
    iconSet: 'tabler icons', code: "\uf4db"
  },
  
  "ti-brand-sass" : {
    iconSet: 'tabler icons', code: "\uedd4"
  },
  
  "ti-brand-sentry" : {
    iconSet: 'tabler icons', code: "\uedd5"
  },
  
  "ti-brand-sharik" : {
    iconSet: 'tabler icons', code: "\uf4dc"
  },
  
  "ti-brand-shazam" : {
    iconSet: 'tabler icons', code: "\uedd6"
  },
  
  "ti-brand-shopee" : {
    iconSet: 'tabler icons', code: "\uf252"
  },
  
  "ti-brand-sketch" : {
    iconSet: 'tabler icons', code: "\uec24"
  },
  
  "ti-brand-skype" : {
    iconSet: 'tabler icons', code: "\ued02"
  },
  
  "ti-brand-slack" : {
    iconSet: 'tabler icons', code: "\uec72"
  },
  
  "ti-brand-snapchat" : {
    iconSet: 'tabler icons', code: "\uec25"
  },
  
  "ti-brand-snapseed" : {
    iconSet: 'tabler icons', code: "\uf253"
  },
  
  "ti-brand-snowflake" : {
    iconSet: 'tabler icons', code: "\uf615"
  },
  
  "ti-brand-socket-io" : {
    iconSet: 'tabler icons', code: "\uf49b"
  },
  
  "ti-brand-solidjs" : {
    iconSet: 'tabler icons', code: "\uf5ee"
  },
  
  "ti-brand-soundcloud" : {
    iconSet: 'tabler icons', code: "\ued6e"
  },
  
  "ti-brand-spacehey" : {
    iconSet: 'tabler icons', code: "\uf4fc"
  },
  
  "ti-brand-spotify" : {
    iconSet: 'tabler icons', code: "\ued03"
  },
  
  "ti-brand-stackoverflow" : {
    iconSet: 'tabler icons', code: "\uef58"
  },
  
  "ti-brand-stackshare" : {
    iconSet: 'tabler icons', code: "\uf607"
  },
  
  "ti-brand-steam" : {
    iconSet: 'tabler icons', code: "\ued6f"
  },
  
  "ti-brand-storybook" : {
    iconSet: 'tabler icons', code: "\uf332"
  },
  
  "ti-brand-storytel" : {
    iconSet: 'tabler icons', code: "\uf608"
  },
  
  "ti-brand-strava" : {
    iconSet: 'tabler icons', code: "\uf254"
  },
  
  "ti-brand-stripe" : {
    iconSet: 'tabler icons', code: "\uedd7"
  },
  
  "ti-brand-sublime-text" : {
    iconSet: 'tabler icons', code: "\uef74"
  },
  
  "ti-brand-sugarizer" : {
    iconSet: 'tabler icons', code: "\uf7a5"
  },
  
  "ti-brand-supabase" : {
    iconSet: 'tabler icons', code: "\uf6d3"
  },
  
  "ti-brand-superhuman" : {
    iconSet: 'tabler icons', code: "\uf50c"
  },
  
  "ti-brand-supernova" : {
    iconSet: 'tabler icons', code: "\uf49c"
  },
  
  "ti-brand-surfshark" : {
    iconSet: 'tabler icons', code: "\uf255"
  },
  
  "ti-brand-svelte" : {
    iconSet: 'tabler icons', code: "\uf0df"
  },
  
  "ti-brand-symfony" : {
    iconSet: 'tabler icons', code: "\uf616"
  },
  
  "ti-brand-tabler" : {
    iconSet: 'tabler icons', code: "\uec8f"
  },
  
  "ti-brand-tailwind" : {
    iconSet: 'tabler icons', code: "\ueca1"
  },
  
  "ti-brand-taobao" : {
    iconSet: 'tabler icons', code: "\uf5ef"
  },
  
  "ti-brand-ted" : {
    iconSet: 'tabler icons', code: "\uf658"
  },
  
  "ti-brand-telegram" : {
    iconSet: 'tabler icons', code: "\uec26"
  },
  
  "ti-brand-tether" : {
    iconSet: 'tabler icons', code: "\uf5a3"
  },
  
  "ti-brand-threejs" : {
    iconSet: 'tabler icons', code: "\uf5f0"
  },
  
  "ti-brand-tidal" : {
    iconSet: 'tabler icons', code: "\ued70"
  },
  
  "ti-brand-tikto-filled" : {
    iconSet: 'tabler icons', code: "\uf7ea"
  },
  
  "ti-brand-tiktok" : {
    iconSet: 'tabler icons', code: "\uec73"
  },
  
  "ti-brand-tinder" : {
    iconSet: 'tabler icons', code: "\ued71"
  },
  
  "ti-brand-topbuzz" : {
    iconSet: 'tabler icons', code: "\uf50d"
  },
  
  "ti-brand-torchain" : {
    iconSet: 'tabler icons', code: "\uf5a4"
  },
  
  "ti-brand-toyota" : {
    iconSet: 'tabler icons', code: "\uf262"
  },
  
  "ti-brand-trello" : {
    iconSet: 'tabler icons', code: "\uf39d"
  },
  
  "ti-brand-tripadvisor" : {
    iconSet: 'tabler icons', code: "\uf002"
  },
  
  "ti-brand-tumblr" : {
    iconSet: 'tabler icons', code: "\ued04"
  },
  
  "ti-brand-twilio" : {
    iconSet: 'tabler icons', code: "\uf617"
  },
  
  "ti-brand-twitch" : {
    iconSet: 'tabler icons', code: "\ued05"
  },
  
  "ti-brand-twitter" : {
    iconSet: 'tabler icons', code: "\uec27"
  },
  
  "ti-brand-twitter-filled" : {
    iconSet: 'tabler icons', code: "\uf7eb"
  },
  
  "ti-brand-typescript" : {
    iconSet: 'tabler icons', code: "\uf5f1"
  },
  
  "ti-brand-uber" : {
    iconSet: 'tabler icons', code: "\uef75"
  },
  
  "ti-brand-ubuntu" : {
    iconSet: 'tabler icons', code: "\uef59"
  },
  
  "ti-brand-unity" : {
    iconSet: 'tabler icons', code: "\uf49d"
  },
  
  "ti-brand-unsplash" : {
    iconSet: 'tabler icons', code: "\uedd8"
  },
  
  "ti-brand-upwork" : {
    iconSet: 'tabler icons', code: "\uf39e"
  },
  
  "ti-brand-valorant" : {
    iconSet: 'tabler icons', code: "\uf39f"
  },
  
  "ti-brand-vercel" : {
    iconSet: 'tabler icons', code: "\uef24"
  },
  
  "ti-brand-vimeo" : {
    iconSet: 'tabler icons', code: "\ued06"
  },
  
  "ti-brand-vinted" : {
    iconSet: 'tabler icons', code: "\uf20f"
  },
  
  "ti-brand-visa" : {
    iconSet: 'tabler icons', code: "\uf380"
  },
  
  "ti-brand-visual-studio" : {
    iconSet: 'tabler icons', code: "\uef76"
  },
  
  "ti-brand-vite" : {
    iconSet: 'tabler icons', code: "\uf5f2"
  },
  
  "ti-brand-vivaldi" : {
    iconSet: 'tabler icons', code: "\uf210"
  },
  
  "ti-brand-vk" : {
    iconSet: 'tabler icons', code: "\ued72"
  },
  
  "ti-brand-volkswagen" : {
    iconSet: 'tabler icons', code: "\uf50e"
  },
  
  "ti-brand-vsco" : {
    iconSet: 'tabler icons', code: "\uf334"
  },
  
  "ti-brand-vscode" : {
    iconSet: 'tabler icons', code: "\uf3a0"
  },
  
  "ti-brand-vue" : {
    iconSet: 'tabler icons', code: "\uf0e0"
  },
  
  "ti-brand-walmart" : {
    iconSet: 'tabler icons', code: "\uf211"
  },
  
  "ti-brand-waze" : {
    iconSet: 'tabler icons', code: "\uf5d8"
  },
  
  "ti-brand-webflow" : {
    iconSet: 'tabler icons', code: "\uf2d2"
  },
  
  "ti-brand-wechat" : {
    iconSet: 'tabler icons', code: "\uf5f3"
  },
  
  "ti-brand-weibo" : {
    iconSet: 'tabler icons', code: "\uf609"
  },
  
  "ti-brand-whatsapp" : {
    iconSet: 'tabler icons', code: "\uec74"
  },
  
  "ti-brand-windows" : {
    iconSet: 'tabler icons', code: "\uecd8"
  },
  
  "ti-brand-windy" : {
    iconSet: 'tabler icons', code: "\uf4dd"
  },
  
  "ti-brand-wish" : {
    iconSet: 'tabler icons', code: "\uf212"
  },
  
  "ti-brand-wix" : {
    iconSet: 'tabler icons', code: "\uf3a1"
  },
  
  "ti-brand-wordpress" : {
    iconSet: 'tabler icons', code: "\uf2d3"
  },
  
  "ti-brand-xbox" : {
    iconSet: 'tabler icons', code: "\uf298"
  },
  
  "ti-brand-xing" : {
    iconSet: 'tabler icons', code: "\uf21a"
  },
  
  "ti-brand-yahoo" : {
    iconSet: 'tabler icons', code: "\ued73"
  },
  
  "ti-brand-yatse" : {
    iconSet: 'tabler icons', code: "\uf213"
  },
  
  "ti-brand-ycombinator" : {
    iconSet: 'tabler icons', code: "\uedd9"
  },
  
  "ti-brand-youtube" : {
    iconSet: 'tabler icons', code: "\uec90"
  },
  
  "ti-brand-youtube-kids" : {
    iconSet: 'tabler icons', code: "\uf214"
  },
  
  "ti-brand-zalando" : {
    iconSet: 'tabler icons', code: "\uf49e"
  },
  
  "ti-brand-zapier" : {
    iconSet: 'tabler icons', code: "\uf49f"
  },
  
  "ti-brand-zeit" : {
    iconSet: 'tabler icons', code: "\uf335"
  },
  
  "ti-brand-zhihu" : {
    iconSet: 'tabler icons', code: "\uf60a"
  },
  
  "ti-brand-zoom" : {
    iconSet: 'tabler icons', code: "\uf215"
  },
  
  "ti-brand-zulip" : {
    iconSet: 'tabler icons', code: "\uf4de"
  },
  
  "ti-brand-zwift" : {
    iconSet: 'tabler icons', code: "\uf216"
  },
  
  "ti-bread" : {
    iconSet: 'tabler icons', code: "\uefa3"
  },
  
  "ti-bread-off" : {
    iconSet: 'tabler icons', code: "\uf3cb"
  },
  
  "ti-briefcase" : {
    iconSet: 'tabler icons', code: "\uea46"
  },
  
  "ti-briefcase-off" : {
    iconSet: 'tabler icons', code: "\uf3cc"
  },
  
  "ti-brightness" : {
    iconSet: 'tabler icons', code: "\ueb7f"
  },
  
  "ti-brightness-2" : {
    iconSet: 'tabler icons', code: "\uee19"
  },
  
  "ti-brightness-down" : {
    iconSet: 'tabler icons', code: "\ueb7d"
  },
  
  "ti-brightness-half" : {
    iconSet: 'tabler icons', code: "\uee1a"
  },
  
  "ti-brightness-off" : {
    iconSet: 'tabler icons', code: "\uf3cd"
  },
  
  "ti-brightness-up" : {
    iconSet: 'tabler icons', code: "\ueb7e"
  },
  
  "ti-broadcast" : {
    iconSet: 'tabler icons', code: "\uf1e9"
  },
  
  "ti-broadcast-off" : {
    iconSet: 'tabler icons', code: "\uf1e8"
  },
  
  "ti-browser" : {
    iconSet: 'tabler icons', code: "\uebb7"
  },
  
  "ti-browser-check" : {
    iconSet: 'tabler icons', code: "\uefd6"
  },
  
  "ti-browser-off" : {
    iconSet: 'tabler icons', code: "\uf0c1"
  },
  
  "ti-browser-plus" : {
    iconSet: 'tabler icons', code: "\uefd7"
  },
  
  "ti-browser-x" : {
    iconSet: 'tabler icons', code: "\uefd8"
  },
  
  "ti-brush" : {
    iconSet: 'tabler icons', code: "\uebb8"
  },
  
  "ti-brush-off" : {
    iconSet: 'tabler icons', code: "\uf0c2"
  },
  
  "ti-bucket" : {
    iconSet: 'tabler icons', code: "\uea47"
  },
  
  "ti-bucket-droplet" : {
    iconSet: 'tabler icons', code: "\uf56a"
  },
  
  "ti-bucket-off" : {
    iconSet: 'tabler icons', code: "\uf103"
  },
  
  "ti-bug" : {
    iconSet: 'tabler icons', code: "\uea48"
  },
  
  "ti-bug-off" : {
    iconSet: 'tabler icons', code: "\uf0c3"
  },
  
  "ti-building" : {
    iconSet: 'tabler icons', code: "\uea4f"
  },
  
  "ti-building-arch" : {
    iconSet: 'tabler icons', code: "\uea49"
  },
  
  "ti-building-bank" : {
    iconSet: 'tabler icons', code: "\uebe2"
  },
  
  "ti-building-bridge" : {
    iconSet: 'tabler icons', code: "\uea4b"
  },
  
  "ti-building-bridge-2" : {
    iconSet: 'tabler icons', code: "\uea4a"
  },
  
  "ti-building-broadcast-tower" : {
    iconSet: 'tabler icons', code: "\uf4be"
  },
  
  "ti-building-carousel" : {
    iconSet: 'tabler icons', code: "\ued87"
  },
  
  "ti-building-castle" : {
    iconSet: 'tabler icons', code: "\ued88"
  },
  
  "ti-building-church" : {
    iconSet: 'tabler icons', code: "\uea4c"
  },
  
  "ti-building-circus" : {
    iconSet: 'tabler icons', code: "\uf4bf"
  },
  
  "ti-building-community" : {
    iconSet: 'tabler icons', code: "\uebf6"
  },
  
  "ti-building-cottage" : {
    iconSet: 'tabler icons', code: "\uee1b"
  },
  
  "ti-building-estate" : {
    iconSet: 'tabler icons', code: "\uf5a5"
  },
  
  "ti-building-factory" : {
    iconSet: 'tabler icons', code: "\uee1c"
  },
  
  "ti-building-factory-2" : {
    iconSet: 'tabler icons', code: "\uf082"
  },
  
  "ti-building-fortress" : {
    iconSet: 'tabler icons', code: "\ued89"
  },
  
  "ti-building-hospital" : {
    iconSet: 'tabler icons', code: "\uea4d"
  },
  
  "ti-building-lighthouse" : {
    iconSet: 'tabler icons', code: "\ued8a"
  },
  
  "ti-building-monument" : {
    iconSet: 'tabler icons', code: "\ued26"
  },
  
  "ti-building-pavilion" : {
    iconSet: 'tabler icons', code: "\uebf7"
  },
  
  "ti-building-skyscraper" : {
    iconSet: 'tabler icons', code: "\uec39"
  },
  
  "ti-building-stadium" : {
    iconSet: 'tabler icons', code: "\uf641"
  },
  
  "ti-building-store" : {
    iconSet: 'tabler icons', code: "\uea4e"
  },
  
  "ti-building-tunnel" : {
    iconSet: 'tabler icons', code: "\uf5a6"
  },
  
  "ti-building-warehouse" : {
    iconSet: 'tabler icons', code: "\uebe3"
  },
  
  "ti-building-wind-turbine" : {
    iconSet: 'tabler icons', code: "\uf4c0"
  },
  
  "ti-bulb" : {
    iconSet: 'tabler icons', code: "\uea51"
  },
  
  "ti-bulb-filled" : {
    iconSet: 'tabler icons', code: "\uf66a"
  },
  
  "ti-bulb-off" : {
    iconSet: 'tabler icons', code: "\uea50"
  },
  
  "ti-bulldozer" : {
    iconSet: 'tabler icons', code: "\uee1d"
  },
  
  "ti-bus" : {
    iconSet: 'tabler icons', code: "\uebe4"
  },
  
  "ti-bus-off" : {
    iconSet: 'tabler icons', code: "\uf3ce"
  },
  
  "ti-bus-stop" : {
    iconSet: 'tabler icons', code: "\uf2d4"
  },
  
  "ti-businessplan" : {
    iconSet: 'tabler icons', code: "\uee1e"
  },
  
  "ti-butterfly" : {
    iconSet: 'tabler icons', code: "\uefd9"
  },
  
  "ti-cactus" : {
    iconSet: 'tabler icons', code: "\uf21b"
  },
  
  "ti-cactus-off" : {
    iconSet: 'tabler icons', code: "\uf3cf"
  },
  
  "ti-cake" : {
    iconSet: 'tabler icons', code: "\uf00f"
  },
  
  "ti-cake-off" : {
    iconSet: 'tabler icons', code: "\uf104"
  },
  
  "ti-calculator" : {
    iconSet: 'tabler icons', code: "\ueb80"
  },
  
  "ti-calculator-off" : {
    iconSet: 'tabler icons', code: "\uf0c4"
  },
  
  "ti-calendar" : {
    iconSet: 'tabler icons', code: "\uea53"
  },
  
  "ti-calendar-bolt" : {
    iconSet: 'tabler icons', code: "\uf822"
  },
  
  "ti-calendar-cancel" : {
    iconSet: 'tabler icons', code: "\uf823"
  },
  
  "ti-calendar-check" : {
    iconSet: 'tabler icons', code: "\uf824"
  },
  
  "ti-calendar-code" : {
    iconSet: 'tabler icons', code: "\uf825"
  },
  
  "ti-calendar-cog" : {
    iconSet: 'tabler icons', code: "\uf826"
  },
  
  "ti-calendar-dollar" : {
    iconSet: 'tabler icons', code: "\uf827"
  },
  
  "ti-calendar-down" : {
    iconSet: 'tabler icons', code: "\uf828"
  },
  
  "ti-calendar-due" : {
    iconSet: 'tabler icons', code: "\uf621"
  },
  
  "ti-calendar-event" : {
    iconSet: 'tabler icons', code: "\uea52"
  },
  
  "ti-calendar-exclamation" : {
    iconSet: 'tabler icons', code: "\uf829"
  },
  
  "ti-calendar-heart" : {
    iconSet: 'tabler icons', code: "\uf82a"
  },
  
  "ti-calendar-minus" : {
    iconSet: 'tabler icons', code: "\uebb9"
  },
  
  "ti-calendar-off" : {
    iconSet: 'tabler icons', code: "\uee1f"
  },
  
  "ti-calendar-pause" : {
    iconSet: 'tabler icons', code: "\uf82b"
  },
  
  "ti-calendar-pin" : {
    iconSet: 'tabler icons', code: "\uf82c"
  },
  
  "ti-calendar-plus" : {
    iconSet: 'tabler icons', code: "\uebba"
  },
  
  "ti-calendar-question" : {
    iconSet: 'tabler icons', code: "\uf82d"
  },
  
  "ti-calendar-search" : {
    iconSet: 'tabler icons', code: "\uf82e"
  },
  
  "ti-calendar-share" : {
    iconSet: 'tabler icons', code: "\uf82f"
  },
  
  "ti-calendar-star" : {
    iconSet: 'tabler icons', code: "\uf830"
  },
  
  "ti-calendar-stats" : {
    iconSet: 'tabler icons', code: "\uee20"
  },
  
  "ti-calendar-time" : {
    iconSet: 'tabler icons', code: "\uee21"
  },
  
  "ti-calendar-up" : {
    iconSet: 'tabler icons', code: "\uf831"
  },
  
  "ti-calendar-x" : {
    iconSet: 'tabler icons', code: "\uf832"
  },
  
  "ti-camera" : {
    iconSet: 'tabler icons', code: "\uea54"
  },
  
  "ti-camera-bolt" : {
    iconSet: 'tabler icons', code: "\uf833"
  },
  
  "ti-camera-cancel" : {
    iconSet: 'tabler icons', code: "\uf834"
  },
  
  "ti-camera-check" : {
    iconSet: 'tabler icons', code: "\uf835"
  },
  
  "ti-camera-code" : {
    iconSet: 'tabler icons', code: "\uf836"
  },
  
  "ti-camera-cog" : {
    iconSet: 'tabler icons', code: "\uf837"
  },
  
  "ti-camera-dollar" : {
    iconSet: 'tabler icons', code: "\uf838"
  },
  
  "ti-camera-down" : {
    iconSet: 'tabler icons', code: "\uf839"
  },
  
  "ti-camera-exclamation" : {
    iconSet: 'tabler icons', code: "\uf83a"
  },
  
  "ti-camera-heart" : {
    iconSet: 'tabler icons', code: "\uf83b"
  },
  
  "ti-camera-minus" : {
    iconSet: 'tabler icons', code: "\uec3a"
  },
  
  "ti-camera-off" : {
    iconSet: 'tabler icons', code: "\uecee"
  },
  
  "ti-camera-pause" : {
    iconSet: 'tabler icons', code: "\uf83c"
  },
  
  "ti-camera-pin" : {
    iconSet: 'tabler icons', code: "\uf83d"
  },
  
  "ti-camera-plus" : {
    iconSet: 'tabler icons', code: "\uec3b"
  },
  
  "ti-camera-question" : {
    iconSet: 'tabler icons', code: "\uf83e"
  },
  
  "ti-camera-rotate" : {
    iconSet: 'tabler icons', code: "\uee22"
  },
  
  "ti-camera-search" : {
    iconSet: 'tabler icons', code: "\uf83f"
  },
  
  "ti-camera-selfie" : {
    iconSet: 'tabler icons', code: "\uee23"
  },
  
  "ti-camera-share" : {
    iconSet: 'tabler icons', code: "\uf840"
  },
  
  "ti-camera-star" : {
    iconSet: 'tabler icons', code: "\uf841"
  },
  
  "ti-camera-up" : {
    iconSet: 'tabler icons', code: "\uf842"
  },
  
  "ti-camera-x" : {
    iconSet: 'tabler icons', code: "\uf843"
  },
  
  "ti-camper" : {
    iconSet: 'tabler icons', code: "\ufa25"
  },
  
  "ti-campfire" : {
    iconSet: 'tabler icons', code: "\uf5a7"
  },
  
  "ti-candle" : {
    iconSet: 'tabler icons', code: "\uefc6"
  },
  
  "ti-candy" : {
    iconSet: 'tabler icons', code: "\uef0d"
  },
  
  "ti-candy-off" : {
    iconSet: 'tabler icons', code: "\uf0c5"
  },
  
  "ti-cane" : {
    iconSet: 'tabler icons', code: "\uf50f"
  },
  
  "ti-cannabis" : {
    iconSet: 'tabler icons', code: "\uf4c1"
  },
  
  "ti-capture" : {
    iconSet: 'tabler icons', code: "\uec3c"
  },
  
  "ti-capture-off" : {
    iconSet: 'tabler icons', code: "\uf0c6"
  },
  
  "ti-car" : {
    iconSet: 'tabler icons', code: "\uebbb"
  },
  
  "ti-car-crane" : {
    iconSet: 'tabler icons', code: "\uef25"
  },
  
  "ti-car-crash" : {
    iconSet: 'tabler icons', code: "\uefa4"
  },
  
  "ti-car-off" : {
    iconSet: 'tabler icons', code: "\uf0c7"
  },
  
  "ti-car-turbine" : {
    iconSet: 'tabler icons', code: "\uf4fd"
  },
  
  "ti-caravan" : {
    iconSet: 'tabler icons', code: "\uec7c"
  },
  
  "ti-cardboards" : {
    iconSet: 'tabler icons', code: "\ued74"
  },
  
  "ti-cardboards-off" : {
    iconSet: 'tabler icons', code: "\uf0c8"
  },
  
  "ti-cards" : {
    iconSet: 'tabler icons', code: "\uf510"
  },
  
  "ti-caret-down" : {
    iconSet: 'tabler icons', code: "\ueb5d"
  },
  
  "ti-caret-left" : {
    iconSet: 'tabler icons', code: "\ueb5e"
  },
  
  "ti-caret-right" : {
    iconSet: 'tabler icons', code: "\ueb5f"
  },
  
  "ti-caret-up" : {
    iconSet: 'tabler icons', code: "\ueb60"
  },
  
  "ti-carousel-horizontal" : {
    iconSet: 'tabler icons', code: "\uf659"
  },
  
  "ti-carousel-vertical" : {
    iconSet: 'tabler icons', code: "\uf65a"
  },
  
  "ti-carrot" : {
    iconSet: 'tabler icons', code: "\uf21c"
  },
  
  "ti-carrot-off" : {
    iconSet: 'tabler icons', code: "\uf3d0"
  },
  
  "ti-cash" : {
    iconSet: 'tabler icons', code: "\uea55"
  },
  
  "ti-cash-banknote" : {
    iconSet: 'tabler icons', code: "\uee25"
  },
  
  "ti-cash-banknote-off" : {
    iconSet: 'tabler icons', code: "\uee24"
  },
  
  "ti-cash-off" : {
    iconSet: 'tabler icons', code: "\uf105"
  },
  
  "ti-cast" : {
    iconSet: 'tabler icons', code: "\uea56"
  },
  
  "ti-cast-off" : {
    iconSet: 'tabler icons', code: "\uf0c9"
  },
  
  "ti-cat" : {
    iconSet: 'tabler icons', code: "\uf65b"
  },
  
  "ti-category" : {
    iconSet: 'tabler icons', code: "\uf1f6"
  },
  
  "ti-category-2" : {
    iconSet: 'tabler icons', code: "\uf1f5"
  },
  
  "ti-ce" : {
    iconSet: 'tabler icons', code: "\ued75"
  },
  
  "ti-ce-off" : {
    iconSet: 'tabler icons', code: "\uf0ca"
  },
  
  "ti-cell" : {
    iconSet: 'tabler icons', code: "\uf05f"
  },
  
  "ti-cell-signal-1" : {
    iconSet: 'tabler icons', code: "\uf083"
  },
  
  "ti-cell-signal-2" : {
    iconSet: 'tabler icons', code: "\uf084"
  },
  
  "ti-cell-signal-3" : {
    iconSet: 'tabler icons', code: "\uf085"
  },
  
  "ti-cell-signal-4" : {
    iconSet: 'tabler icons', code: "\uf086"
  },
  
  "ti-cell-signal-5" : {
    iconSet: 'tabler icons', code: "\uf087"
  },
  
  "ti-cell-signal-off" : {
    iconSet: 'tabler icons', code: "\uf088"
  },
  
  "ti-certificate" : {
    iconSet: 'tabler icons', code: "\ued76"
  },
  
  "ti-certificate-2" : {
    iconSet: 'tabler icons', code: "\uf073"
  },
  
  "ti-certificate-2-off" : {
    iconSet: 'tabler icons', code: "\uf0cb"
  },
  
  "ti-certificate-off" : {
    iconSet: 'tabler icons', code: "\uf0cc"
  },
  
  "ti-chair-director" : {
    iconSet: 'tabler icons', code: "\uf2d5"
  },
  
  "ti-chalkboard" : {
    iconSet: 'tabler icons', code: "\uf34d"
  },
  
  "ti-chalkboard-off" : {
    iconSet: 'tabler icons', code: "\uf3d1"
  },
  
  "ti-charging-pile" : {
    iconSet: 'tabler icons', code: "\uee26"
  },
  
  "ti-chart-arcs" : {
    iconSet: 'tabler icons', code: "\uee28"
  },
  
  "ti-chart-arcs-3" : {
    iconSet: 'tabler icons', code: "\uee27"
  },
  
  "ti-chart-area" : {
    iconSet: 'tabler icons', code: "\uea58"
  },
  
  "ti-chart-area-filled" : {
    iconSet: 'tabler icons', code: "\uf66b"
  },
  
  "ti-chart-area-line" : {
    iconSet: 'tabler icons', code: "\uea57"
  },
  
  "ti-chart-area-line-filled" : {
    iconSet: 'tabler icons', code: "\uf66c"
  },
  
  "ti-chart-arrows" : {
    iconSet: 'tabler icons', code: "\uee2a"
  },
  
  "ti-chart-arrows-vertical" : {
    iconSet: 'tabler icons', code: "\uee29"
  },
  
  "ti-chart-bar" : {
    iconSet: 'tabler icons', code: "\uea59"
  },
  
  "ti-chart-bar-off" : {
    iconSet: 'tabler icons', code: "\uf3d2"
  },
  
  "ti-chart-bubble" : {
    iconSet: 'tabler icons', code: "\uec75"
  },
  
  "ti-chart-bubble-filled" : {
    iconSet: 'tabler icons', code: "\uf66d"
  },
  
  "ti-chart-candle" : {
    iconSet: 'tabler icons', code: "\uea5a"
  },
  
  "ti-chart-candle-filled" : {
    iconSet: 'tabler icons', code: "\uf66e"
  },
  
  "ti-chart-circles" : {
    iconSet: 'tabler icons', code: "\uee2b"
  },
  
  "ti-chart-donut" : {
    iconSet: 'tabler icons', code: "\uea5b"
  },
  
  "ti-chart-donut-2" : {
    iconSet: 'tabler icons', code: "\uee2c"
  },
  
  "ti-chart-donut-3" : {
    iconSet: 'tabler icons', code: "\uee2d"
  },
  
  "ti-chart-donut-4" : {
    iconSet: 'tabler icons', code: "\uee2e"
  },
  
  "ti-chart-donut-filled" : {
    iconSet: 'tabler icons', code: "\uf66f"
  },
  
  "ti-chart-dots" : {
    iconSet: 'tabler icons', code: "\uee2f"
  },
  
  "ti-chart-dots-2" : {
    iconSet: 'tabler icons', code: "\uf097"
  },
  
  "ti-chart-dots-3" : {
    iconSet: 'tabler icons', code: "\uf098"
  },
  
  "ti-chart-grid-dots" : {
    iconSet: 'tabler icons', code: "\uf4c2"
  },
  
  "ti-chart-histogram" : {
    iconSet: 'tabler icons', code: "\uf65c"
  },
  
  "ti-chart-infographic" : {
    iconSet: 'tabler icons', code: "\uee30"
  },
  
  "ti-chart-line" : {
    iconSet: 'tabler icons', code: "\uea5c"
  },
  
  "ti-chart-pie" : {
    iconSet: 'tabler icons', code: "\uea5d"
  },
  
  "ti-chart-pie-2" : {
    iconSet: 'tabler icons', code: "\uee31"
  },
  
  "ti-chart-pie-3" : {
    iconSet: 'tabler icons', code: "\uee32"
  },
  
  "ti-chart-pie-4" : {
    iconSet: 'tabler icons', code: "\uee33"
  },
  
  "ti-chart-pie-filled" : {
    iconSet: 'tabler icons', code: "\uf670"
  },
  
  "ti-chart-pie-off" : {
    iconSet: 'tabler icons', code: "\uf3d3"
  },
  
  "ti-chart-ppf" : {
    iconSet: 'tabler icons', code: "\uf618"
  },
  
  "ti-chart-radar" : {
    iconSet: 'tabler icons', code: "\ued77"
  },
  
  "ti-chart-sankey" : {
    iconSet: 'tabler icons', code: "\uf619"
  },
  
  "ti-chart-treemap" : {
    iconSet: 'tabler icons', code: "\uf381"
  },
  
  "ti-check" : {
    iconSet: 'tabler icons', code: "\uea5e"
  },
  
  "ti-checkbox" : {
    iconSet: 'tabler icons', code: "\ueba6"
  },
  
  "ti-checklist" : {
    iconSet: 'tabler icons', code: "\uf074"
  },
  
  "ti-checks" : {
    iconSet: 'tabler icons', code: "\uebaa"
  },
  
  "ti-checkup-list" : {
    iconSet: 'tabler icons', code: "\uef5a"
  },
  
  "ti-cheese" : {
    iconSet: 'tabler icons', code: "\uef26"
  },
  
  "ti-chef-hat" : {
    iconSet: 'tabler icons', code: "\uf21d"
  },
  
  "ti-chef-hat-off" : {
    iconSet: 'tabler icons', code: "\uf3d4"
  },
  
  "ti-cherry" : {
    iconSet: 'tabler icons', code: "\uf511"
  },
  
  "ti-cherry-filled" : {
    iconSet: 'tabler icons', code: "\uf728"
  },
  
  "ti-chess" : {
    iconSet: 'tabler icons', code: "\uf382"
  },
  
  "ti-chess-bishop" : {
    iconSet: 'tabler icons', code: "\uf56b"
  },
  
  "ti-chess-bishop-filled" : {
    iconSet: 'tabler icons', code: "\uf729"
  },
  
  "ti-chess-filled" : {
    iconSet: 'tabler icons', code: "\uf72a"
  },
  
  "ti-chess-king" : {
    iconSet: 'tabler icons', code: "\uf56c"
  },
  
  "ti-chess-king-filled" : {
    iconSet: 'tabler icons', code: "\uf72b"
  },
  
  "ti-chess-knight" : {
    iconSet: 'tabler icons', code: "\uf56d"
  },
  
  "ti-chess-knight-filled" : {
    iconSet: 'tabler icons', code: "\uf72c"
  },
  
  "ti-chess-queen" : {
    iconSet: 'tabler icons', code: "\uf56e"
  },
  
  "ti-chess-queen-filled" : {
    iconSet: 'tabler icons', code: "\uf72d"
  },
  
  "ti-chess-rook" : {
    iconSet: 'tabler icons', code: "\uf56f"
  },
  
  "ti-chess-rook-filled" : {
    iconSet: 'tabler icons', code: "\uf72e"
  },
  
  "ti-chevron-down" : {
    iconSet: 'tabler icons', code: "\uea5f"
  },
  
  "ti-chevron-down-left" : {
    iconSet: 'tabler icons', code: "\ued09"
  },
  
  "ti-chevron-down-right" : {
    iconSet: 'tabler icons', code: "\ued0a"
  },
  
  "ti-chevron-left" : {
    iconSet: 'tabler icons', code: "\uea60"
  },
  
  "ti-chevron-right" : {
    iconSet: 'tabler icons', code: "\uea61"
  },
  
  "ti-chevron-up" : {
    iconSet: 'tabler icons', code: "\uea62"
  },
  
  "ti-chevron-up-left" : {
    iconSet: 'tabler icons', code: "\ued0b"
  },
  
  "ti-chevron-up-right" : {
    iconSet: 'tabler icons', code: "\ued0c"
  },
  
  "ti-chevrons-down" : {
    iconSet: 'tabler icons', code: "\uea63"
  },
  
  "ti-chevrons-down-left" : {
    iconSet: 'tabler icons', code: "\ued0d"
  },
  
  "ti-chevrons-down-right" : {
    iconSet: 'tabler icons', code: "\ued0e"
  },
  
  "ti-chevrons-left" : {
    iconSet: 'tabler icons', code: "\uea64"
  },
  
  "ti-chevrons-right" : {
    iconSet: 'tabler icons', code: "\uea65"
  },
  
  "ti-chevrons-up" : {
    iconSet: 'tabler icons', code: "\uea66"
  },
  
  "ti-chevrons-up-left" : {
    iconSet: 'tabler icons', code: "\ued0f"
  },
  
  "ti-chevrons-up-right" : {
    iconSet: 'tabler icons', code: "\ued10"
  },
  
  "ti-chisel" : {
    iconSet: 'tabler icons', code: "\uf383"
  },
  
  "ti-christmas-tree" : {
    iconSet: 'tabler icons', code: "\ued78"
  },
  
  "ti-christmas-tree-off" : {
    iconSet: 'tabler icons', code: "\uf3d5"
  },
  
  "ti-circle" : {
    iconSet: 'tabler icons', code: "\uea6b"
  },
  
  "ti-circle-0-filled" : {
    iconSet: 'tabler icons', code: "\uf72f"
  },
  
  "ti-circle-1-filled" : {
    iconSet: 'tabler icons', code: "\uf730"
  },
  
  "ti-circle-2-filled" : {
    iconSet: 'tabler icons', code: "\uf731"
  },
  
  "ti-circle-3-filled" : {
    iconSet: 'tabler icons', code: "\uf732"
  },
  
  "ti-circle-4-filled" : {
    iconSet: 'tabler icons', code: "\uf733"
  },
  
  "ti-circle-5-filled" : {
    iconSet: 'tabler icons', code: "\uf734"
  },
  
  "ti-circle-6-filled" : {
    iconSet: 'tabler icons', code: "\uf735"
  },
  
  "ti-circle-7-filled" : {
    iconSet: 'tabler icons', code: "\uf736"
  },
  
  "ti-circle-8-filled" : {
    iconSet: 'tabler icons', code: "\uf737"
  },
  
  "ti-circle-9-filled" : {
    iconSet: 'tabler icons', code: "\uf738"
  },
  
  "ti-circle-arrow-down" : {
    iconSet: 'tabler icons', code: "\uf6f9"
  },
  
  "ti-circle-arrow-down-filled" : {
    iconSet: 'tabler icons', code: "\uf6f4"
  },
  
  "ti-circle-arrow-down-left" : {
    iconSet: 'tabler icons', code: "\uf6f6"
  },
  
  "ti-circle-arrow-down-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6f5"
  },
  
  "ti-circle-arrow-down-right" : {
    iconSet: 'tabler icons', code: "\uf6f8"
  },
  
  "ti-circle-arrow-down-right-filled" : {
    iconSet: 'tabler icons', code: "\uf6f7"
  },
  
  "ti-circle-arrow-left" : {
    iconSet: 'tabler icons', code: "\uf6fb"
  },
  
  "ti-circle-arrow-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6fa"
  },
  
  "ti-circle-arrow-right" : {
    iconSet: 'tabler icons', code: "\uf6fd"
  },
  
  "ti-circle-arrow-right-filled" : {
    iconSet: 'tabler icons', code: "\uf6fc"
  },
  
  "ti-circle-arrow-up" : {
    iconSet: 'tabler icons', code: "\uf703"
  },
  
  "ti-circle-arrow-up-filled" : {
    iconSet: 'tabler icons', code: "\uf6fe"
  },
  
  "ti-circle-arrow-up-left" : {
    iconSet: 'tabler icons', code: "\uf700"
  },
  
  "ti-circle-arrow-up-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6ff"
  },
  
  "ti-circle-arrow-up-right" : {
    iconSet: 'tabler icons', code: "\uf702"
  },
  
  "ti-circle-arrow-up-right-filled" : {
    iconSet: 'tabler icons', code: "\uf701"
  },
  
  "ti-circle-caret-down" : {
    iconSet: 'tabler icons', code: "\uf4a9"
  },
  
  "ti-circle-caret-left" : {
    iconSet: 'tabler icons', code: "\uf4aa"
  },
  
  "ti-circle-caret-right" : {
    iconSet: 'tabler icons', code: "\uf4ab"
  },
  
  "ti-circle-caret-up" : {
    iconSet: 'tabler icons', code: "\uf4ac"
  },
  
  "ti-circle-check" : {
    iconSet: 'tabler icons', code: "\uea67"
  },
  
  "ti-circle-check-filled" : {
    iconSet: 'tabler icons', code: "\uf704"
  },
  
  "ti-circle-chevron-down" : {
    iconSet: 'tabler icons', code: "\uf622"
  },
  
  "ti-circle-chevron-left" : {
    iconSet: 'tabler icons', code: "\uf623"
  },
  
  "ti-circle-chevron-right" : {
    iconSet: 'tabler icons', code: "\uf624"
  },
  
  "ti-circle-chevron-up" : {
    iconSet: 'tabler icons', code: "\uf625"
  },
  
  "ti-circle-chevrons-down" : {
    iconSet: 'tabler icons', code: "\uf642"
  },
  
  "ti-circle-chevrons-left" : {
    iconSet: 'tabler icons', code: "\uf643"
  },
  
  "ti-circle-chevrons-right" : {
    iconSet: 'tabler icons', code: "\uf644"
  },
  
  "ti-circle-chevrons-up" : {
    iconSet: 'tabler icons', code: "\uf645"
  },
  
  "ti-circle-dashed" : {
    iconSet: 'tabler icons', code: "\ued27"
  },
  
  "ti-circle-dot" : {
    iconSet: 'tabler icons', code: "\uefb1"
  },
  
  "ti-circle-dot-filled" : {
    iconSet: 'tabler icons', code: "\uf705"
  },
  
  "ti-circle-dotted" : {
    iconSet: 'tabler icons', code: "\ued28"
  },
  
  "ti-circle-filled" : {
    iconSet: 'tabler icons', code: "\uf671"
  },
  
  "ti-circle-half" : {
    iconSet: 'tabler icons', code: "\uee3f"
  },
  
  "ti-circle-half-2" : {
    iconSet: 'tabler icons', code: "\ueff3"
  },
  
  "ti-circle-half-vertical" : {
    iconSet: 'tabler icons', code: "\uee3e"
  },
  
  "ti-circle-key" : {
    iconSet: 'tabler icons', code: "\uf633"
  },
  
  "ti-circle-key-filled" : {
    iconSet: 'tabler icons', code: "\uf706"
  },
  
  "ti-circle-letter-a" : {
    iconSet: 'tabler icons', code: "\uf441"
  },
  
  "ti-circle-letter-b" : {
    iconSet: 'tabler icons', code: "\uf442"
  },
  
  "ti-circle-letter-c" : {
    iconSet: 'tabler icons', code: "\uf443"
  },
  
  "ti-circle-letter-d" : {
    iconSet: 'tabler icons', code: "\uf444"
  },
  
  "ti-circle-letter-e" : {
    iconSet: 'tabler icons', code: "\uf445"
  },
  
  "ti-circle-letter-f" : {
    iconSet: 'tabler icons', code: "\uf446"
  },
  
  "ti-circle-letter-g" : {
    iconSet: 'tabler icons', code: "\uf447"
  },
  
  "ti-circle-letter-h" : {
    iconSet: 'tabler icons', code: "\uf448"
  },
  
  "ti-circle-letter-i" : {
    iconSet: 'tabler icons', code: "\uf449"
  },
  
  "ti-circle-letter-j" : {
    iconSet: 'tabler icons', code: "\uf44a"
  },
  
  "ti-circle-letter-k" : {
    iconSet: 'tabler icons', code: "\uf44b"
  },
  
  "ti-circle-letter-l" : {
    iconSet: 'tabler icons', code: "\uf44c"
  },
  
  "ti-circle-letter-m" : {
    iconSet: 'tabler icons', code: "\uf44d"
  },
  
  "ti-circle-letter-n" : {
    iconSet: 'tabler icons', code: "\uf44e"
  },
  
  "ti-circle-letter-o" : {
    iconSet: 'tabler icons', code: "\uf44f"
  },
  
  "ti-circle-letter-p" : {
    iconSet: 'tabler icons', code: "\uf450"
  },
  
  "ti-circle-letter-q" : {
    iconSet: 'tabler icons', code: "\uf451"
  },
  
  "ti-circle-letter-r" : {
    iconSet: 'tabler icons', code: "\uf452"
  },
  
  "ti-circle-letter-s" : {
    iconSet: 'tabler icons', code: "\uf453"
  },
  
  "ti-circle-letter-t" : {
    iconSet: 'tabler icons', code: "\uf454"
  },
  
  "ti-circle-letter-u" : {
    iconSet: 'tabler icons', code: "\uf455"
  },
  
  "ti-circle-letter-v" : {
    iconSet: 'tabler icons', code: "\uf4ad"
  },
  
  "ti-circle-letter-w" : {
    iconSet: 'tabler icons', code: "\uf456"
  },
  
  "ti-circle-letter-x" : {
    iconSet: 'tabler icons', code: "\uf4ae"
  },
  
  "ti-circle-letter-y" : {
    iconSet: 'tabler icons', code: "\uf457"
  },
  
  "ti-circle-letter-z" : {
    iconSet: 'tabler icons', code: "\uf458"
  },
  
  "ti-circle-minus" : {
    iconSet: 'tabler icons', code: "\uea68"
  },
  
  "ti-circle-number-0" : {
    iconSet: 'tabler icons', code: "\uee34"
  },
  
  "ti-circle-number-1" : {
    iconSet: 'tabler icons', code: "\uee35"
  },
  
  "ti-circle-number-2" : {
    iconSet: 'tabler icons', code: "\uee36"
  },
  
  "ti-circle-number-3" : {
    iconSet: 'tabler icons', code: "\uee37"
  },
  
  "ti-circle-number-4" : {
    iconSet: 'tabler icons', code: "\uee38"
  },
  
  "ti-circle-number-5" : {
    iconSet: 'tabler icons', code: "\uee39"
  },
  
  "ti-circle-number-6" : {
    iconSet: 'tabler icons', code: "\uee3a"
  },
  
  "ti-circle-number-7" : {
    iconSet: 'tabler icons', code: "\uee3b"
  },
  
  "ti-circle-number-8" : {
    iconSet: 'tabler icons', code: "\uee3c"
  },
  
  "ti-circle-number-9" : {
    iconSet: 'tabler icons', code: "\uee3d"
  },
  
  "ti-circle-off" : {
    iconSet: 'tabler icons', code: "\uee40"
  },
  
  "ti-circle-plus" : {
    iconSet: 'tabler icons', code: "\uea69"
  },
  
  "ti-circle-rectangle" : {
    iconSet: 'tabler icons', code: "\uf010"
  },
  
  "ti-circle-rectangle-off" : {
    iconSet: 'tabler icons', code: "\uf0cd"
  },
  
  "ti-circle-square" : {
    iconSet: 'tabler icons', code: "\uece4"
  },
  
  "ti-circle-triangle" : {
    iconSet: 'tabler icons', code: "\uf011"
  },
  
  "ti-circle-x" : {
    iconSet: 'tabler icons', code: "\uea6a"
  },
  
  "ti-circle-x-filled" : {
    iconSet: 'tabler icons', code: "\uf739"
  },
  
  "ti-circles" : {
    iconSet: 'tabler icons', code: "\uece5"
  },
  
  "ti-circles-filled" : {
    iconSet: 'tabler icons', code: "\uf672"
  },
  
  "ti-circles-relation" : {
    iconSet: 'tabler icons', code: "\uf4c3"
  },
  
  "ti-circuit-ammeter" : {
    iconSet: 'tabler icons', code: "\uf271"
  },
  
  "ti-circuit-battery" : {
    iconSet: 'tabler icons', code: "\uf272"
  },
  
  "ti-circuit-bulb" : {
    iconSet: 'tabler icons', code: "\uf273"
  },
  
  "ti-circuit-capacitor" : {
    iconSet: 'tabler icons', code: "\uf275"
  },
  
  "ti-circuit-capacitor-polarized" : {
    iconSet: 'tabler icons', code: "\uf274"
  },
  
  "ti-circuit-cell" : {
    iconSet: 'tabler icons', code: "\uf277"
  },
  
  "ti-circuit-cell-plus" : {
    iconSet: 'tabler icons', code: "\uf276"
  },
  
  "ti-circuit-changeover" : {
    iconSet: 'tabler icons', code: "\uf278"
  },
  
  "ti-circuit-diode" : {
    iconSet: 'tabler icons', code: "\uf27a"
  },
  
  "ti-circuit-diode-zener" : {
    iconSet: 'tabler icons', code: "\uf279"
  },
  
  "ti-circuit-ground" : {
    iconSet: 'tabler icons', code: "\uf27c"
  },
  
  "ti-circuit-ground-digital" : {
    iconSet: 'tabler icons', code: "\uf27b"
  },
  
  "ti-circuit-inductor" : {
    iconSet: 'tabler icons', code: "\uf27d"
  },
  
  "ti-circuit-motor" : {
    iconSet: 'tabler icons', code: "\uf27e"
  },
  
  "ti-circuit-pushbutton" : {
    iconSet: 'tabler icons', code: "\uf27f"
  },
  
  "ti-circuit-resistor" : {
    iconSet: 'tabler icons', code: "\uf280"
  },
  
  "ti-circuit-switch-closed" : {
    iconSet: 'tabler icons', code: "\uf281"
  },
  
  "ti-circuit-switch-open" : {
    iconSet: 'tabler icons', code: "\uf282"
  },
  
  "ti-circuit-voltmeter" : {
    iconSet: 'tabler icons', code: "\uf283"
  },
  
  "ti-clear-all" : {
    iconSet: 'tabler icons', code: "\uee41"
  },
  
  "ti-clear-formatting" : {
    iconSet: 'tabler icons', code: "\uebe5"
  },
  
  "ti-click" : {
    iconSet: 'tabler icons', code: "\uebbc"
  },
  
  "ti-clipboard" : {
    iconSet: 'tabler icons', code: "\uea6f"
  },
  
  "ti-clipboard-check" : {
    iconSet: 'tabler icons', code: "\uea6c"
  },
  
  "ti-clipboard-copy" : {
    iconSet: 'tabler icons', code: "\uf299"
  },
  
  "ti-clipboard-data" : {
    iconSet: 'tabler icons', code: "\uf563"
  },
  
  "ti-clipboard-heart" : {
    iconSet: 'tabler icons', code: "\uf34e"
  },
  
  "ti-clipboard-list" : {
    iconSet: 'tabler icons', code: "\uea6d"
  },
  
  "ti-clipboard-off" : {
    iconSet: 'tabler icons', code: "\uf0ce"
  },
  
  "ti-clipboard-plus" : {
    iconSet: 'tabler icons', code: "\uefb2"
  },
  
  "ti-clipboard-text" : {
    iconSet: 'tabler icons', code: "\uf089"
  },
  
  "ti-clipboard-typography" : {
    iconSet: 'tabler icons', code: "\uf34f"
  },
  
  "ti-clipboard-x" : {
    iconSet: 'tabler icons', code: "\uea6e"
  },
  
  "ti-clock" : {
    iconSet: 'tabler icons', code: "\uea70"
  },
  
  "ti-clock-2" : {
    iconSet: 'tabler icons', code: "\uf099"
  },
  
  "ti-clock-bolt" : {
    iconSet: 'tabler icons', code: "\uf844"
  },
  
  "ti-clock-cancel" : {
    iconSet: 'tabler icons', code: "\uf546"
  },
  
  "ti-clock-check" : {
    iconSet: 'tabler icons', code: "\uf7c1"
  },
  
  "ti-clock-code" : {
    iconSet: 'tabler icons', code: "\uf845"
  },
  
  "ti-clock-cog" : {
    iconSet: 'tabler icons', code: "\uf7c2"
  },
  
  "ti-clock-dollar" : {
    iconSet: 'tabler icons', code: "\uf846"
  },
  
  "ti-clock-down" : {
    iconSet: 'tabler icons', code: "\uf7c3"
  },
  
  "ti-clock-edit" : {
    iconSet: 'tabler icons', code: "\uf547"
  },
  
  "ti-clock-exclamation" : {
    iconSet: 'tabler icons', code: "\uf847"
  },
  
  "ti-clock-filled" : {
    iconSet: 'tabler icons', code: "\uf73a"
  },
  
  "ti-clock-heart" : {
    iconSet: 'tabler icons', code: "\uf7c4"
  },
  
  "ti-clock-hour-1" : {
    iconSet: 'tabler icons', code: "\uf313"
  },
  
  "ti-clock-hour-10" : {
    iconSet: 'tabler icons', code: "\uf314"
  },
  
  "ti-clock-hour-11" : {
    iconSet: 'tabler icons', code: "\uf315"
  },
  
  "ti-clock-hour-12" : {
    iconSet: 'tabler icons', code: "\uf316"
  },
  
  "ti-clock-hour-2" : {
    iconSet: 'tabler icons', code: "\uf317"
  },
  
  "ti-clock-hour-3" : {
    iconSet: 'tabler icons', code: "\uf318"
  },
  
  "ti-clock-hour-4" : {
    iconSet: 'tabler icons', code: "\uf319"
  },
  
  "ti-clock-hour-5" : {
    iconSet: 'tabler icons', code: "\uf31a"
  },
  
  "ti-clock-hour-6" : {
    iconSet: 'tabler icons', code: "\uf31b"
  },
  
  "ti-clock-hour-7" : {
    iconSet: 'tabler icons', code: "\uf31c"
  },
  
  "ti-clock-hour-8" : {
    iconSet: 'tabler icons', code: "\uf31d"
  },
  
  "ti-clock-hour-9" : {
    iconSet: 'tabler icons', code: "\uf31e"
  },
  
  "ti-clock-minus" : {
    iconSet: 'tabler icons', code: "\uf848"
  },
  
  "ti-clock-off" : {
    iconSet: 'tabler icons', code: "\uf0cf"
  },
  
  "ti-clock-pause" : {
    iconSet: 'tabler icons', code: "\uf548"
  },
  
  "ti-clock-pin" : {
    iconSet: 'tabler icons', code: "\uf849"
  },
  
  "ti-clock-play" : {
    iconSet: 'tabler icons', code: "\uf549"
  },
  
  "ti-clock-plus" : {
    iconSet: 'tabler icons', code: "\uf7c5"
  },
  
  "ti-clock-question" : {
    iconSet: 'tabler icons', code: "\uf7c6"
  },
  
  "ti-clock-record" : {
    iconSet: 'tabler icons', code: "\uf54a"
  },
  
  "ti-clock-search" : {
    iconSet: 'tabler icons', code: "\uf7c7"
  },
  
  "ti-clock-share" : {
    iconSet: 'tabler icons', code: "\uf84a"
  },
  
  "ti-clock-shield" : {
    iconSet: 'tabler icons', code: "\uf7c8"
  },
  
  "ti-clock-star" : {
    iconSet: 'tabler icons', code: "\uf7c9"
  },
  
  "ti-clock-stop" : {
    iconSet: 'tabler icons', code: "\uf54b"
  },
  
  "ti-clock-up" : {
    iconSet: 'tabler icons', code: "\uf7ca"
  },
  
  "ti-clock-x" : {
    iconSet: 'tabler icons', code: "\uf7cb"
  },
  
  "ti-clothes-rack" : {
    iconSet: 'tabler icons', code: "\uf285"
  },
  
  "ti-clothes-rack-off" : {
    iconSet: 'tabler icons', code: "\uf3d6"
  },
  
  "ti-cloud" : {
    iconSet: 'tabler icons', code: "\uea76"
  },
  
  "ti-cloud-bolt" : {
    iconSet: 'tabler icons', code: "\uf84b"
  },
  
  "ti-cloud-cancel" : {
    iconSet: 'tabler icons', code: "\uf84c"
  },
  
  "ti-cloud-check" : {
    iconSet: 'tabler icons', code: "\uf84d"
  },
  
  "ti-cloud-code" : {
    iconSet: 'tabler icons', code: "\uf84e"
  },
  
  "ti-cloud-cog" : {
    iconSet: 'tabler icons', code: "\uf84f"
  },
  
  "ti-cloud-computing" : {
    iconSet: 'tabler icons', code: "\uf1d0"
  },
  
  "ti-cloud-data-connection" : {
    iconSet: 'tabler icons', code: "\uf1d1"
  },
  
  "ti-cloud-dollar" : {
    iconSet: 'tabler icons', code: "\uf850"
  },
  
  "ti-cloud-down" : {
    iconSet: 'tabler icons', code: "\uf851"
  },
  
  "ti-cloud-download" : {
    iconSet: 'tabler icons', code: "\uea71"
  },
  
  "ti-cloud-exclamation" : {
    iconSet: 'tabler icons', code: "\uf852"
  },
  
  "ti-cloud-filled" : {
    iconSet: 'tabler icons', code: "\uf673"
  },
  
  "ti-cloud-fog" : {
    iconSet: 'tabler icons', code: "\uecd9"
  },
  
  "ti-cloud-heart" : {
    iconSet: 'tabler icons', code: "\uf853"
  },
  
  "ti-cloud-lock" : {
    iconSet: 'tabler icons', code: "\uefdb"
  },
  
  "ti-cloud-lock-open" : {
    iconSet: 'tabler icons', code: "\uefda"
  },
  
  "ti-cloud-minus" : {
    iconSet: 'tabler icons', code: "\uf854"
  },
  
  "ti-cloud-off" : {
    iconSet: 'tabler icons', code: "\ued3e"
  },
  
  "ti-cloud-pause" : {
    iconSet: 'tabler icons', code: "\uf855"
  },
  
  "ti-cloud-pin" : {
    iconSet: 'tabler icons', code: "\uf856"
  },
  
  "ti-cloud-plus" : {
    iconSet: 'tabler icons', code: "\uf857"
  },
  
  "ti-cloud-question" : {
    iconSet: 'tabler icons', code: "\uf858"
  },
  
  "ti-cloud-rain" : {
    iconSet: 'tabler icons', code: "\uea72"
  },
  
  "ti-cloud-search" : {
    iconSet: 'tabler icons', code: "\uf859"
  },
  
  "ti-cloud-share" : {
    iconSet: 'tabler icons', code: "\uf85a"
  },
  
  "ti-cloud-snow" : {
    iconSet: 'tabler icons', code: "\uea73"
  },
  
  "ti-cloud-star" : {
    iconSet: 'tabler icons', code: "\uf85b"
  },
  
  "ti-cloud-storm" : {
    iconSet: 'tabler icons', code: "\uea74"
  },
  
  "ti-cloud-up" : {
    iconSet: 'tabler icons', code: "\uf85c"
  },
  
  "ti-cloud-upload" : {
    iconSet: 'tabler icons', code: "\uea75"
  },
  
  "ti-cloud-x" : {
    iconSet: 'tabler icons', code: "\uf85d"
  },
  
  "ti-clover" : {
    iconSet: 'tabler icons', code: "\uf1ea"
  },
  
  "ti-clover-2" : {
    iconSet: 'tabler icons', code: "\uf21e"
  },
  
  "ti-clubs" : {
    iconSet: 'tabler icons', code: "\ueff4"
  },
  
  "ti-clubs-filled" : {
    iconSet: 'tabler icons', code: "\uf674"
  },
  
  "ti-code" : {
    iconSet: 'tabler icons', code: "\uea77"
  },
  
  "ti-code-asterix" : {
    iconSet: 'tabler icons', code: "\uf312"
  },
  
  "ti-code-circle" : {
    iconSet: 'tabler icons', code: "\uf4ff"
  },
  
  "ti-code-circle-2" : {
    iconSet: 'tabler icons', code: "\uf4fe"
  },
  
  "ti-code-dots" : {
    iconSet: 'tabler icons', code: "\uf61a"
  },
  
  "ti-code-minus" : {
    iconSet: 'tabler icons', code: "\uee42"
  },
  
  "ti-code-off" : {
    iconSet: 'tabler icons', code: "\uf0d0"
  },
  
  "ti-code-plus" : {
    iconSet: 'tabler icons', code: "\uee43"
  },
  
  "ti-coffee" : {
    iconSet: 'tabler icons', code: "\uef0e"
  },
  
  "ti-coffee-off" : {
    iconSet: 'tabler icons', code: "\uf106"
  },
  
  "ti-coffin" : {
    iconSet: 'tabler icons', code: "\uf579"
  },
  
  "ti-coin" : {
    iconSet: 'tabler icons', code: "\ueb82"
  },
  
  "ti-coin-bitcoin" : {
    iconSet: 'tabler icons', code: "\uf2be"
  },
  
  "ti-coin-euro" : {
    iconSet: 'tabler icons', code: "\uf2bf"
  },
  
  "ti-coin-monero" : {
    iconSet: 'tabler icons', code: "\uf4a0"
  },
  
  "ti-coin-off" : {
    iconSet: 'tabler icons', code: "\uf0d1"
  },
  
  "ti-coin-pound" : {
    iconSet: 'tabler icons', code: "\uf2c0"
  },
  
  "ti-coin-rupee" : {
    iconSet: 'tabler icons', code: "\uf2c1"
  },
  
  "ti-coin-yen" : {
    iconSet: 'tabler icons', code: "\uf2c2"
  },
  
  "ti-coin-yuan" : {
    iconSet: 'tabler icons', code: "\uf2c3"
  },
  
  "ti-coins" : {
    iconSet: 'tabler icons', code: "\uf65d"
  },
  
  "ti-color-filter" : {
    iconSet: 'tabler icons', code: "\uf5a8"
  },
  
  "ti-color-picker" : {
    iconSet: 'tabler icons', code: "\uebe6"
  },
  
  "ti-color-picker-off" : {
    iconSet: 'tabler icons', code: "\uf0d2"
  },
  
  "ti-color-swatch" : {
    iconSet: 'tabler icons', code: "\ueb61"
  },
  
  "ti-color-swatch-off" : {
    iconSet: 'tabler icons', code: "\uf0d3"
  },
  
  "ti-column-insert-left" : {
    iconSet: 'tabler icons', code: "\uee44"
  },
  
  "ti-column-insert-right" : {
    iconSet: 'tabler icons', code: "\uee45"
  },
  
  "ti-columns" : {
    iconSet: 'tabler icons', code: "\ueb83"
  },
  
  "ti-columns-1" : {
    iconSet: 'tabler icons', code: "\uf6d4"
  },
  
  "ti-columns-2" : {
    iconSet: 'tabler icons', code: "\uf6d5"
  },
  
  "ti-columns-3" : {
    iconSet: 'tabler icons', code: "\uf6d6"
  },
  
  "ti-columns-off" : {
    iconSet: 'tabler icons', code: "\uf0d4"
  },
  
  "ti-comet" : {
    iconSet: 'tabler icons', code: "\uec76"
  },
  
  "ti-command" : {
    iconSet: 'tabler icons', code: "\uea78"
  },
  
  "ti-command-off" : {
    iconSet: 'tabler icons', code: "\uf3d7"
  },
  
  "ti-compass" : {
    iconSet: 'tabler icons', code: "\uea79"
  },
  
  "ti-compass-off" : {
    iconSet: 'tabler icons', code: "\uf0d5"
  },
  
  "ti-components" : {
    iconSet: 'tabler icons', code: "\uefa5"
  },
  
  "ti-components-off" : {
    iconSet: 'tabler icons', code: "\uf0d6"
  },
  
  "ti-cone" : {
    iconSet: 'tabler icons', code: "\uefdd"
  },
  
  "ti-cone-2" : {
    iconSet: 'tabler icons', code: "\uefdc"
  },
  
  "ti-cone-off" : {
    iconSet: 'tabler icons', code: "\uf3d8"
  },
  
  "ti-confetti" : {
    iconSet: 'tabler icons', code: "\uee46"
  },
  
  "ti-confetti-off" : {
    iconSet: 'tabler icons', code: "\uf3d9"
  },
  
  "ti-confucius" : {
    iconSet: 'tabler icons', code: "\uf58a"
  },
  
  "ti-container" : {
    iconSet: 'tabler icons', code: "\uee47"
  },
  
  "ti-container-off" : {
    iconSet: 'tabler icons', code: "\uf107"
  },
  
  "ti-contrast" : {
    iconSet: 'tabler icons', code: "\uec4e"
  },
  
  "ti-contrast-2" : {
    iconSet: 'tabler icons', code: "\uefc7"
  },
  
  "ti-contrast-2-off" : {
    iconSet: 'tabler icons', code: "\uf3da"
  },
  
  "ti-contrast-off" : {
    iconSet: 'tabler icons', code: "\uf3db"
  },
  
  "ti-cooker" : {
    iconSet: 'tabler icons', code: "\uf57a"
  },
  
  "ti-cookie" : {
    iconSet: 'tabler icons', code: "\uef0f"
  },
  
  "ti-cookie-man" : {
    iconSet: 'tabler icons', code: "\uf4c4"
  },
  
  "ti-cookie-off" : {
    iconSet: 'tabler icons', code: "\uf0d7"
  },
  
  "ti-copy" : {
    iconSet: 'tabler icons', code: "\uea7a"
  },
  
  "ti-copy-off" : {
    iconSet: 'tabler icons', code: "\uf0d8"
  },
  
  "ti-copyleft" : {
    iconSet: 'tabler icons', code: "\uec3d"
  },
  
  "ti-copyleft-filled" : {
    iconSet: 'tabler icons', code: "\uf73b"
  },
  
  "ti-copyleft-off" : {
    iconSet: 'tabler icons', code: "\uf0d9"
  },
  
  "ti-copyright" : {
    iconSet: 'tabler icons', code: "\uea7b"
  },
  
  "ti-copyright-filled" : {
    iconSet: 'tabler icons', code: "\uf73c"
  },
  
  "ti-copyright-off" : {
    iconSet: 'tabler icons', code: "\uf0da"
  },
  
  "ti-corner-down-left" : {
    iconSet: 'tabler icons', code: "\uea7c"
  },
  
  "ti-corner-down-left-double" : {
    iconSet: 'tabler icons', code: "\uee48"
  },
  
  "ti-corner-down-right" : {
    iconSet: 'tabler icons', code: "\uea7d"
  },
  
  "ti-corner-down-right-double" : {
    iconSet: 'tabler icons', code: "\uee49"
  },
  
  "ti-corner-left-down" : {
    iconSet: 'tabler icons', code: "\uea7e"
  },
  
  "ti-corner-left-down-double" : {
    iconSet: 'tabler icons', code: "\uee4a"
  },
  
  "ti-corner-left-up" : {
    iconSet: 'tabler icons', code: "\uea7f"
  },
  
  "ti-corner-left-up-double" : {
    iconSet: 'tabler icons', code: "\uee4b"
  },
  
  "ti-corner-right-down" : {
    iconSet: 'tabler icons', code: "\uea80"
  },
  
  "ti-corner-right-down-double" : {
    iconSet: 'tabler icons', code: "\uee4c"
  },
  
  "ti-corner-right-up" : {
    iconSet: 'tabler icons', code: "\uea81"
  },
  
  "ti-corner-right-up-double" : {
    iconSet: 'tabler icons', code: "\uee4d"
  },
  
  "ti-corner-up-left" : {
    iconSet: 'tabler icons', code: "\uea82"
  },
  
  "ti-corner-up-left-double" : {
    iconSet: 'tabler icons', code: "\uee4e"
  },
  
  "ti-corner-up-right" : {
    iconSet: 'tabler icons', code: "\uea83"
  },
  
  "ti-corner-up-right-double" : {
    iconSet: 'tabler icons', code: "\uee4f"
  },
  
  "ti-cpu" : {
    iconSet: 'tabler icons', code: "\uef8e"
  },
  
  "ti-cpu-2" : {
    iconSet: 'tabler icons', code: "\uf075"
  },
  
  "ti-cpu-off" : {
    iconSet: 'tabler icons', code: "\uf108"
  },
  
  "ti-crane" : {
    iconSet: 'tabler icons', code: "\uef27"
  },
  
  "ti-crane-off" : {
    iconSet: 'tabler icons', code: "\uf109"
  },
  
  "ti-creative-commons" : {
    iconSet: 'tabler icons', code: "\uefb3"
  },
  
  "ti-creative-commons-by" : {
    iconSet: 'tabler icons', code: "\uf21f"
  },
  
  "ti-creative-commons-nc" : {
    iconSet: 'tabler icons', code: "\uf220"
  },
  
  "ti-creative-commons-nd" : {
    iconSet: 'tabler icons', code: "\uf221"
  },
  
  "ti-creative-commons-off" : {
    iconSet: 'tabler icons', code: "\uf10a"
  },
  
  "ti-creative-commons-sa" : {
    iconSet: 'tabler icons', code: "\uf222"
  },
  
  "ti-creative-commons-zero" : {
    iconSet: 'tabler icons', code: "\uf223"
  },
  
  "ti-credit-card" : {
    iconSet: 'tabler icons', code: "\uea84"
  },
  
  "ti-credit-card-off" : {
    iconSet: 'tabler icons', code: "\ued11"
  },
  
  "ti-cricket" : {
    iconSet: 'tabler icons', code: "\uf09a"
  },
  
  "ti-crop" : {
    iconSet: 'tabler icons', code: "\uea85"
  },
  
  "ti-cross" : {
    iconSet: 'tabler icons', code: "\uef8f"
  },
  
  "ti-cross-filled" : {
    iconSet: 'tabler icons', code: "\uf675"
  },
  
  "ti-cross-off" : {
    iconSet: 'tabler icons', code: "\uf10b"
  },
  
  "ti-crosshair" : {
    iconSet: 'tabler icons', code: "\uec3e"
  },
  
  "ti-crown" : {
    iconSet: 'tabler icons', code: "\ued12"
  },
  
  "ti-crown-off" : {
    iconSet: 'tabler icons', code: "\uee50"
  },
  
  "ti-crutches" : {
    iconSet: 'tabler icons', code: "\uef5b"
  },
  
  "ti-crutches-off" : {
    iconSet: 'tabler icons', code: "\uf10c"
  },
  
  "ti-crystal-ball" : {
    iconSet: 'tabler icons', code: "\uf57b"
  },
  
  "ti-csv" : {
    iconSet: 'tabler icons', code: "\uf791"
  },
  
  "ti-cube-send" : {
    iconSet: 'tabler icons', code: "\uf61b"
  },
  
  "ti-cube-unfolded" : {
    iconSet: 'tabler icons', code: "\uf61c"
  },
  
  "ti-cup" : {
    iconSet: 'tabler icons', code: "\uef28"
  },
  
  "ti-cup-off" : {
    iconSet: 'tabler icons', code: "\uf10d"
  },
  
  "ti-curling" : {
    iconSet: 'tabler icons', code: "\uefc8"
  },
  
  "ti-curly-loop" : {
    iconSet: 'tabler icons', code: "\uecda"
  },
  
  "ti-currency" : {
    iconSet: 'tabler icons', code: "\uefa6"
  },
  
  "ti-currency-afghani" : {
    iconSet: 'tabler icons', code: "\uf65e"
  },
  
  "ti-currency-bahraini" : {
    iconSet: 'tabler icons', code: "\uee51"
  },
  
  "ti-currency-baht" : {
    iconSet: 'tabler icons', code: "\uf08a"
  },
  
  "ti-currency-bitcoin" : {
    iconSet: 'tabler icons', code: "\uebab"
  },
  
  "ti-currency-cent" : {
    iconSet: 'tabler icons', code: "\uee53"
  },
  
  "ti-currency-dinar" : {
    iconSet: 'tabler icons', code: "\uee54"
  },
  
  "ti-currency-dirham" : {
    iconSet: 'tabler icons', code: "\uee55"
  },
  
  "ti-currency-dogecoin" : {
    iconSet: 'tabler icons', code: "\uef4b"
  },
  
  "ti-currency-dollar" : {
    iconSet: 'tabler icons', code: "\ueb84"
  },
  
  "ti-currency-dollar-australian" : {
    iconSet: 'tabler icons', code: "\uee56"
  },
  
  "ti-currency-dollar-brunei" : {
    iconSet: 'tabler icons', code: "\uf36c"
  },
  
  "ti-currency-dollar-canadian" : {
    iconSet: 'tabler icons', code: "\uee57"
  },
  
  "ti-currency-dollar-guyanese" : {
    iconSet: 'tabler icons', code: "\uf36d"
  },
  
  "ti-currency-dollar-off" : {
    iconSet: 'tabler icons', code: "\uf3dc"
  },
  
  "ti-currency-dollar-singapore" : {
    iconSet: 'tabler icons', code: "\uee58"
  },
  
  "ti-currency-dollar-zimbabwean" : {
    iconSet: 'tabler icons', code: "\uf36e"
  },
  
  "ti-currency-dong" : {
    iconSet: 'tabler icons', code: "\uf36f"
  },
  
  "ti-currency-dram" : {
    iconSet: 'tabler icons', code: "\uf370"
  },
  
  "ti-currency-ethereum" : {
    iconSet: 'tabler icons', code: "\uee59"
  },
  
  "ti-currency-euro" : {
    iconSet: 'tabler icons', code: "\ueb85"
  },
  
  "ti-currency-euro-off" : {
    iconSet: 'tabler icons', code: "\uf3dd"
  },
  
  "ti-currency-forint" : {
    iconSet: 'tabler icons', code: "\uee5a"
  },
  
  "ti-currency-frank" : {
    iconSet: 'tabler icons', code: "\uee5b"
  },
  
  "ti-currency-guarani" : {
    iconSet: 'tabler icons', code: "\uf371"
  },
  
  "ti-currency-hryvnia" : {
    iconSet: 'tabler icons', code: "\uf372"
  },
  
  "ti-currency-kip" : {
    iconSet: 'tabler icons', code: "\uf373"
  },
  
  "ti-currency-krone-czech" : {
    iconSet: 'tabler icons', code: "\uee5c"
  },
  
  "ti-currency-krone-danish" : {
    iconSet: 'tabler icons', code: "\uee5d"
  },
  
  "ti-currency-krone-swedish" : {
    iconSet: 'tabler icons', code: "\uee5e"
  },
  
  "ti-currency-lari" : {
    iconSet: 'tabler icons', code: "\uf374"
  },
  
  "ti-currency-leu" : {
    iconSet: 'tabler icons', code: "\uee5f"
  },
  
  "ti-currency-lira" : {
    iconSet: 'tabler icons', code: "\uee60"
  },
  
  "ti-currency-litecoin" : {
    iconSet: 'tabler icons', code: "\uee61"
  },
  
  "ti-currency-lyd" : {
    iconSet: 'tabler icons', code: "\uf375"
  },
  
  "ti-currency-manat" : {
    iconSet: 'tabler icons', code: "\uf376"
  },
  
  "ti-currency-monero" : {
    iconSet: 'tabler icons', code: "\uf377"
  },
  
  "ti-currency-naira" : {
    iconSet: 'tabler icons', code: "\uee62"
  },
  
  "ti-currency-nano" : {
    iconSet: 'tabler icons', code: "\uf7a6"
  },
  
  "ti-currency-off" : {
    iconSet: 'tabler icons', code: "\uf3de"
  },
  
  "ti-currency-paanga" : {
    iconSet: 'tabler icons', code: "\uf378"
  },
  
  "ti-currency-peso" : {
    iconSet: 'tabler icons', code: "\uf65f"
  },
  
  "ti-currency-pound" : {
    iconSet: 'tabler icons', code: "\uebac"
  },
  
  "ti-currency-pound-off" : {
    iconSet: 'tabler icons', code: "\uf3df"
  },
  
  "ti-currency-quetzal" : {
    iconSet: 'tabler icons', code: "\uf379"
  },
  
  "ti-currency-real" : {
    iconSet: 'tabler icons', code: "\uee63"
  },
  
  "ti-currency-renminbi" : {
    iconSet: 'tabler icons', code: "\uee64"
  },
  
  "ti-currency-ripple" : {
    iconSet: 'tabler icons', code: "\uee65"
  },
  
  "ti-currency-riyal" : {
    iconSet: 'tabler icons', code: "\uee66"
  },
  
  "ti-currency-rubel" : {
    iconSet: 'tabler icons', code: "\uee67"
  },
  
  "ti-currency-rufiyaa" : {
    iconSet: 'tabler icons', code: "\uf37a"
  },
  
  "ti-currency-rupee" : {
    iconSet: 'tabler icons', code: "\uebad"
  },
  
  "ti-currency-rupee-nepalese" : {
    iconSet: 'tabler icons', code: "\uf37b"
  },
  
  "ti-currency-shekel" : {
    iconSet: 'tabler icons', code: "\uee68"
  },
  
  "ti-currency-solana" : {
    iconSet: 'tabler icons', code: "\uf4a1"
  },
  
  "ti-currency-som" : {
    iconSet: 'tabler icons', code: "\uf37c"
  },
  
  "ti-currency-taka" : {
    iconSet: 'tabler icons', code: "\uee69"
  },
  
  "ti-currency-tenge" : {
    iconSet: 'tabler icons', code: "\uf37d"
  },
  
  "ti-currency-tugrik" : {
    iconSet: 'tabler icons', code: "\uee6a"
  },
  
  "ti-currency-won" : {
    iconSet: 'tabler icons', code: "\uee6b"
  },
  
  "ti-currency-yen" : {
    iconSet: 'tabler icons', code: "\uebae"
  },
  
  "ti-currency-yen-off" : {
    iconSet: 'tabler icons', code: "\uf3e0"
  },
  
  "ti-currency-yuan" : {
    iconSet: 'tabler icons', code: "\uf29a"
  },
  
  "ti-currency-zloty" : {
    iconSet: 'tabler icons', code: "\uee6c"
  },
  
  "ti-current-location" : {
    iconSet: 'tabler icons', code: "\uecef"
  },
  
  "ti-current-location-off" : {
    iconSet: 'tabler icons', code: "\uf10e"
  },
  
  "ti-cursor-off" : {
    iconSet: 'tabler icons', code: "\uf10f"
  },
  
  "ti-cursor-text" : {
    iconSet: 'tabler icons', code: "\uee6d"
  },
  
  "ti-cut" : {
    iconSet: 'tabler icons', code: "\uea86"
  },
  
  "ti-cylinder" : {
    iconSet: 'tabler icons', code: "\uf54c"
  },
  
  "ti-dashboard" : {
    iconSet: 'tabler icons', code: "\uea87"
  },
  
  "ti-dashboard-off" : {
    iconSet: 'tabler icons', code: "\uf3e1"
  },
  
  "ti-database" : {
    iconSet: 'tabler icons', code: "\uea88"
  },
  
  "ti-database-cog" : {
    iconSet: 'tabler icons', code: "\ufa10"
  },
  
  "ti-database-dollar" : {
    iconSet: 'tabler icons', code: "\ufa11"
  },
  
  "ti-database-edit" : {
    iconSet: 'tabler icons', code: "\ufa12"
  },
  
  "ti-database-exclamation" : {
    iconSet: 'tabler icons', code: "\ufa13"
  },
  
  "ti-database-export" : {
    iconSet: 'tabler icons', code: "\uee6e"
  },
  
  "ti-database-heart" : {
    iconSet: 'tabler icons', code: "\ufa14"
  },
  
  "ti-database-import" : {
    iconSet: 'tabler icons', code: "\uee6f"
  },
  
  "ti-database-leak" : {
    iconSet: 'tabler icons', code: "\ufa15"
  },
  
  "ti-database-minus" : {
    iconSet: 'tabler icons', code: "\ufa16"
  },
  
  "ti-database-off" : {
    iconSet: 'tabler icons', code: "\uee70"
  },
  
  "ti-database-plus" : {
    iconSet: 'tabler icons', code: "\ufa17"
  },
  
  "ti-database-search" : {
    iconSet: 'tabler icons', code: "\ufa18"
  },
  
  "ti-database-share" : {
    iconSet: 'tabler icons', code: "\ufa19"
  },
  
  "ti-database-star" : {
    iconSet: 'tabler icons', code: "\ufa1a"
  },
  
  "ti-database-x" : {
    iconSet: 'tabler icons', code: "\ufa1b"
  },
  
  "ti-decimal" : {
    iconSet: 'tabler icons', code: "\ufa26"
  },
  
  "ti-deer" : {
    iconSet: 'tabler icons', code: "\uf4c5"
  },
  
  "ti-delta" : {
    iconSet: 'tabler icons', code: "\uf53c"
  },
  
  "ti-dental" : {
    iconSet: 'tabler icons', code: "\uf025"
  },
  
  "ti-dental-broken" : {
    iconSet: 'tabler icons', code: "\uf286"
  },
  
  "ti-dental-off" : {
    iconSet: 'tabler icons', code: "\uf110"
  },
  
  "ti-deselect" : {
    iconSet: 'tabler icons', code: "\uf9f3"
  },
  
  "ti-details" : {
    iconSet: 'tabler icons', code: "\uee71"
  },
  
  "ti-details-off" : {
    iconSet: 'tabler icons', code: "\uf3e2"
  },
  
  "ti-device-airpods" : {
    iconSet: 'tabler icons', code: "\uf5a9"
  },
  
  "ti-device-airpods-case" : {
    iconSet: 'tabler icons', code: "\uf646"
  },
  
  "ti-device-analytics" : {
    iconSet: 'tabler icons', code: "\uee72"
  },
  
  "ti-device-audio-tape" : {
    iconSet: 'tabler icons', code: "\uee73"
  },
  
  "ti-device-camera-phone" : {
    iconSet: 'tabler icons', code: "\uf233"
  },
  
  "ti-device-cctv" : {
    iconSet: 'tabler icons', code: "\uee74"
  },
  
  "ti-device-cctv-off" : {
    iconSet: 'tabler icons', code: "\uf3e3"
  },
  
  "ti-device-computer-camera" : {
    iconSet: 'tabler icons', code: "\uee76"
  },
  
  "ti-device-computer-camera-off" : {
    iconSet: 'tabler icons', code: "\uee75"
  },
  
  "ti-device-desktop" : {
    iconSet: 'tabler icons', code: "\uea89"
  },
  
  "ti-device-desktop-analytics" : {
    iconSet: 'tabler icons', code: "\uee77"
  },
  
  "ti-device-desktop-bolt" : {
    iconSet: 'tabler icons', code: "\uf85e"
  },
  
  "ti-device-desktop-cancel" : {
    iconSet: 'tabler icons', code: "\uf85f"
  },
  
  "ti-device-desktop-check" : {
    iconSet: 'tabler icons', code: "\uf860"
  },
  
  "ti-device-desktop-code" : {
    iconSet: 'tabler icons', code: "\uf861"
  },
  
  "ti-device-desktop-cog" : {
    iconSet: 'tabler icons', code: "\uf862"
  },
  
  "ti-device-desktop-dollar" : {
    iconSet: 'tabler icons', code: "\uf863"
  },
  
  "ti-device-desktop-down" : {
    iconSet: 'tabler icons', code: "\uf864"
  },
  
  "ti-device-desktop-exclamation" : {
    iconSet: 'tabler icons', code: "\uf865"
  },
  
  "ti-device-desktop-heart" : {
    iconSet: 'tabler icons', code: "\uf866"
  },
  
  "ti-device-desktop-minus" : {
    iconSet: 'tabler icons', code: "\uf867"
  },
  
  "ti-device-desktop-off" : {
    iconSet: 'tabler icons', code: "\uee78"
  },
  
  "ti-device-desktop-pause" : {
    iconSet: 'tabler icons', code: "\uf868"
  },
  
  "ti-device-desktop-pin" : {
    iconSet: 'tabler icons', code: "\uf869"
  },
  
  "ti-device-desktop-plus" : {
    iconSet: 'tabler icons', code: "\uf86a"
  },
  
  "ti-device-desktop-question" : {
    iconSet: 'tabler icons', code: "\uf86b"
  },
  
  "ti-device-desktop-search" : {
    iconSet: 'tabler icons', code: "\uf86c"
  },
  
  "ti-device-desktop-share" : {
    iconSet: 'tabler icons', code: "\uf86d"
  },
  
  "ti-device-desktop-star" : {
    iconSet: 'tabler icons', code: "\uf86e"
  },
  
  "ti-device-desktop-up" : {
    iconSet: 'tabler icons', code: "\uf86f"
  },
  
  "ti-device-desktop-x" : {
    iconSet: 'tabler icons', code: "\uf870"
  },
  
  "ti-device-floppy" : {
    iconSet: 'tabler icons', code: "\ueb62"
  },
  
  "ti-device-gamepad" : {
    iconSet: 'tabler icons', code: "\ueb63"
  },
  
  "ti-device-gamepad-2" : {
    iconSet: 'tabler icons', code: "\uf1d2"
  },
  
  "ti-device-heart-monitor" : {
    iconSet: 'tabler icons', code: "\uf060"
  },
  
  "ti-device-imac" : {
    iconSet: 'tabler icons', code: "\uf7a7"
  },
  
  "ti-device-imac-bolt" : {
    iconSet: 'tabler icons', code: "\uf871"
  },
  
  "ti-device-imac-cancel" : {
    iconSet: 'tabler icons', code: "\uf872"
  },
  
  "ti-device-imac-check" : {
    iconSet: 'tabler icons', code: "\uf873"
  },
  
  "ti-device-imac-code" : {
    iconSet: 'tabler icons', code: "\uf874"
  },
  
  "ti-device-imac-cog" : {
    iconSet: 'tabler icons', code: "\uf875"
  },
  
  "ti-device-imac-dollar" : {
    iconSet: 'tabler icons', code: "\uf876"
  },
  
  "ti-device-imac-down" : {
    iconSet: 'tabler icons', code: "\uf877"
  },
  
  "ti-device-imac-exclamation" : {
    iconSet: 'tabler icons', code: "\uf878"
  },
  
  "ti-device-imac-heart" : {
    iconSet: 'tabler icons', code: "\uf879"
  },
  
  "ti-device-imac-minus" : {
    iconSet: 'tabler icons', code: "\uf87a"
  },
  
  "ti-device-imac-off" : {
    iconSet: 'tabler icons', code: "\uf87b"
  },
  
  "ti-device-imac-pause" : {
    iconSet: 'tabler icons', code: "\uf87c"
  },
  
  "ti-device-imac-pin" : {
    iconSet: 'tabler icons', code: "\uf87d"
  },
  
  "ti-device-imac-plus" : {
    iconSet: 'tabler icons', code: "\uf87e"
  },
  
  "ti-device-imac-question" : {
    iconSet: 'tabler icons', code: "\uf87f"
  },
  
  "ti-device-imac-search" : {
    iconSet: 'tabler icons', code: "\uf880"
  },
  
  "ti-device-imac-share" : {
    iconSet: 'tabler icons', code: "\uf881"
  },
  
  "ti-device-imac-star" : {
    iconSet: 'tabler icons', code: "\uf882"
  },
  
  "ti-device-imac-up" : {
    iconSet: 'tabler icons', code: "\uf883"
  },
  
  "ti-device-imac-x" : {
    iconSet: 'tabler icons', code: "\uf884"
  },
  
  "ti-device-ipad" : {
    iconSet: 'tabler icons', code: "\uf648"
  },
  
  "ti-device-ipad-bolt" : {
    iconSet: 'tabler icons', code: "\uf885"
  },
  
  "ti-device-ipad-cancel" : {
    iconSet: 'tabler icons', code: "\uf886"
  },
  
  "ti-device-ipad-check" : {
    iconSet: 'tabler icons', code: "\uf887"
  },
  
  "ti-device-ipad-code" : {
    iconSet: 'tabler icons', code: "\uf888"
  },
  
  "ti-device-ipad-cog" : {
    iconSet: 'tabler icons', code: "\uf889"
  },
  
  "ti-device-ipad-dollar" : {
    iconSet: 'tabler icons', code: "\uf88a"
  },
  
  "ti-device-ipad-down" : {
    iconSet: 'tabler icons', code: "\uf88b"
  },
  
  "ti-device-ipad-exclamation" : {
    iconSet: 'tabler icons', code: "\uf88c"
  },
  
  "ti-device-ipad-heart" : {
    iconSet: 'tabler icons', code: "\uf88d"
  },
  
  "ti-device-ipad-horizontal" : {
    iconSet: 'tabler icons', code: "\uf647"
  },
  
  "ti-device-ipad-horizontal-bolt" : {
    iconSet: 'tabler icons', code: "\uf88e"
  },
  
  "ti-device-ipad-horizontal-cancel" : {
    iconSet: 'tabler icons', code: "\uf88f"
  },
  
  "ti-device-ipad-horizontal-check" : {
    iconSet: 'tabler icons', code: "\uf890"
  },
  
  "ti-device-ipad-horizontal-code" : {
    iconSet: 'tabler icons', code: "\uf891"
  },
  
  "ti-device-ipad-horizontal-cog" : {
    iconSet: 'tabler icons', code: "\uf892"
  },
  
  "ti-device-ipad-horizontal-dollar" : {
    iconSet: 'tabler icons', code: "\uf893"
  },
  
  "ti-device-ipad-horizontal-down" : {
    iconSet: 'tabler icons', code: "\uf894"
  },
  
  "ti-device-ipad-horizontal-exclamation" : {
    iconSet: 'tabler icons', code: "\uf895"
  },
  
  "ti-device-ipad-horizontal-heart" : {
    iconSet: 'tabler icons', code: "\uf896"
  },
  
  "ti-device-ipad-horizontal-minus" : {
    iconSet: 'tabler icons', code: "\uf897"
  },
  
  "ti-device-ipad-horizontal-off" : {
    iconSet: 'tabler icons', code: "\uf898"
  },
  
  "ti-device-ipad-horizontal-pause" : {
    iconSet: 'tabler icons', code: "\uf899"
  },
  
  "ti-device-ipad-horizontal-pin" : {
    iconSet: 'tabler icons', code: "\uf89a"
  },
  
  "ti-device-ipad-horizontal-plus" : {
    iconSet: 'tabler icons', code: "\uf89b"
  },
  
  "ti-device-ipad-horizontal-question" : {
    iconSet: 'tabler icons', code: "\uf89c"
  },
  
  "ti-device-ipad-horizontal-search" : {
    iconSet: 'tabler icons', code: "\uf89d"
  },
  
  "ti-device-ipad-horizontal-share" : {
    iconSet: 'tabler icons', code: "\uf89e"
  },
  
  "ti-device-ipad-horizontal-star" : {
    iconSet: 'tabler icons', code: "\uf89f"
  },
  
  "ti-device-ipad-horizontal-up" : {
    iconSet: 'tabler icons', code: "\uf8a0"
  },
  
  "ti-device-ipad-horizontal-x" : {
    iconSet: 'tabler icons', code: "\uf8a1"
  },
  
  "ti-device-ipad-minus" : {
    iconSet: 'tabler icons', code: "\uf8a2"
  },
  
  "ti-device-ipad-off" : {
    iconSet: 'tabler icons', code: "\uf8a3"
  },
  
  "ti-device-ipad-pause" : {
    iconSet: 'tabler icons', code: "\uf8a4"
  },
  
  "ti-device-ipad-pin" : {
    iconSet: 'tabler icons', code: "\uf8a5"
  },
  
  "ti-device-ipad-plus" : {
    iconSet: 'tabler icons', code: "\uf8a6"
  },
  
  "ti-device-ipad-question" : {
    iconSet: 'tabler icons', code: "\uf8a7"
  },
  
  "ti-device-ipad-search" : {
    iconSet: 'tabler icons', code: "\uf8a8"
  },
  
  "ti-device-ipad-share" : {
    iconSet: 'tabler icons', code: "\uf8a9"
  },
  
  "ti-device-ipad-star" : {
    iconSet: 'tabler icons', code: "\uf8aa"
  },
  
  "ti-device-ipad-up" : {
    iconSet: 'tabler icons', code: "\uf8ab"
  },
  
  "ti-device-ipad-x" : {
    iconSet: 'tabler icons', code: "\uf8ac"
  },
  
  "ti-device-landline-phone" : {
    iconSet: 'tabler icons', code: "\uf649"
  },
  
  "ti-device-laptop" : {
    iconSet: 'tabler icons', code: "\ueb64"
  },
  
  "ti-device-laptop-off" : {
    iconSet: 'tabler icons', code: "\uf061"
  },
  
  "ti-device-mobile" : {
    iconSet: 'tabler icons', code: "\uea8a"
  },
  
  "ti-device-mobile-bolt" : {
    iconSet: 'tabler icons', code: "\uf8ad"
  },
  
  "ti-device-mobile-cancel" : {
    iconSet: 'tabler icons', code: "\uf8ae"
  },
  
  "ti-device-mobile-charging" : {
    iconSet: 'tabler icons', code: "\uf224"
  },
  
  "ti-device-mobile-check" : {
    iconSet: 'tabler icons', code: "\uf8af"
  },
  
  "ti-device-mobile-code" : {
    iconSet: 'tabler icons', code: "\uf8b0"
  },
  
  "ti-device-mobile-cog" : {
    iconSet: 'tabler icons', code: "\uf8b1"
  },
  
  "ti-device-mobile-dollar" : {
    iconSet: 'tabler icons', code: "\uf8b2"
  },
  
  "ti-device-mobile-down" : {
    iconSet: 'tabler icons', code: "\uf8b3"
  },
  
  "ti-device-mobile-exclamation" : {
    iconSet: 'tabler icons', code: "\uf8b4"
  },
  
  "ti-device-mobile-heart" : {
    iconSet: 'tabler icons', code: "\uf8b5"
  },
  
  "ti-device-mobile-message" : {
    iconSet: 'tabler icons', code: "\uee79"
  },
  
  "ti-device-mobile-minus" : {
    iconSet: 'tabler icons', code: "\uf8b6"
  },
  
  "ti-device-mobile-off" : {
    iconSet: 'tabler icons', code: "\uf062"
  },
  
  "ti-device-mobile-pause" : {
    iconSet: 'tabler icons', code: "\uf8b7"
  },
  
  "ti-device-mobile-pin" : {
    iconSet: 'tabler icons', code: "\uf8b8"
  },
  
  "ti-device-mobile-plus" : {
    iconSet: 'tabler icons', code: "\uf8b9"
  },
  
  "ti-device-mobile-question" : {
    iconSet: 'tabler icons', code: "\uf8ba"
  },
  
  "ti-device-mobile-rotated" : {
    iconSet: 'tabler icons', code: "\uecdb"
  },
  
  "ti-device-mobile-search" : {
    iconSet: 'tabler icons', code: "\uf8bb"
  },
  
  "ti-device-mobile-share" : {
    iconSet: 'tabler icons', code: "\uf8bc"
  },
  
  "ti-device-mobile-star" : {
    iconSet: 'tabler icons', code: "\uf8bd"
  },
  
  "ti-device-mobile-up" : {
    iconSet: 'tabler icons', code: "\uf8be"
  },
  
  "ti-device-mobile-vibration" : {
    iconSet: 'tabler icons', code: "\ueb86"
  },
  
  "ti-device-mobile-x" : {
    iconSet: 'tabler icons', code: "\uf8bf"
  },
  
  "ti-device-nintendo" : {
    iconSet: 'tabler icons', code: "\uf026"
  },
  
  "ti-device-nintendo-off" : {
    iconSet: 'tabler icons', code: "\uf111"
  },
  
  "ti-device-remote" : {
    iconSet: 'tabler icons', code: "\uf792"
  },
  
  "ti-device-sd-card" : {
    iconSet: 'tabler icons', code: "\uf384"
  },
  
  "ti-device-sim" : {
    iconSet: 'tabler icons', code: "\uf4b2"
  },
  
  "ti-device-sim-1" : {
    iconSet: 'tabler icons', code: "\uf4af"
  },
  
  "ti-device-sim-2" : {
    iconSet: 'tabler icons', code: "\uf4b0"
  },
  
  "ti-device-sim-3" : {
    iconSet: 'tabler icons', code: "\uf4b1"
  },
  
  "ti-device-speaker" : {
    iconSet: 'tabler icons', code: "\uea8b"
  },
  
  "ti-device-speaker-off" : {
    iconSet: 'tabler icons', code: "\uf112"
  },
  
  "ti-device-tablet" : {
    iconSet: 'tabler icons', code: "\uea8c"
  },
  
  "ti-device-tablet-bolt" : {
    iconSet: 'tabler icons', code: "\uf8c0"
  },
  
  "ti-device-tablet-cancel" : {
    iconSet: 'tabler icons', code: "\uf8c1"
  },
  
  "ti-device-tablet-check" : {
    iconSet: 'tabler icons', code: "\uf8c2"
  },
  
  "ti-device-tablet-code" : {
    iconSet: 'tabler icons', code: "\uf8c3"
  },
  
  "ti-device-tablet-cog" : {
    iconSet: 'tabler icons', code: "\uf8c4"
  },
  
  "ti-device-tablet-dollar" : {
    iconSet: 'tabler icons', code: "\uf8c5"
  },
  
  "ti-device-tablet-down" : {
    iconSet: 'tabler icons', code: "\uf8c6"
  },
  
  "ti-device-tablet-exclamation" : {
    iconSet: 'tabler icons', code: "\uf8c7"
  },
  
  "ti-device-tablet-heart" : {
    iconSet: 'tabler icons', code: "\uf8c8"
  },
  
  "ti-device-tablet-minus" : {
    iconSet: 'tabler icons', code: "\uf8c9"
  },
  
  "ti-device-tablet-off" : {
    iconSet: 'tabler icons', code: "\uf063"
  },
  
  "ti-device-tablet-pause" : {
    iconSet: 'tabler icons', code: "\uf8ca"
  },
  
  "ti-device-tablet-pin" : {
    iconSet: 'tabler icons', code: "\uf8cb"
  },
  
  "ti-device-tablet-plus" : {
    iconSet: 'tabler icons', code: "\uf8cc"
  },
  
  "ti-device-tablet-question" : {
    iconSet: 'tabler icons', code: "\uf8cd"
  },
  
  "ti-device-tablet-search" : {
    iconSet: 'tabler icons', code: "\uf8ce"
  },
  
  "ti-device-tablet-share" : {
    iconSet: 'tabler icons', code: "\uf8cf"
  },
  
  "ti-device-tablet-star" : {
    iconSet: 'tabler icons', code: "\uf8d0"
  },
  
  "ti-device-tablet-up" : {
    iconSet: 'tabler icons', code: "\uf8d1"
  },
  
  "ti-device-tablet-x" : {
    iconSet: 'tabler icons', code: "\uf8d2"
  },
  
  "ti-device-tv" : {
    iconSet: 'tabler icons', code: "\uea8d"
  },
  
  "ti-device-tv-off" : {
    iconSet: 'tabler icons', code: "\uf064"
  },
  
  "ti-device-tv-old" : {
    iconSet: 'tabler icons', code: "\uf1d3"
  },
  
  "ti-device-watch" : {
    iconSet: 'tabler icons', code: "\uebf9"
  },
  
  "ti-device-watch-bolt" : {
    iconSet: 'tabler icons', code: "\uf8d3"
  },
  
  "ti-device-watch-cancel" : {
    iconSet: 'tabler icons', code: "\uf8d4"
  },
  
  "ti-device-watch-check" : {
    iconSet: 'tabler icons', code: "\uf8d5"
  },
  
  "ti-device-watch-code" : {
    iconSet: 'tabler icons', code: "\uf8d6"
  },
  
  "ti-device-watch-cog" : {
    iconSet: 'tabler icons', code: "\uf8d7"
  },
  
  "ti-device-watch-dollar" : {
    iconSet: 'tabler icons', code: "\uf8d8"
  },
  
  "ti-device-watch-down" : {
    iconSet: 'tabler icons', code: "\uf8d9"
  },
  
  "ti-device-watch-exclamation" : {
    iconSet: 'tabler icons', code: "\uf8da"
  },
  
  "ti-device-watch-heart" : {
    iconSet: 'tabler icons', code: "\uf8db"
  },
  
  "ti-device-watch-minus" : {
    iconSet: 'tabler icons', code: "\uf8dc"
  },
  
  "ti-device-watch-off" : {
    iconSet: 'tabler icons', code: "\uf065"
  },
  
  "ti-device-watch-pause" : {
    iconSet: 'tabler icons', code: "\uf8dd"
  },
  
  "ti-device-watch-pin" : {
    iconSet: 'tabler icons', code: "\uf8de"
  },
  
  "ti-device-watch-plus" : {
    iconSet: 'tabler icons', code: "\uf8df"
  },
  
  "ti-device-watch-question" : {
    iconSet: 'tabler icons', code: "\uf8e0"
  },
  
  "ti-device-watch-search" : {
    iconSet: 'tabler icons', code: "\uf8e1"
  },
  
  "ti-device-watch-share" : {
    iconSet: 'tabler icons', code: "\uf8e2"
  },
  
  "ti-device-watch-star" : {
    iconSet: 'tabler icons', code: "\uf8e3"
  },
  
  "ti-device-watch-stats" : {
    iconSet: 'tabler icons', code: "\uef7d"
  },
  
  "ti-device-watch-stats-2" : {
    iconSet: 'tabler icons', code: "\uef7c"
  },
  
  "ti-device-watch-up" : {
    iconSet: 'tabler icons', code: "\uf8e4"
  },
  
  "ti-device-watch-x" : {
    iconSet: 'tabler icons', code: "\uf8e5"
  },
  
  "ti-devices" : {
    iconSet: 'tabler icons', code: "\ueb87"
  },
  
  "ti-devices-2" : {
    iconSet: 'tabler icons', code: "\ued29"
  },
  
  "ti-devices-bolt" : {
    iconSet: 'tabler icons', code: "\uf8e6"
  },
  
  "ti-devices-cancel" : {
    iconSet: 'tabler icons', code: "\uf8e7"
  },
  
  "ti-devices-check" : {
    iconSet: 'tabler icons', code: "\uf8e8"
  },
  
  "ti-devices-code" : {
    iconSet: 'tabler icons', code: "\uf8e9"
  },
  
  "ti-devices-cog" : {
    iconSet: 'tabler icons', code: "\uf8ea"
  },
  
  "ti-devices-dollar" : {
    iconSet: 'tabler icons', code: "\uf8eb"
  },
  
  "ti-devices-down" : {
    iconSet: 'tabler icons', code: "\uf8ec"
  },
  
  "ti-devices-exclamation" : {
    iconSet: 'tabler icons', code: "\uf8ed"
  },
  
  "ti-devices-heart" : {
    iconSet: 'tabler icons', code: "\uf8ee"
  },
  
  "ti-devices-minus" : {
    iconSet: 'tabler icons', code: "\uf8ef"
  },
  
  "ti-devices-off" : {
    iconSet: 'tabler icons', code: "\uf3e4"
  },
  
  "ti-devices-pause" : {
    iconSet: 'tabler icons', code: "\uf8f0"
  },
  
  "ti-devices-pc" : {
    iconSet: 'tabler icons', code: "\uee7a"
  },
  
  "ti-devices-pc-off" : {
    iconSet: 'tabler icons', code: "\uf113"
  },
  
  "ti-devices-pin" : {
    iconSet: 'tabler icons', code: "\uf8f1"
  },
  
  "ti-devices-plus" : {
    iconSet: 'tabler icons', code: "\uf8f2"
  },
  
  "ti-devices-question" : {
    iconSet: 'tabler icons', code: "\uf8f3"
  },
  
  "ti-devices-search" : {
    iconSet: 'tabler icons', code: "\uf8f4"
  },
  
  "ti-devices-share" : {
    iconSet: 'tabler icons', code: "\uf8f5"
  },
  
  "ti-devices-star" : {
    iconSet: 'tabler icons', code: "\uf8f6"
  },
  
  "ti-devices-up" : {
    iconSet: 'tabler icons', code: "\uf8f7"
  },
  
  "ti-devices-x" : {
    iconSet: 'tabler icons', code: "\uf8f8"
  },
  
  "ti-dialpad" : {
    iconSet: 'tabler icons', code: "\uf067"
  },
  
  "ti-dialpad-off" : {
    iconSet: 'tabler icons', code: "\uf114"
  },
  
  "ti-diamond" : {
    iconSet: 'tabler icons', code: "\ueb65"
  },
  
  "ti-diamond-filled" : {
    iconSet: 'tabler icons', code: "\uf73d"
  },
  
  "ti-diamond-off" : {
    iconSet: 'tabler icons', code: "\uf115"
  },
  
  "ti-diamonds" : {
    iconSet: 'tabler icons', code: "\ueff5"
  },
  
  "ti-diamonds-filled" : {
    iconSet: 'tabler icons', code: "\uf676"
  },
  
  "ti-dice" : {
    iconSet: 'tabler icons', code: "\ueb66"
  },
  
  "ti-dice-1" : {
    iconSet: 'tabler icons', code: "\uf08b"
  },
  
  "ti-dice-1-filled" : {
    iconSet: 'tabler icons', code: "\uf73e"
  },
  
  "ti-dice-2" : {
    iconSet: 'tabler icons', code: "\uf08c"
  },
  
  "ti-dice-2-filled" : {
    iconSet: 'tabler icons', code: "\uf73f"
  },
  
  "ti-dice-3" : {
    iconSet: 'tabler icons', code: "\uf08d"
  },
  
  "ti-dice-3-filled" : {
    iconSet: 'tabler icons', code: "\uf740"
  },
  
  "ti-dice-4" : {
    iconSet: 'tabler icons', code: "\uf08e"
  },
  
  "ti-dice-4-filled" : {
    iconSet: 'tabler icons', code: "\uf741"
  },
  
  "ti-dice-5" : {
    iconSet: 'tabler icons', code: "\uf08f"
  },
  
  "ti-dice-5-filled" : {
    iconSet: 'tabler icons', code: "\uf742"
  },
  
  "ti-dice-6" : {
    iconSet: 'tabler icons', code: "\uf090"
  },
  
  "ti-dice-6-filled" : {
    iconSet: 'tabler icons', code: "\uf743"
  },
  
  "ti-dice-filled" : {
    iconSet: 'tabler icons', code: "\uf744"
  },
  
  "ti-dimensions" : {
    iconSet: 'tabler icons', code: "\uee7b"
  },
  
  "ti-direction" : {
    iconSet: 'tabler icons', code: "\uebfb"
  },
  
  "ti-direction-horizontal" : {
    iconSet: 'tabler icons', code: "\uebfa"
  },
  
  "ti-direction-sign" : {
    iconSet: 'tabler icons', code: "\uf1f7"
  },
  
  "ti-direction-sign-filled" : {
    iconSet: 'tabler icons', code: "\uf745"
  },
  
  "ti-direction-sign-off" : {
    iconSet: 'tabler icons', code: "\uf3e5"
  },
  
  "ti-directions" : {
    iconSet: 'tabler icons', code: "\uea8e"
  },
  
  "ti-directions-off" : {
    iconSet: 'tabler icons', code: "\uf116"
  },
  
  "ti-disabled" : {
    iconSet: 'tabler icons', code: "\uea8f"
  },
  
  "ti-disabled-2" : {
    iconSet: 'tabler icons', code: "\uebaf"
  },
  
  "ti-disabled-off" : {
    iconSet: 'tabler icons', code: "\uf117"
  },
  
  "ti-disc" : {
    iconSet: 'tabler icons', code: "\uea90"
  },
  
  "ti-disc-golf" : {
    iconSet: 'tabler icons', code: "\uf385"
  },
  
  "ti-disc-off" : {
    iconSet: 'tabler icons', code: "\uf118"
  },
  
  "ti-discount" : {
    iconSet: 'tabler icons', code: "\uebbd"
  },
  
  "ti-discount-2" : {
    iconSet: 'tabler icons', code: "\uee7c"
  },
  
  "ti-discount-2-off" : {
    iconSet: 'tabler icons', code: "\uf3e6"
  },
  
  "ti-discount-check" : {
    iconSet: 'tabler icons', code: "\uf1f8"
  },
  
  "ti-discount-check-filled" : {
    iconSet: 'tabler icons', code: "\uf746"
  },
  
  "ti-discount-off" : {
    iconSet: 'tabler icons', code: "\uf3e7"
  },
  
  "ti-divide" : {
    iconSet: 'tabler icons', code: "\ued5c"
  },
  
  "ti-dna" : {
    iconSet: 'tabler icons', code: "\uee7d"
  },
  
  "ti-dna-2" : {
    iconSet: 'tabler icons', code: "\uef5c"
  },
  
  "ti-dna-2-off" : {
    iconSet: 'tabler icons', code: "\uf119"
  },
  
  "ti-dna-off" : {
    iconSet: 'tabler icons', code: "\uf11a"
  },
  
  "ti-dog" : {
    iconSet: 'tabler icons', code: "\uf660"
  },
  
  "ti-dog-bowl" : {
    iconSet: 'tabler icons', code: "\uef29"
  },
  
  "ti-door" : {
    iconSet: 'tabler icons', code: "\uef4e"
  },
  
  "ti-door-enter" : {
    iconSet: 'tabler icons', code: "\uef4c"
  },
  
  "ti-door-exit" : {
    iconSet: 'tabler icons', code: "\uef4d"
  },
  
  "ti-door-off" : {
    iconSet: 'tabler icons', code: "\uf11b"
  },
  
  "ti-dots" : {
    iconSet: 'tabler icons', code: "\uea95"
  },
  
  "ti-dots-circle-horizontal" : {
    iconSet: 'tabler icons', code: "\uea91"
  },
  
  "ti-dots-diagonal" : {
    iconSet: 'tabler icons', code: "\uea93"
  },
  
  "ti-dots-diagonal-2" : {
    iconSet: 'tabler icons', code: "\uea92"
  },
  
  "ti-dots-vertical" : {
    iconSet: 'tabler icons', code: "\uea94"
  },
  
  "ti-download" : {
    iconSet: 'tabler icons', code: "\uea96"
  },
  
  "ti-download-off" : {
    iconSet: 'tabler icons', code: "\uf11c"
  },
  
  "ti-drag-drop" : {
    iconSet: 'tabler icons', code: "\ueb89"
  },
  
  "ti-drag-drop-2" : {
    iconSet: 'tabler icons', code: "\ueb88"
  },
  
  "ti-drone" : {
    iconSet: 'tabler icons', code: "\ued79"
  },
  
  "ti-drone-off" : {
    iconSet: 'tabler icons', code: "\uee7e"
  },
  
  "ti-drop-circle" : {
    iconSet: 'tabler icons', code: "\uefde"
  },
  
  "ti-droplet" : {
    iconSet: 'tabler icons', code: "\uea97"
  },
  
  "ti-droplet-bolt" : {
    iconSet: 'tabler icons', code: "\uf8f9"
  },
  
  "ti-droplet-cancel" : {
    iconSet: 'tabler icons', code: "\uf8fa"
  },
  
  "ti-droplet-check" : {
    iconSet: 'tabler icons', code: "\uf8fb"
  },
  
  "ti-droplet-code" : {
    iconSet: 'tabler icons', code: "\uf8fc"
  },
  
  "ti-droplet-cog" : {
    iconSet: 'tabler icons', code: "\uf8fd"
  },
  
  "ti-droplet-dollar" : {
    iconSet: 'tabler icons', code: "\uf8fe"
  },
  
  "ti-droplet-down" : {
    iconSet: 'tabler icons', code: "\uf8ff"
  },
  
  "ti-droplet-exclamation" : {
    iconSet: 'tabler icons', code: "\uf900"
  },
  
  "ti-droplet-filled" : {
    iconSet: 'tabler icons', code: "\uee80"
  },
  
  "ti-droplet-filled-2" : {
    iconSet: 'tabler icons', code: "\uee7f"
  },
  
  "ti-droplet-half" : {
    iconSet: 'tabler icons', code: "\uee82"
  },
  
  "ti-droplet-half-2" : {
    iconSet: 'tabler icons', code: "\uee81"
  },
  
  "ti-droplet-half-filled" : {
    iconSet: 'tabler icons', code: "\uf6c5"
  },
  
  "ti-droplet-heart" : {
    iconSet: 'tabler icons', code: "\uf901"
  },
  
  "ti-droplet-minus" : {
    iconSet: 'tabler icons', code: "\uf902"
  },
  
  "ti-droplet-off" : {
    iconSet: 'tabler icons', code: "\uee83"
  },
  
  "ti-droplet-pause" : {
    iconSet: 'tabler icons', code: "\uf903"
  },
  
  "ti-droplet-pin" : {
    iconSet: 'tabler icons', code: "\uf904"
  },
  
  "ti-droplet-plus" : {
    iconSet: 'tabler icons', code: "\uf905"
  },
  
  "ti-droplet-question" : {
    iconSet: 'tabler icons', code: "\uf906"
  },
  
  "ti-droplet-search" : {
    iconSet: 'tabler icons', code: "\uf907"
  },
  
  "ti-droplet-share" : {
    iconSet: 'tabler icons', code: "\uf908"
  },
  
  "ti-droplet-star" : {
    iconSet: 'tabler icons', code: "\uf909"
  },
  
  "ti-droplet-up" : {
    iconSet: 'tabler icons', code: "\uf90a"
  },
  
  "ti-droplet-x" : {
    iconSet: 'tabler icons', code: "\uf90b"
  },
  
  "ti-e-passport" : {
    iconSet: 'tabler icons', code: "\uf4df"
  },
  
  "ti-ear" : {
    iconSet: 'tabler icons', code: "\uebce"
  },
  
  "ti-ear-off" : {
    iconSet: 'tabler icons', code: "\uee84"
  },
  
  "ti-ease-in" : {
    iconSet: 'tabler icons', code: "\uf573"
  },
  
  "ti-ease-in-control-point" : {
    iconSet: 'tabler icons', code: "\uf570"
  },
  
  "ti-ease-in-out" : {
    iconSet: 'tabler icons', code: "\uf572"
  },
  
  "ti-ease-in-out-control-points" : {
    iconSet: 'tabler icons', code: "\uf571"
  },
  
  "ti-ease-out" : {
    iconSet: 'tabler icons', code: "\uf575"
  },
  
  "ti-ease-out-control-point" : {
    iconSet: 'tabler icons', code: "\uf574"
  },
  
  "ti-edit" : {
    iconSet: 'tabler icons', code: "\uea98"
  },
  
  "ti-edit-circle" : {
    iconSet: 'tabler icons', code: "\uee85"
  },
  
  "ti-edit-circle-off" : {
    iconSet: 'tabler icons', code: "\uf11d"
  },
  
  "ti-edit-off" : {
    iconSet: 'tabler icons', code: "\uf11e"
  },
  
  "ti-egg" : {
    iconSet: 'tabler icons', code: "\ueb8a"
  },
  
  "ti-egg-cracked" : {
    iconSet: 'tabler icons', code: "\uf2d6"
  },
  
  "ti-egg-filled" : {
    iconSet: 'tabler icons', code: "\uf678"
  },
  
  "ti-egg-fried" : {
    iconSet: 'tabler icons', code: "\uf386"
  },
  
  "ti-egg-off" : {
    iconSet: 'tabler icons', code: "\uf11f"
  },
  
  "ti-eggs" : {
    iconSet: 'tabler icons', code: "\uf500"
  },
  
  "ti-elevator" : {
    iconSet: 'tabler icons', code: "\uefdf"
  },
  
  "ti-elevator-off" : {
    iconSet: 'tabler icons', code: "\uf3e8"
  },
  
  "ti-emergency-bed" : {
    iconSet: 'tabler icons', code: "\uef5d"
  },
  
  "ti-empathize" : {
    iconSet: 'tabler icons', code: "\uf29b"
  },
  
  "ti-empathize-off" : {
    iconSet: 'tabler icons', code: "\uf3e9"
  },
  
  "ti-emphasis" : {
    iconSet: 'tabler icons', code: "\uebcf"
  },
  
  "ti-engine" : {
    iconSet: 'tabler icons', code: "\uef7e"
  },
  
  "ti-engine-off" : {
    iconSet: 'tabler icons', code: "\uf120"
  },
  
  "ti-equal" : {
    iconSet: 'tabler icons', code: "\uee87"
  },
  
  "ti-equal-double" : {
    iconSet: 'tabler icons', code: "\uf4e1"
  },
  
  "ti-equal-not" : {
    iconSet: 'tabler icons', code: "\uee86"
  },
  
  "ti-eraser" : {
    iconSet: 'tabler icons', code: "\ueb8b"
  },
  
  "ti-eraser-off" : {
    iconSet: 'tabler icons', code: "\uf121"
  },
  
  "ti-error-404" : {
    iconSet: 'tabler icons', code: "\uf027"
  },
  
  "ti-error-404-off" : {
    iconSet: 'tabler icons', code: "\uf122"
  },
  
  "ti-exchange" : {
    iconSet: 'tabler icons', code: "\uebe7"
  },
  
  "ti-exchange-off" : {
    iconSet: 'tabler icons', code: "\uf123"
  },
  
  "ti-exclamation-circle" : {
    iconSet: 'tabler icons', code: "\uf634"
  },
  
  "ti-exclamation-mark" : {
    iconSet: 'tabler icons', code: "\uefb4"
  },
  
  "ti-exclamation-mark-off" : {
    iconSet: 'tabler icons', code: "\uf124"
  },
  
  "ti-explicit" : {
    iconSet: 'tabler icons', code: "\uf256"
  },
  
  "ti-explicit-off" : {
    iconSet: 'tabler icons', code: "\uf3ea"
  },
  
  "ti-exposure" : {
    iconSet: 'tabler icons', code: "\ueb8c"
  },
  
  "ti-exposure-0" : {
    iconSet: 'tabler icons', code: "\uf29c"
  },
  
  "ti-exposure-minus-1" : {
    iconSet: 'tabler icons', code: "\uf29d"
  },
  
  "ti-exposure-minus-2" : {
    iconSet: 'tabler icons', code: "\uf29e"
  },
  
  "ti-exposure-off" : {
    iconSet: 'tabler icons', code: "\uf3eb"
  },
  
  "ti-exposure-plus-1" : {
    iconSet: 'tabler icons', code: "\uf29f"
  },
  
  "ti-exposure-plus-2" : {
    iconSet: 'tabler icons', code: "\uf2a0"
  },
  
  "ti-external-link" : {
    iconSet: 'tabler icons', code: "\uea99"
  },
  
  "ti-external-link-off" : {
    iconSet: 'tabler icons', code: "\uf125"
  },
  
  "ti-eye" : {
    iconSet: 'tabler icons', code: "\uea9a"
  },
  
  "ti-eye-check" : {
    iconSet: 'tabler icons', code: "\uee88"
  },
  
  "ti-eye-closed" : {
    iconSet: 'tabler icons', code: "\uf7ec"
  },
  
  "ti-eye-cog" : {
    iconSet: 'tabler icons', code: "\uf7ed"
  },
  
  "ti-eye-edit" : {
    iconSet: 'tabler icons', code: "\uf7ee"
  },
  
  "ti-eye-exclamation" : {
    iconSet: 'tabler icons', code: "\uf7ef"
  },
  
  "ti-eye-filled" : {
    iconSet: 'tabler icons', code: "\uf679"
  },
  
  "ti-eye-heart" : {
    iconSet: 'tabler icons', code: "\uf7f0"
  },
  
  "ti-eye-off" : {
    iconSet: 'tabler icons', code: "\uecf0"
  },
  
  "ti-eye-table" : {
    iconSet: 'tabler icons', code: "\uef5e"
  },
  
  "ti-eye-x" : {
    iconSet: 'tabler icons', code: "\uf7f1"
  },
  
  "ti-eyeglass" : {
    iconSet: 'tabler icons', code: "\uee8a"
  },
  
  "ti-eyeglass-2" : {
    iconSet: 'tabler icons', code: "\uee89"
  },
  
  "ti-eyeglass-off" : {
    iconSet: 'tabler icons', code: "\uf126"
  },
  
  "ti-face-id" : {
    iconSet: 'tabler icons', code: "\uea9b"
  },
  
  "ti-face-id-error" : {
    iconSet: 'tabler icons', code: "\uefa7"
  },
  
  "ti-face-mask" : {
    iconSet: 'tabler icons', code: "\uefb5"
  },
  
  "ti-face-mask-off" : {
    iconSet: 'tabler icons', code: "\uf127"
  },
  
  "ti-fall" : {
    iconSet: 'tabler icons', code: "\uecb9"
  },
  
  "ti-feather" : {
    iconSet: 'tabler icons', code: "\uee8b"
  },
  
  "ti-feather-off" : {
    iconSet: 'tabler icons', code: "\uf128"
  },
  
  "ti-fence" : {
    iconSet: 'tabler icons', code: "\uef2a"
  },
  
  "ti-fence-off" : {
    iconSet: 'tabler icons', code: "\uf129"
  },
  
  "ti-fidget-spinner" : {
    iconSet: 'tabler icons', code: "\uf068"
  },
  
  "ti-file" : {
    iconSet: 'tabler icons', code: "\ueaa4"
  },
  
  "ti-file-3d" : {
    iconSet: 'tabler icons', code: "\uf032"
  },
  
  "ti-file-alert" : {
    iconSet: 'tabler icons', code: "\uede6"
  },
  
  "ti-file-analytics" : {
    iconSet: 'tabler icons', code: "\uede7"
  },
  
  "ti-file-arrow-left" : {
    iconSet: 'tabler icons', code: "\uf033"
  },
  
  "ti-file-arrow-right" : {
    iconSet: 'tabler icons', code: "\uf034"
  },
  
  "ti-file-barcode" : {
    iconSet: 'tabler icons', code: "\uf035"
  },
  
  "ti-file-broken" : {
    iconSet: 'tabler icons', code: "\uf501"
  },
  
  "ti-file-certificate" : {
    iconSet: 'tabler icons', code: "\ued4d"
  },
  
  "ti-file-chart" : {
    iconSet: 'tabler icons', code: "\uf036"
  },
  
  "ti-file-check" : {
    iconSet: 'tabler icons', code: "\uea9c"
  },
  
  "ti-file-code" : {
    iconSet: 'tabler icons', code: "\uebd0"
  },
  
  "ti-file-code-2" : {
    iconSet: 'tabler icons', code: "\uede8"
  },
  
  "ti-file-database" : {
    iconSet: 'tabler icons', code: "\uf037"
  },
  
  "ti-file-delta" : {
    iconSet: 'tabler icons', code: "\uf53d"
  },
  
  "ti-file-description" : {
    iconSet: 'tabler icons', code: "\uf028"
  },
  
  "ti-file-diff" : {
    iconSet: 'tabler icons', code: "\uecf1"
  },
  
  "ti-file-digit" : {
    iconSet: 'tabler icons', code: "\uefa8"
  },
  
  "ti-file-dislike" : {
    iconSet: 'tabler icons', code: "\ued2a"
  },
  
  "ti-file-dollar" : {
    iconSet: 'tabler icons', code: "\uefe0"
  },
  
  "ti-file-dots" : {
    iconSet: 'tabler icons', code: "\uf038"
  },
  
  "ti-file-download" : {
    iconSet: 'tabler icons', code: "\uea9d"
  },
  
  "ti-file-euro" : {
    iconSet: 'tabler icons', code: "\uefe1"
  },
  
  "ti-file-export" : {
    iconSet: 'tabler icons', code: "\uede9"
  },
  
  "ti-file-filled" : {
    iconSet: 'tabler icons', code: "\uf747"
  },
  
  "ti-file-function" : {
    iconSet: 'tabler icons', code: "\uf53e"
  },
  
  "ti-file-horizontal" : {
    iconSet: 'tabler icons', code: "\uebb0"
  },
  
  "ti-file-import" : {
    iconSet: 'tabler icons', code: "\uedea"
  },
  
  "ti-file-infinity" : {
    iconSet: 'tabler icons', code: "\uf502"
  },
  
  "ti-file-info" : {
    iconSet: 'tabler icons', code: "\uedec"
  },
  
  "ti-file-invoice" : {
    iconSet: 'tabler icons', code: "\ueb67"
  },
  
  "ti-file-lambda" : {
    iconSet: 'tabler icons', code: "\uf53f"
  },
  
  "ti-file-like" : {
    iconSet: 'tabler icons', code: "\ued2b"
  },
  
  "ti-file-minus" : {
    iconSet: 'tabler icons', code: "\uea9e"
  },
  
  "ti-file-music" : {
    iconSet: 'tabler icons', code: "\uea9f"
  },
  
  "ti-file-off" : {
    iconSet: 'tabler icons', code: "\uecf2"
  },
  
  "ti-file-orientation" : {
    iconSet: 'tabler icons', code: "\uf2a1"
  },
  
  "ti-file-pencil" : {
    iconSet: 'tabler icons', code: "\uf039"
  },
  
  "ti-file-percent" : {
    iconSet: 'tabler icons', code: "\uf540"
  },
  
  "ti-file-phone" : {
    iconSet: 'tabler icons', code: "\uecdc"
  },
  
  "ti-file-plus" : {
    iconSet: 'tabler icons', code: "\ueaa0"
  },
  
  "ti-file-power" : {
    iconSet: 'tabler icons', code: "\uf03a"
  },
  
  "ti-file-report" : {
    iconSet: 'tabler icons', code: "\ueded"
  },
  
  "ti-file-rss" : {
    iconSet: 'tabler icons', code: "\uf03b"
  },
  
  "ti-file-scissors" : {
    iconSet: 'tabler icons', code: "\uf03c"
  },
  
  "ti-file-search" : {
    iconSet: 'tabler icons', code: "\ued5d"
  },
  
  "ti-file-settings" : {
    iconSet: 'tabler icons', code: "\uf029"
  },
  
  "ti-file-shredder" : {
    iconSet: 'tabler icons', code: "\ueaa1"
  },
  
  "ti-file-signal" : {
    iconSet: 'tabler icons', code: "\uf03d"
  },
  
  "ti-file-spreadsheet" : {
    iconSet: 'tabler icons', code: "\uf03e"
  },
  
  "ti-file-stack" : {
    iconSet: 'tabler icons', code: "\uf503"
  },
  
  "ti-file-star" : {
    iconSet: 'tabler icons', code: "\uf03f"
  },
  
  "ti-file-symlink" : {
    iconSet: 'tabler icons', code: "\ued53"
  },
  
  "ti-file-text" : {
    iconSet: 'tabler icons', code: "\ueaa2"
  },
  
  "ti-file-text-ai" : {
    iconSet: 'tabler icons', code: "\ufa27"
  },
  
  "ti-file-time" : {
    iconSet: 'tabler icons', code: "\uf040"
  },
  
  "ti-file-typography" : {
    iconSet: 'tabler icons', code: "\uf041"
  },
  
  "ti-file-unknown" : {
    iconSet: 'tabler icons', code: "\uf042"
  },
  
  "ti-file-upload" : {
    iconSet: 'tabler icons', code: "\uec91"
  },
  
  "ti-file-vector" : {
    iconSet: 'tabler icons', code: "\uf043"
  },
  
  "ti-file-x" : {
    iconSet: 'tabler icons', code: "\ueaa3"
  },
  
  "ti-file-x-filled" : {
    iconSet: 'tabler icons', code: "\uf748"
  },
  
  "ti-file-zip" : {
    iconSet: 'tabler icons', code: "\ued4e"
  },
  
  "ti-files" : {
    iconSet: 'tabler icons', code: "\uedef"
  },
  
  "ti-files-off" : {
    iconSet: 'tabler icons', code: "\uedee"
  },
  
  "ti-filter" : {
    iconSet: 'tabler icons', code: "\ueaa5"
  },
  
  "ti-filter-cog" : {
    iconSet: 'tabler icons', code: "\uf9fe"
  },
  
  "ti-filter-dollar" : {
    iconSet: 'tabler icons', code: "\uf9ff"
  },
  
  "ti-filter-edit" : {
    iconSet: 'tabler icons', code: "\ufa00"
  },
  
  "ti-filter-minus" : {
    iconSet: 'tabler icons', code: "\ufa01"
  },
  
  "ti-filter-off" : {
    iconSet: 'tabler icons', code: "\ued2c"
  },
  
  "ti-filter-plus" : {
    iconSet: 'tabler icons', code: "\ufa02"
  },
  
  "ti-filter-star" : {
    iconSet: 'tabler icons', code: "\ufa03"
  },
  
  "ti-filter-x" : {
    iconSet: 'tabler icons', code: "\ufa04"
  },
  
  "ti-filters" : {
    iconSet: 'tabler icons', code: "\uf793"
  },
  
  "ti-fingerprint" : {
    iconSet: 'tabler icons', code: "\uebd1"
  },
  
  "ti-fingerprint-off" : {
    iconSet: 'tabler icons', code: "\uf12a"
  },
  
  "ti-fire-hydrant" : {
    iconSet: 'tabler icons', code: "\uf3a9"
  },
  
  "ti-fire-hydrant-off" : {
    iconSet: 'tabler icons', code: "\uf3ec"
  },
  
  "ti-firetruck" : {
    iconSet: 'tabler icons', code: "\uebe8"
  },
  
  "ti-first-aid-kit" : {
    iconSet: 'tabler icons', code: "\uef5f"
  },
  
  "ti-first-aid-kit-off" : {
    iconSet: 'tabler icons', code: "\uf3ed"
  },
  
  "ti-fish" : {
    iconSet: 'tabler icons', code: "\uef2b"
  },
  
  "ti-fish-bone" : {
    iconSet: 'tabler icons', code: "\uf287"
  },
  
  "ti-fish-christianity" : {
    iconSet: 'tabler icons', code: "\uf58b"
  },
  
  "ti-fish-hook" : {
    iconSet: 'tabler icons', code: "\uf1f9"
  },
  
  "ti-fish-hook-off" : {
    iconSet: 'tabler icons', code: "\uf3ee"
  },
  
  "ti-fish-off" : {
    iconSet: 'tabler icons', code: "\uf12b"
  },
  
  "ti-flag" : {
    iconSet: 'tabler icons', code: "\ueaa6"
  },
  
  "ti-flag-2" : {
    iconSet: 'tabler icons', code: "\uee8c"
  },
  
  "ti-flag-2-filled" : {
    iconSet: 'tabler icons', code: "\uf707"
  },
  
  "ti-flag-2-off" : {
    iconSet: 'tabler icons', code: "\uf12c"
  },
  
  "ti-flag-3" : {
    iconSet: 'tabler icons', code: "\uee8d"
  },
  
  "ti-flag-3-filled" : {
    iconSet: 'tabler icons', code: "\uf708"
  },
  
  "ti-flag-filled" : {
    iconSet: 'tabler icons', code: "\uf67a"
  },
  
  "ti-flag-off" : {
    iconSet: 'tabler icons', code: "\uf12d"
  },
  
  "ti-flame" : {
    iconSet: 'tabler icons', code: "\uec2c"
  },
  
  "ti-flame-off" : {
    iconSet: 'tabler icons', code: "\uf12e"
  },
  
  "ti-flare" : {
    iconSet: 'tabler icons', code: "\uee8e"
  },
  
  "ti-flask" : {
    iconSet: 'tabler icons', code: "\uebd2"
  },
  
  "ti-flask-2" : {
    iconSet: 'tabler icons', code: "\uef60"
  },
  
  "ti-flask-2-off" : {
    iconSet: 'tabler icons', code: "\uf12f"
  },
  
  "ti-flask-off" : {
    iconSet: 'tabler icons', code: "\uf130"
  },
  
  "ti-flip-flops" : {
    iconSet: 'tabler icons', code: "\uf564"
  },
  
  "ti-flip-horizontal" : {
    iconSet: 'tabler icons', code: "\ueaa7"
  },
  
  "ti-flip-vertical" : {
    iconSet: 'tabler icons', code: "\ueaa8"
  },
  
  "ti-float-center" : {
    iconSet: 'tabler icons', code: "\uebb1"
  },
  
  "ti-float-left" : {
    iconSet: 'tabler icons', code: "\uebb2"
  },
  
  "ti-float-none" : {
    iconSet: 'tabler icons', code: "\ued13"
  },
  
  "ti-float-right" : {
    iconSet: 'tabler icons', code: "\uebb3"
  },
  
  "ti-flower" : {
    iconSet: 'tabler icons', code: "\ueff6"
  },
  
  "ti-flower-off" : {
    iconSet: 'tabler icons', code: "\uf131"
  },
  
  "ti-focus" : {
    iconSet: 'tabler icons', code: "\ueb8d"
  },
  
  "ti-focus-2" : {
    iconSet: 'tabler icons', code: "\uebd3"
  },
  
  "ti-focus-centered" : {
    iconSet: 'tabler icons', code: "\uf02a"
  },
  
  "ti-fold" : {
    iconSet: 'tabler icons', code: "\ued56"
  },
  
  "ti-fold-down" : {
    iconSet: 'tabler icons', code: "\ued54"
  },
  
  "ti-fold-up" : {
    iconSet: 'tabler icons', code: "\ued55"
  },
  
  "ti-folder" : {
    iconSet: 'tabler icons', code: "\ueaad"
  },
  
  "ti-folder-bolt" : {
    iconSet: 'tabler icons', code: "\uf90c"
  },
  
  "ti-folder-cancel" : {
    iconSet: 'tabler icons', code: "\uf90d"
  },
  
  "ti-folder-check" : {
    iconSet: 'tabler icons', code: "\uf90e"
  },
  
  "ti-folder-code" : {
    iconSet: 'tabler icons', code: "\uf90f"
  },
  
  "ti-folder-cog" : {
    iconSet: 'tabler icons', code: "\uf910"
  },
  
  "ti-folder-dollar" : {
    iconSet: 'tabler icons', code: "\uf911"
  },
  
  "ti-folder-down" : {
    iconSet: 'tabler icons', code: "\uf912"
  },
  
  "ti-folder-exclamation" : {
    iconSet: 'tabler icons', code: "\uf913"
  },
  
  "ti-folder-filled" : {
    iconSet: 'tabler icons', code: "\uf749"
  },
  
  "ti-folder-heart" : {
    iconSet: 'tabler icons', code: "\uf914"
  },
  
  "ti-folder-minus" : {
    iconSet: 'tabler icons', code: "\ueaaa"
  },
  
  "ti-folder-off" : {
    iconSet: 'tabler icons', code: "\ued14"
  },
  
  "ti-folder-pause" : {
    iconSet: 'tabler icons', code: "\uf915"
  },
  
  "ti-folder-pin" : {
    iconSet: 'tabler icons', code: "\uf916"
  },
  
  "ti-folder-plus" : {
    iconSet: 'tabler icons', code: "\ueaab"
  },
  
  "ti-folder-question" : {
    iconSet: 'tabler icons', code: "\uf917"
  },
  
  "ti-folder-search" : {
    iconSet: 'tabler icons', code: "\uf918"
  },
  
  "ti-folder-share" : {
    iconSet: 'tabler icons', code: "\uf919"
  },
  
  "ti-folder-star" : {
    iconSet: 'tabler icons', code: "\uf91a"
  },
  
  "ti-folder-symlink" : {
    iconSet: 'tabler icons', code: "\uf91b"
  },
  
  "ti-folder-up" : {
    iconSet: 'tabler icons', code: "\uf91c"
  },
  
  "ti-folder-x" : {
    iconSet: 'tabler icons', code: "\ueaac"
  },
  
  "ti-folders" : {
    iconSet: 'tabler icons', code: "\ueaae"
  },
  
  "ti-folders-off" : {
    iconSet: 'tabler icons', code: "\uf133"
  },
  
  "ti-forbid" : {
    iconSet: 'tabler icons', code: "\uebd5"
  },
  
  "ti-forbid-2" : {
    iconSet: 'tabler icons', code: "\uebd4"
  },
  
  "ti-forklift" : {
    iconSet: 'tabler icons', code: "\uebe9"
  },
  
  "ti-forms" : {
    iconSet: 'tabler icons', code: "\uee8f"
  },
  
  "ti-fountain" : {
    iconSet: 'tabler icons', code: "\uf09b"
  },
  
  "ti-fountain-off" : {
    iconSet: 'tabler icons', code: "\uf134"
  },
  
  "ti-frame" : {
    iconSet: 'tabler icons', code: "\ueaaf"
  },
  
  "ti-frame-off" : {
    iconSet: 'tabler icons', code: "\uf135"
  },
  
  "ti-free-rights" : {
    iconSet: 'tabler icons', code: "\uefb6"
  },
  
  "ti-fridge" : {
    iconSet: 'tabler icons', code: "\uf1fa"
  },
  
  "ti-fridge-off" : {
    iconSet: 'tabler icons', code: "\uf3ef"
  },
  
  "ti-friends" : {
    iconSet: 'tabler icons', code: "\ueab0"
  },
  
  "ti-friends-off" : {
    iconSet: 'tabler icons', code: "\uf136"
  },
  
  "ti-function" : {
    iconSet: 'tabler icons', code: "\uf225"
  },
  
  "ti-function-off" : {
    iconSet: 'tabler icons', code: "\uf3f0"
  },
  
  "ti-garden-cart" : {
    iconSet: 'tabler icons', code: "\uf23e"
  },
  
  "ti-garden-cart-off" : {
    iconSet: 'tabler icons', code: "\uf3f1"
  },
  
  "ti-gas-station" : {
    iconSet: 'tabler icons', code: "\uec7d"
  },
  
  "ti-gas-station-off" : {
    iconSet: 'tabler icons', code: "\uf137"
  },
  
  "ti-gauge" : {
    iconSet: 'tabler icons', code: "\ueab1"
  },
  
  "ti-gauge-off" : {
    iconSet: 'tabler icons', code: "\uf138"
  },
  
  "ti-gavel" : {
    iconSet: 'tabler icons', code: "\uef90"
  },
  
  "ti-gender-agender" : {
    iconSet: 'tabler icons', code: "\uf0e1"
  },
  
  "ti-gender-androgyne" : {
    iconSet: 'tabler icons', code: "\uf0e2"
  },
  
  "ti-gender-bigender" : {
    iconSet: 'tabler icons', code: "\uf0e3"
  },
  
  "ti-gender-demiboy" : {
    iconSet: 'tabler icons', code: "\uf0e4"
  },
  
  "ti-gender-demigirl" : {
    iconSet: 'tabler icons', code: "\uf0e5"
  },
  
  "ti-gender-epicene" : {
    iconSet: 'tabler icons', code: "\uf0e6"
  },
  
  "ti-gender-female" : {
    iconSet: 'tabler icons', code: "\uf0e7"
  },
  
  "ti-gender-femme" : {
    iconSet: 'tabler icons', code: "\uf0e8"
  },
  
  "ti-gender-genderfluid" : {
    iconSet: 'tabler icons', code: "\uf0e9"
  },
  
  "ti-gender-genderless" : {
    iconSet: 'tabler icons', code: "\uf0ea"
  },
  
  "ti-gender-genderqueer" : {
    iconSet: 'tabler icons', code: "\uf0eb"
  },
  
  "ti-gender-hermaphrodite" : {
    iconSet: 'tabler icons', code: "\uf0ec"
  },
  
  "ti-gender-intergender" : {
    iconSet: 'tabler icons', code: "\uf0ed"
  },
  
  "ti-gender-male" : {
    iconSet: 'tabler icons', code: "\uf0ee"
  },
  
  "ti-gender-neutrois" : {
    iconSet: 'tabler icons', code: "\uf0ef"
  },
  
  "ti-gender-third" : {
    iconSet: 'tabler icons', code: "\uf0f0"
  },
  
  "ti-gender-transgender" : {
    iconSet: 'tabler icons', code: "\uf0f1"
  },
  
  "ti-gender-trasvesti" : {
    iconSet: 'tabler icons', code: "\uf0f2"
  },
  
  "ti-geometry" : {
    iconSet: 'tabler icons', code: "\uee90"
  },
  
  "ti-ghost" : {
    iconSet: 'tabler icons', code: "\ueb8e"
  },
  
  "ti-ghost-2" : {
    iconSet: 'tabler icons', code: "\uf57c"
  },
  
  "ti-ghost-2-filled" : {
    iconSet: 'tabler icons', code: "\uf74a"
  },
  
  "ti-ghost-filled" : {
    iconSet: 'tabler icons', code: "\uf74b"
  },
  
  "ti-ghost-off" : {
    iconSet: 'tabler icons', code: "\uf3f2"
  },
  
  "ti-gif" : {
    iconSet: 'tabler icons', code: "\uf257"
  },
  
  "ti-gift" : {
    iconSet: 'tabler icons', code: "\ueb68"
  },
  
  "ti-gift-card" : {
    iconSet: 'tabler icons', code: "\uf3aa"
  },
  
  "ti-gift-off" : {
    iconSet: 'tabler icons', code: "\uf3f3"
  },
  
  "ti-git-branch" : {
    iconSet: 'tabler icons', code: "\ueab2"
  },
  
  "ti-git-branch-deleted" : {
    iconSet: 'tabler icons', code: "\uf57d"
  },
  
  "ti-git-cherry-pick" : {
    iconSet: 'tabler icons', code: "\uf57e"
  },
  
  "ti-git-commit" : {
    iconSet: 'tabler icons', code: "\ueab3"
  },
  
  "ti-git-compare" : {
    iconSet: 'tabler icons', code: "\ueab4"
  },
  
  "ti-git-fork" : {
    iconSet: 'tabler icons', code: "\ueb8f"
  },
  
  "ti-git-merge" : {
    iconSet: 'tabler icons', code: "\ueab5"
  },
  
  "ti-git-pull-request" : {
    iconSet: 'tabler icons', code: "\ueab6"
  },
  
  "ti-git-pull-request-closed" : {
    iconSet: 'tabler icons', code: "\uef7f"
  },
  
  "ti-git-pull-request-draft" : {
    iconSet: 'tabler icons', code: "\uefb7"
  },
  
  "ti-gizmo" : {
    iconSet: 'tabler icons', code: "\uf02b"
  },
  
  "ti-glass" : {
    iconSet: 'tabler icons', code: "\ueab8"
  },
  
  "ti-glass-full" : {
    iconSet: 'tabler icons', code: "\ueab7"
  },
  
  "ti-glass-off" : {
    iconSet: 'tabler icons', code: "\uee91"
  },
  
  "ti-globe" : {
    iconSet: 'tabler icons', code: "\ueab9"
  },
  
  "ti-globe-off" : {
    iconSet: 'tabler icons', code: "\uf139"
  },
  
  "ti-go-game" : {
    iconSet: 'tabler icons', code: "\uf512"
  },
  
  "ti-golf" : {
    iconSet: 'tabler icons', code: "\ued8c"
  },
  
  "ti-golf-off" : {
    iconSet: 'tabler icons', code: "\uf13a"
  },
  
  "ti-gps" : {
    iconSet: 'tabler icons', code: "\ued7a"
  },
  
  "ti-gradienter" : {
    iconSet: 'tabler icons', code: "\uf3ab"
  },
  
  "ti-grain" : {
    iconSet: 'tabler icons', code: "\uee92"
  },
  
  "ti-graph" : {
    iconSet: 'tabler icons', code: "\uf288"
  },
  
  "ti-graph-off" : {
    iconSet: 'tabler icons', code: "\uf3f4"
  },
  
  "ti-grave" : {
    iconSet: 'tabler icons', code: "\uf580"
  },
  
  "ti-grave-2" : {
    iconSet: 'tabler icons', code: "\uf57f"
  },
  
  "ti-grid-dots" : {
    iconSet: 'tabler icons', code: "\ueaba"
  },
  
  "ti-grid-pattern" : {
    iconSet: 'tabler icons', code: "\uefc9"
  },
  
  "ti-grill" : {
    iconSet: 'tabler icons', code: "\uefa9"
  },
  
  "ti-grill-fork" : {
    iconSet: 'tabler icons', code: "\uf35b"
  },
  
  "ti-grill-off" : {
    iconSet: 'tabler icons', code: "\uf3f5"
  },
  
  "ti-grill-spatula" : {
    iconSet: 'tabler icons', code: "\uf35c"
  },
  
  "ti-grip-horizontal" : {
    iconSet: 'tabler icons', code: "\uec00"
  },
  
  "ti-grip-vertical" : {
    iconSet: 'tabler icons', code: "\uec01"
  },
  
  "ti-growth" : {
    iconSet: 'tabler icons', code: "\uee93"
  },
  
  "ti-guitar-pick" : {
    iconSet: 'tabler icons', code: "\uf4c6"
  },
  
  "ti-guitar-pick-filled" : {
    iconSet: 'tabler icons', code: "\uf67b"
  },
  
  "ti-h-1" : {
    iconSet: 'tabler icons', code: "\uec94"
  },
  
  "ti-h-2" : {
    iconSet: 'tabler icons', code: "\uec95"
  },
  
  "ti-h-3" : {
    iconSet: 'tabler icons', code: "\uec96"
  },
  
  "ti-h-4" : {
    iconSet: 'tabler icons', code: "\uec97"
  },
  
  "ti-h-5" : {
    iconSet: 'tabler icons', code: "\uec98"
  },
  
  "ti-h-6" : {
    iconSet: 'tabler icons', code: "\uec99"
  },
  
  "ti-hammer" : {
    iconSet: 'tabler icons', code: "\uef91"
  },
  
  "ti-hammer-off" : {
    iconSet: 'tabler icons', code: "\uf13c"
  },
  
  "ti-hand-click" : {
    iconSet: 'tabler icons', code: "\uef4f"
  },
  
  "ti-hand-finger" : {
    iconSet: 'tabler icons', code: "\uee94"
  },
  
  "ti-hand-finger-off" : {
    iconSet: 'tabler icons', code: "\uf13d"
  },
  
  "ti-hand-grab" : {
    iconSet: 'tabler icons', code: "\uf091"
  },
  
  "ti-hand-little-finger" : {
    iconSet: 'tabler icons', code: "\uee95"
  },
  
  "ti-hand-middle-finger" : {
    iconSet: 'tabler icons', code: "\uec2d"
  },
  
  "ti-hand-move" : {
    iconSet: 'tabler icons', code: "\uef50"
  },
  
  "ti-hand-off" : {
    iconSet: 'tabler icons', code: "\ued15"
  },
  
  "ti-hand-ring-finger" : {
    iconSet: 'tabler icons', code: "\uee96"
  },
  
  "ti-hand-rock" : {
    iconSet: 'tabler icons', code: "\uee97"
  },
  
  "ti-hand-sanitizer" : {
    iconSet: 'tabler icons', code: "\uf5f4"
  },
  
  "ti-hand-stop" : {
    iconSet: 'tabler icons', code: "\uec2e"
  },
  
  "ti-hand-three-fingers" : {
    iconSet: 'tabler icons', code: "\uee98"
  },
  
  "ti-hand-two-fingers" : {
    iconSet: 'tabler icons', code: "\uee99"
  },
  
  "ti-hanger" : {
    iconSet: 'tabler icons', code: "\uee9a"
  },
  
  "ti-hanger-2" : {
    iconSet: 'tabler icons', code: "\uf09c"
  },
  
  "ti-hanger-off" : {
    iconSet: 'tabler icons', code: "\uf13e"
  },
  
  "ti-hash" : {
    iconSet: 'tabler icons', code: "\ueabc"
  },
  
  "ti-haze" : {
    iconSet: 'tabler icons', code: "\uefaa"
  },
  
  "ti-heading" : {
    iconSet: 'tabler icons', code: "\uee9b"
  },
  
  "ti-heading-off" : {
    iconSet: 'tabler icons', code: "\uf13f"
  },
  
  "ti-headphones" : {
    iconSet: 'tabler icons', code: "\ueabd"
  },
  
  "ti-headphones-off" : {
    iconSet: 'tabler icons', code: "\ued1d"
  },
  
  "ti-headset" : {
    iconSet: 'tabler icons', code: "\ueb90"
  },
  
  "ti-headset-off" : {
    iconSet: 'tabler icons', code: "\uf3f6"
  },
  
  "ti-health-recognition" : {
    iconSet: 'tabler icons', code: "\uf1fb"
  },
  
  "ti-heart" : {
    iconSet: 'tabler icons', code: "\ueabe"
  },
  
  "ti-heart-broken" : {
    iconSet: 'tabler icons', code: "\uecba"
  },
  
  "ti-heart-filled" : {
    iconSet: 'tabler icons', code: "\uf67c"
  },
  
  "ti-heart-handshake" : {
    iconSet: 'tabler icons', code: "\uf0f3"
  },
  
  "ti-heart-minus" : {
    iconSet: 'tabler icons', code: "\uf140"
  },
  
  "ti-heart-off" : {
    iconSet: 'tabler icons', code: "\uf141"
  },
  
  "ti-heart-plus" : {
    iconSet: 'tabler icons', code: "\uf142"
  },
  
  "ti-heart-rate-monitor" : {
    iconSet: 'tabler icons', code: "\uef61"
  },
  
  "ti-heartbeat" : {
    iconSet: 'tabler icons', code: "\uef92"
  },
  
  "ti-hearts" : {
    iconSet: 'tabler icons', code: "\uf387"
  },
  
  "ti-hearts-off" : {
    iconSet: 'tabler icons', code: "\uf3f7"
  },
  
  "ti-helicopter" : {
    iconSet: 'tabler icons', code: "\ued8e"
  },
  
  "ti-helicopter-landing" : {
    iconSet: 'tabler icons', code: "\ued8d"
  },
  
  "ti-helmet" : {
    iconSet: 'tabler icons', code: "\uefca"
  },
  
  "ti-helmet-off" : {
    iconSet: 'tabler icons', code: "\uf143"
  },
  
  "ti-help" : {
    iconSet: 'tabler icons', code: "\ueabf"
  },
  
  "ti-help-circle" : {
    iconSet: 'tabler icons', code: "\uf91d"
  },
  
  "ti-help-hexagon" : {
    iconSet: 'tabler icons', code: "\uf7a8"
  },
  
  "ti-help-octagon" : {
    iconSet: 'tabler icons', code: "\uf7a9"
  },
  
  "ti-help-off" : {
    iconSet: 'tabler icons', code: "\uf3f8"
  },
  
  "ti-help-small" : {
    iconSet: 'tabler icons', code: "\uf91e"
  },
  
  "ti-help-square" : {
    iconSet: 'tabler icons', code: "\uf920"
  },
  
  "ti-help-square-rounded" : {
    iconSet: 'tabler icons', code: "\uf91f"
  },
  
  "ti-help-triangle" : {
    iconSet: 'tabler icons', code: "\uf921"
  },
  
  "ti-hexagon" : {
    iconSet: 'tabler icons', code: "\uec02"
  },
  
  "ti-hexagon-0-filled" : {
    iconSet: 'tabler icons', code: "\uf74c"
  },
  
  "ti-hexagon-1-filled" : {
    iconSet: 'tabler icons', code: "\uf74d"
  },
  
  "ti-hexagon-2-filled" : {
    iconSet: 'tabler icons', code: "\uf74e"
  },
  
  "ti-hexagon-3-filled" : {
    iconSet: 'tabler icons', code: "\uf74f"
  },
  
  "ti-hexagon-3d" : {
    iconSet: 'tabler icons', code: "\uf4c7"
  },
  
  "ti-hexagon-4-filled" : {
    iconSet: 'tabler icons', code: "\uf750"
  },
  
  "ti-hexagon-5-filled" : {
    iconSet: 'tabler icons', code: "\uf751"
  },
  
  "ti-hexagon-6-filled" : {
    iconSet: 'tabler icons', code: "\uf752"
  },
  
  "ti-hexagon-7-filled" : {
    iconSet: 'tabler icons', code: "\uf753"
  },
  
  "ti-hexagon-8-filled" : {
    iconSet: 'tabler icons', code: "\uf754"
  },
  
  "ti-hexagon-9-filled" : {
    iconSet: 'tabler icons', code: "\uf755"
  },
  
  "ti-hexagon-filled" : {
    iconSet: 'tabler icons', code: "\uf67d"
  },
  
  "ti-hexagon-letter-a" : {
    iconSet: 'tabler icons', code: "\uf463"
  },
  
  "ti-hexagon-letter-b" : {
    iconSet: 'tabler icons', code: "\uf464"
  },
  
  "ti-hexagon-letter-c" : {
    iconSet: 'tabler icons', code: "\uf465"
  },
  
  "ti-hexagon-letter-d" : {
    iconSet: 'tabler icons', code: "\uf466"
  },
  
  "ti-hexagon-letter-e" : {
    iconSet: 'tabler icons', code: "\uf467"
  },
  
  "ti-hexagon-letter-f" : {
    iconSet: 'tabler icons', code: "\uf468"
  },
  
  "ti-hexagon-letter-g" : {
    iconSet: 'tabler icons', code: "\uf469"
  },
  
  "ti-hexagon-letter-h" : {
    iconSet: 'tabler icons', code: "\uf46a"
  },
  
  "ti-hexagon-letter-i" : {
    iconSet: 'tabler icons', code: "\uf46b"
  },
  
  "ti-hexagon-letter-j" : {
    iconSet: 'tabler icons', code: "\uf46c"
  },
  
  "ti-hexagon-letter-k" : {
    iconSet: 'tabler icons', code: "\uf46d"
  },
  
  "ti-hexagon-letter-l" : {
    iconSet: 'tabler icons', code: "\uf46e"
  },
  
  "ti-hexagon-letter-m" : {
    iconSet: 'tabler icons', code: "\uf46f"
  },
  
  "ti-hexagon-letter-n" : {
    iconSet: 'tabler icons', code: "\uf470"
  },
  
  "ti-hexagon-letter-o" : {
    iconSet: 'tabler icons', code: "\uf471"
  },
  
  "ti-hexagon-letter-p" : {
    iconSet: 'tabler icons', code: "\uf472"
  },
  
  "ti-hexagon-letter-q" : {
    iconSet: 'tabler icons', code: "\uf473"
  },
  
  "ti-hexagon-letter-r" : {
    iconSet: 'tabler icons', code: "\uf474"
  },
  
  "ti-hexagon-letter-s" : {
    iconSet: 'tabler icons', code: "\uf475"
  },
  
  "ti-hexagon-letter-t" : {
    iconSet: 'tabler icons', code: "\uf476"
  },
  
  "ti-hexagon-letter-u" : {
    iconSet: 'tabler icons', code: "\uf477"
  },
  
  "ti-hexagon-letter-v" : {
    iconSet: 'tabler icons', code: "\uf4b3"
  },
  
  "ti-hexagon-letter-w" : {
    iconSet: 'tabler icons', code: "\uf478"
  },
  
  "ti-hexagon-letter-x" : {
    iconSet: 'tabler icons', code: "\uf479"
  },
  
  "ti-hexagon-letter-y" : {
    iconSet: 'tabler icons', code: "\uf47a"
  },
  
  "ti-hexagon-letter-z" : {
    iconSet: 'tabler icons', code: "\uf47b"
  },
  
  "ti-hexagon-number-0" : {
    iconSet: 'tabler icons', code: "\uf459"
  },
  
  "ti-hexagon-number-1" : {
    iconSet: 'tabler icons', code: "\uf45a"
  },
  
  "ti-hexagon-number-2" : {
    iconSet: 'tabler icons', code: "\uf45b"
  },
  
  "ti-hexagon-number-3" : {
    iconSet: 'tabler icons', code: "\uf45c"
  },
  
  "ti-hexagon-number-4" : {
    iconSet: 'tabler icons', code: "\uf45d"
  },
  
  "ti-hexagon-number-5" : {
    iconSet: 'tabler icons', code: "\uf45e"
  },
  
  "ti-hexagon-number-6" : {
    iconSet: 'tabler icons', code: "\uf45f"
  },
  
  "ti-hexagon-number-7" : {
    iconSet: 'tabler icons', code: "\uf460"
  },
  
  "ti-hexagon-number-8" : {
    iconSet: 'tabler icons', code: "\uf461"
  },
  
  "ti-hexagon-number-9" : {
    iconSet: 'tabler icons', code: "\uf462"
  },
  
  "ti-hexagon-off" : {
    iconSet: 'tabler icons', code: "\uee9c"
  },
  
  "ti-hexagons" : {
    iconSet: 'tabler icons', code: "\uf09d"
  },
  
  "ti-hexagons-off" : {
    iconSet: 'tabler icons', code: "\uf3f9"
  },
  
  "ti-hierarchy" : {
    iconSet: 'tabler icons', code: "\uee9e"
  },
  
  "ti-hierarchy-2" : {
    iconSet: 'tabler icons', code: "\uee9d"
  },
  
  "ti-hierarchy-3" : {
    iconSet: 'tabler icons', code: "\uf289"
  },
  
  "ti-hierarchy-off" : {
    iconSet: 'tabler icons', code: "\uf3fa"
  },
  
  "ti-highlight" : {
    iconSet: 'tabler icons', code: "\uef3f"
  },
  
  "ti-highlight-off" : {
    iconSet: 'tabler icons', code: "\uf144"
  },
  
  "ti-history" : {
    iconSet: 'tabler icons', code: "\uebea"
  },
  
  "ti-history-off" : {
    iconSet: 'tabler icons', code: "\uf3fb"
  },
  
  "ti-history-toggle" : {
    iconSet: 'tabler icons', code: "\uf1fc"
  },
  
  "ti-home" : {
    iconSet: 'tabler icons', code: "\ueac1"
  },
  
  "ti-home-2" : {
    iconSet: 'tabler icons', code: "\ueac0"
  },
  
  "ti-home-bolt" : {
    iconSet: 'tabler icons', code: "\uf336"
  },
  
  "ti-home-cancel" : {
    iconSet: 'tabler icons', code: "\uf350"
  },
  
  "ti-home-check" : {
    iconSet: 'tabler icons', code: "\uf337"
  },
  
  "ti-home-cog" : {
    iconSet: 'tabler icons', code: "\uf338"
  },
  
  "ti-home-dollar" : {
    iconSet: 'tabler icons', code: "\uf339"
  },
  
  "ti-home-dot" : {
    iconSet: 'tabler icons', code: "\uf33a"
  },
  
  "ti-home-down" : {
    iconSet: 'tabler icons', code: "\uf33b"
  },
  
  "ti-home-eco" : {
    iconSet: 'tabler icons', code: "\uf351"
  },
  
  "ti-home-edit" : {
    iconSet: 'tabler icons', code: "\uf352"
  },
  
  "ti-home-exclamation" : {
    iconSet: 'tabler icons', code: "\uf33c"
  },
  
  "ti-home-hand" : {
    iconSet: 'tabler icons', code: "\uf504"
  },
  
  "ti-home-heart" : {
    iconSet: 'tabler icons', code: "\uf353"
  },
  
  "ti-home-infinity" : {
    iconSet: 'tabler icons', code: "\uf505"
  },
  
  "ti-home-link" : {
    iconSet: 'tabler icons', code: "\uf354"
  },
  
  "ti-home-minus" : {
    iconSet: 'tabler icons', code: "\uf33d"
  },
  
  "ti-home-move" : {
    iconSet: 'tabler icons', code: "\uf33e"
  },
  
  "ti-home-off" : {
    iconSet: 'tabler icons', code: "\uf145"
  },
  
  "ti-home-plus" : {
    iconSet: 'tabler icons', code: "\uf33f"
  },
  
  "ti-home-question" : {
    iconSet: 'tabler icons', code: "\uf340"
  },
  
  "ti-home-ribbon" : {
    iconSet: 'tabler icons', code: "\uf355"
  },
  
  "ti-home-search" : {
    iconSet: 'tabler icons', code: "\uf341"
  },
  
  "ti-home-share" : {
    iconSet: 'tabler icons', code: "\uf342"
  },
  
  "ti-home-shield" : {
    iconSet: 'tabler icons', code: "\uf343"
  },
  
  "ti-home-signal" : {
    iconSet: 'tabler icons', code: "\uf356"
  },
  
  "ti-home-star" : {
    iconSet: 'tabler icons', code: "\uf344"
  },
  
  "ti-home-stats" : {
    iconSet: 'tabler icons', code: "\uf345"
  },
  
  "ti-home-up" : {
    iconSet: 'tabler icons', code: "\uf346"
  },
  
  "ti-home-x" : {
    iconSet: 'tabler icons', code: "\uf347"
  },
  
  "ti-horse-toy" : {
    iconSet: 'tabler icons', code: "\uf28a"
  },
  
  "ti-hotel-service" : {
    iconSet: 'tabler icons', code: "\uef80"
  },
  
  "ti-hourglass" : {
    iconSet: 'tabler icons', code: "\uef93"
  },
  
  "ti-hourglass-empty" : {
    iconSet: 'tabler icons', code: "\uf146"
  },
  
  "ti-hourglass-filled" : {
    iconSet: 'tabler icons', code: "\uf756"
  },
  
  "ti-hourglass-high" : {
    iconSet: 'tabler icons', code: "\uf092"
  },
  
  "ti-hourglass-low" : {
    iconSet: 'tabler icons', code: "\uf093"
  },
  
  "ti-hourglass-off" : {
    iconSet: 'tabler icons', code: "\uf147"
  },
  
  "ti-html" : {
    iconSet: 'tabler icons', code: "\uf7b1"
  },
  
  "ti-http-connect" : {
    iconSet: 'tabler icons', code: "\ufa28"
  },
  
  "ti-http-delete" : {
    iconSet: 'tabler icons', code: "\ufa29"
  },
  
  "ti-http-get" : {
    iconSet: 'tabler icons', code: "\ufa2a"
  },
  
  "ti-http-head" : {
    iconSet: 'tabler icons', code: "\ufa2b"
  },
  
  "ti-http-options" : {
    iconSet: 'tabler icons', code: "\ufa2c"
  },
  
  "ti-http-path" : {
    iconSet: 'tabler icons', code: "\ufa2d"
  },
  
  "ti-http-post" : {
    iconSet: 'tabler icons', code: "\ufa2e"
  },
  
  "ti-http-put" : {
    iconSet: 'tabler icons', code: "\ufa2f"
  },
  
  "ti-http-trace" : {
    iconSet: 'tabler icons', code: "\ufa30"
  },
  
  "ti-ice-cream" : {
    iconSet: 'tabler icons', code: "\ueac2"
  },
  
  "ti-ice-cream-2" : {
    iconSet: 'tabler icons', code: "\uee9f"
  },
  
  "ti-ice-cream-off" : {
    iconSet: 'tabler icons', code: "\uf148"
  },
  
  "ti-ice-skating" : {
    iconSet: 'tabler icons', code: "\uefcb"
  },
  
  "ti-icons" : {
    iconSet: 'tabler icons', code: "\uf1d4"
  },
  
  "ti-icons-off" : {
    iconSet: 'tabler icons', code: "\uf3fc"
  },
  
  "ti-id" : {
    iconSet: 'tabler icons', code: "\ueac3"
  },
  
  "ti-id-badge" : {
    iconSet: 'tabler icons', code: "\ueff7"
  },
  
  "ti-id-badge-2" : {
    iconSet: 'tabler icons', code: "\uf076"
  },
  
  "ti-id-badge-off" : {
    iconSet: 'tabler icons', code: "\uf3fd"
  },
  
  "ti-id-off" : {
    iconSet: 'tabler icons', code: "\uf149"
  },
  
  "ti-inbox" : {
    iconSet: 'tabler icons', code: "\ueac4"
  },
  
  "ti-inbox-off" : {
    iconSet: 'tabler icons', code: "\uf14a"
  },
  
  "ti-indent-decrease" : {
    iconSet: 'tabler icons', code: "\ueb91"
  },
  
  "ti-indent-increase" : {
    iconSet: 'tabler icons', code: "\ueb92"
  },
  
  "ti-infinity" : {
    iconSet: 'tabler icons', code: "\ueb69"
  },
  
  "ti-infinity-off" : {
    iconSet: 'tabler icons', code: "\uf3fe"
  },
  
  "ti-info-circle" : {
    iconSet: 'tabler icons', code: "\ueac5"
  },
  
  "ti-info-circle-filled" : {
    iconSet: 'tabler icons', code: "\uf6d8"
  },
  
  "ti-info-hexagon" : {
    iconSet: 'tabler icons', code: "\uf7aa"
  },
  
  "ti-info-octagon" : {
    iconSet: 'tabler icons', code: "\uf7ab"
  },
  
  "ti-info-small" : {
    iconSet: 'tabler icons', code: "\uf922"
  },
  
  "ti-info-square" : {
    iconSet: 'tabler icons', code: "\ueac6"
  },
  
  "ti-info-square-rounded" : {
    iconSet: 'tabler icons', code: "\uf635"
  },
  
  "ti-info-square-rounded-filled" : {
    iconSet: 'tabler icons', code: "\uf6d9"
  },
  
  "ti-info-triangle" : {
    iconSet: 'tabler icons', code: "\uf923"
  },
  
  "ti-inner-shadow-bottom" : {
    iconSet: 'tabler icons', code: "\uf520"
  },
  
  "ti-inner-shadow-bottom-filled" : {
    iconSet: 'tabler icons', code: "\uf757"
  },
  
  "ti-inner-shadow-bottom-left" : {
    iconSet: 'tabler icons', code: "\uf51e"
  },
  
  "ti-inner-shadow-bottom-left-filled" : {
    iconSet: 'tabler icons', code: "\uf758"
  },
  
  "ti-inner-shadow-bottom-right" : {
    iconSet: 'tabler icons', code: "\uf51f"
  },
  
  "ti-inner-shadow-bottom-right-filled" : {
    iconSet: 'tabler icons', code: "\uf759"
  },
  
  "ti-inner-shadow-left" : {
    iconSet: 'tabler icons', code: "\uf521"
  },
  
  "ti-inner-shadow-left-filled" : {
    iconSet: 'tabler icons', code: "\uf75a"
  },
  
  "ti-inner-shadow-right" : {
    iconSet: 'tabler icons', code: "\uf522"
  },
  
  "ti-inner-shadow-right-filled" : {
    iconSet: 'tabler icons', code: "\uf75b"
  },
  
  "ti-inner-shadow-top" : {
    iconSet: 'tabler icons', code: "\uf525"
  },
  
  "ti-inner-shadow-top-filled" : {
    iconSet: 'tabler icons', code: "\uf75c"
  },
  
  "ti-inner-shadow-top-left" : {
    iconSet: 'tabler icons', code: "\uf523"
  },
  
  "ti-inner-shadow-top-left-filled" : {
    iconSet: 'tabler icons', code: "\uf75d"
  },
  
  "ti-inner-shadow-top-right" : {
    iconSet: 'tabler icons', code: "\uf524"
  },
  
  "ti-inner-shadow-top-right-filled" : {
    iconSet: 'tabler icons', code: "\uf75e"
  },
  
  "ti-input-search" : {
    iconSet: 'tabler icons', code: "\uf2a2"
  },
  
  "ti-ironing-1" : {
    iconSet: 'tabler icons', code: "\uf2f4"
  },
  
  "ti-ironing-2" : {
    iconSet: 'tabler icons', code: "\uf2f5"
  },
  
  "ti-ironing-3" : {
    iconSet: 'tabler icons', code: "\uf2f6"
  },
  
  "ti-ironing-off" : {
    iconSet: 'tabler icons', code: "\uf2f7"
  },
  
  "ti-ironing-steam" : {
    iconSet: 'tabler icons', code: "\uf2f9"
  },
  
  "ti-ironing-steam-off" : {
    iconSet: 'tabler icons', code: "\uf2f8"
  },
  
  "ti-italic" : {
    iconSet: 'tabler icons', code: "\ueb93"
  },
  
  "ti-jacket" : {
    iconSet: 'tabler icons', code: "\uf661"
  },
  
  "ti-jetpack" : {
    iconSet: 'tabler icons', code: "\uf581"
  },
  
  "ti-jewish-star" : {
    iconSet: 'tabler icons', code: "\uf3ff"
  },
  
  "ti-jewish-star-filled" : {
    iconSet: 'tabler icons', code: "\uf67e"
  },
  
  "ti-jpg" : {
    iconSet: 'tabler icons', code: "\uf3ac"
  },
  
  "ti-json" : {
    iconSet: 'tabler icons', code: "\uf7b2"
  },
  
  "ti-jump-rope" : {
    iconSet: 'tabler icons', code: "\ued8f"
  },
  
  "ti-karate" : {
    iconSet: 'tabler icons', code: "\ued32"
  },
  
  "ti-kayak" : {
    iconSet: 'tabler icons', code: "\uf1d6"
  },
  
  "ti-kering" : {
    iconSet: 'tabler icons', code: "\uefb8"
  },
  
  "ti-key" : {
    iconSet: 'tabler icons', code: "\ueac7"
  },
  
  "ti-key-off" : {
    iconSet: 'tabler icons', code: "\uf14b"
  },
  
  "ti-keyboard" : {
    iconSet: 'tabler icons', code: "\uebd6"
  },
  
  "ti-keyboard-hide" : {
    iconSet: 'tabler icons', code: "\uec7e"
  },
  
  "ti-keyboard-off" : {
    iconSet: 'tabler icons', code: "\ueea0"
  },
  
  "ti-keyboard-show" : {
    iconSet: 'tabler icons', code: "\uec7f"
  },
  
  "ti-keyframe" : {
    iconSet: 'tabler icons', code: "\uf576"
  },
  
  "ti-keyframe-align-center" : {
    iconSet: 'tabler icons', code: "\uf582"
  },
  
  "ti-keyframe-align-horizontal" : {
    iconSet: 'tabler icons', code: "\uf583"
  },
  
  "ti-keyframe-align-vertical" : {
    iconSet: 'tabler icons', code: "\uf584"
  },
  
  "ti-keyframes" : {
    iconSet: 'tabler icons', code: "\uf585"
  },
  
  "ti-ladder" : {
    iconSet: 'tabler icons', code: "\uefe2"
  },
  
  "ti-ladder-off" : {
    iconSet: 'tabler icons', code: "\uf14c"
  },
  
  "ti-lambda" : {
    iconSet: 'tabler icons', code: "\uf541"
  },
  
  "ti-lamp" : {
    iconSet: 'tabler icons', code: "\uefab"
  },
  
  "ti-lamp-2" : {
    iconSet: 'tabler icons', code: "\uf09e"
  },
  
  "ti-lamp-off" : {
    iconSet: 'tabler icons', code: "\uf14d"
  },
  
  "ti-language" : {
    iconSet: 'tabler icons', code: "\uebbe"
  },
  
  "ti-language-hiragana" : {
    iconSet: 'tabler icons', code: "\uef77"
  },
  
  "ti-language-katakana" : {
    iconSet: 'tabler icons', code: "\uef78"
  },
  
  "ti-language-off" : {
    iconSet: 'tabler icons', code: "\uf14e"
  },
  
  "ti-lasso" : {
    iconSet: 'tabler icons', code: "\uefac"
  },
  
  "ti-lasso-off" : {
    iconSet: 'tabler icons', code: "\uf14f"
  },
  
  "ti-lasso-polygon" : {
    iconSet: 'tabler icons', code: "\uf388"
  },
  
  "ti-layers-difference" : {
    iconSet: 'tabler icons', code: "\ueac8"
  },
  
  "ti-layers-intersect" : {
    iconSet: 'tabler icons', code: "\ueac9"
  },
  
  "ti-layers-intersect-2" : {
    iconSet: 'tabler icons', code: "\ueff8"
  },
  
  "ti-layers-linked" : {
    iconSet: 'tabler icons', code: "\ueea1"
  },
  
  "ti-layers-off" : {
    iconSet: 'tabler icons', code: "\uf150"
  },
  
  "ti-layers-subtract" : {
    iconSet: 'tabler icons', code: "\ueaca"
  },
  
  "ti-layers-union" : {
    iconSet: 'tabler icons', code: "\ueacb"
  },
  
  "ti-layout" : {
    iconSet: 'tabler icons', code: "\ueadb"
  },
  
  "ti-layout-2" : {
    iconSet: 'tabler icons', code: "\ueacc"
  },
  
  "ti-layout-align-bottom" : {
    iconSet: 'tabler icons', code: "\ueacd"
  },
  
  "ti-layout-align-center" : {
    iconSet: 'tabler icons', code: "\ueace"
  },
  
  "ti-layout-align-left" : {
    iconSet: 'tabler icons', code: "\ueacf"
  },
  
  "ti-layout-align-middle" : {
    iconSet: 'tabler icons', code: "\uead0"
  },
  
  "ti-layout-align-right" : {
    iconSet: 'tabler icons', code: "\uead1"
  },
  
  "ti-layout-align-top" : {
    iconSet: 'tabler icons', code: "\uead2"
  },
  
  "ti-layout-board" : {
    iconSet: 'tabler icons', code: "\uef95"
  },
  
  "ti-layout-board-split" : {
    iconSet: 'tabler icons', code: "\uef94"
  },
  
  "ti-layout-bottombar" : {
    iconSet: 'tabler icons', code: "\uead3"
  },
  
  "ti-layout-bottombar-collapse" : {
    iconSet: 'tabler icons', code: "\uf28b"
  },
  
  "ti-layout-bottombar-expand" : {
    iconSet: 'tabler icons', code: "\uf28c"
  },
  
  "ti-layout-cards" : {
    iconSet: 'tabler icons', code: "\uec13"
  },
  
  "ti-layout-collage" : {
    iconSet: 'tabler icons', code: "\uf389"
  },
  
  "ti-layout-columns" : {
    iconSet: 'tabler icons', code: "\uead4"
  },
  
  "ti-layout-dashboard" : {
    iconSet: 'tabler icons', code: "\uf02c"
  },
  
  "ti-layout-distribute-horizontal" : {
    iconSet: 'tabler icons', code: "\uead5"
  },
  
  "ti-layout-distribute-vertical" : {
    iconSet: 'tabler icons', code: "\uead6"
  },
  
  "ti-layout-grid" : {
    iconSet: 'tabler icons', code: "\uedba"
  },
  
  "ti-layout-grid-add" : {
    iconSet: 'tabler icons', code: "\uedb9"
  },
  
  "ti-layout-kanban" : {
    iconSet: 'tabler icons', code: "\uec3f"
  },
  
  "ti-layout-list" : {
    iconSet: 'tabler icons', code: "\uec14"
  },
  
  "ti-layout-navbar" : {
    iconSet: 'tabler icons', code: "\uead7"
  },
  
  "ti-layout-navbar-collapse" : {
    iconSet: 'tabler icons', code: "\uf28d"
  },
  
  "ti-layout-navbar-expand" : {
    iconSet: 'tabler icons', code: "\uf28e"
  },
  
  "ti-layout-off" : {
    iconSet: 'tabler icons', code: "\uf151"
  },
  
  "ti-layout-rows" : {
    iconSet: 'tabler icons', code: "\uead8"
  },
  
  "ti-layout-sidebar" : {
    iconSet: 'tabler icons', code: "\ueada"
  },
  
  "ti-layout-sidebar-left-collapse" : {
    iconSet: 'tabler icons', code: "\uf004"
  },
  
  "ti-layout-sidebar-left-expand" : {
    iconSet: 'tabler icons', code: "\uf005"
  },
  
  "ti-layout-sidebar-right" : {
    iconSet: 'tabler icons', code: "\uead9"
  },
  
  "ti-layout-sidebar-right-collapse" : {
    iconSet: 'tabler icons', code: "\uf006"
  },
  
  "ti-layout-sidebar-right-expand" : {
    iconSet: 'tabler icons', code: "\uf007"
  },
  
  "ti-leaf" : {
    iconSet: 'tabler icons', code: "\ued4f"
  },
  
  "ti-leaf-off" : {
    iconSet: 'tabler icons', code: "\uf400"
  },
  
  "ti-lego" : {
    iconSet: 'tabler icons', code: "\ueadc"
  },
  
  "ti-lego-off" : {
    iconSet: 'tabler icons', code: "\uf401"
  },
  
  "ti-lemon" : {
    iconSet: 'tabler icons', code: "\uef10"
  },
  
  "ti-lemon-2" : {
    iconSet: 'tabler icons', code: "\uef81"
  },
  
  "ti-letter-a" : {
    iconSet: 'tabler icons', code: "\uec50"
  },
  
  "ti-letter-b" : {
    iconSet: 'tabler icons', code: "\uec51"
  },
  
  "ti-letter-c" : {
    iconSet: 'tabler icons', code: "\uec52"
  },
  
  "ti-letter-case" : {
    iconSet: 'tabler icons', code: "\ueea5"
  },
  
  "ti-letter-case-lower" : {
    iconSet: 'tabler icons', code: "\ueea2"
  },
  
  "ti-letter-case-toggle" : {
    iconSet: 'tabler icons', code: "\ueea3"
  },
  
  "ti-letter-case-upper" : {
    iconSet: 'tabler icons', code: "\ueea4"
  },
  
  "ti-letter-d" : {
    iconSet: 'tabler icons', code: "\uec53"
  },
  
  "ti-letter-e" : {
    iconSet: 'tabler icons', code: "\uec54"
  },
  
  "ti-letter-f" : {
    iconSet: 'tabler icons', code: "\uec55"
  },
  
  "ti-letter-g" : {
    iconSet: 'tabler icons', code: "\uec56"
  },
  
  "ti-letter-h" : {
    iconSet: 'tabler icons', code: "\uec57"
  },
  
  "ti-letter-i" : {
    iconSet: 'tabler icons', code: "\uec58"
  },
  
  "ti-letter-j" : {
    iconSet: 'tabler icons', code: "\uec59"
  },
  
  "ti-letter-k" : {
    iconSet: 'tabler icons', code: "\uec5a"
  },
  
  "ti-letter-l" : {
    iconSet: 'tabler icons', code: "\uec5b"
  },
  
  "ti-letter-m" : {
    iconSet: 'tabler icons', code: "\uec5c"
  },
  
  "ti-letter-n" : {
    iconSet: 'tabler icons', code: "\uec5d"
  },
  
  "ti-letter-o" : {
    iconSet: 'tabler icons', code: "\uec5e"
  },
  
  "ti-letter-p" : {
    iconSet: 'tabler icons', code: "\uec5f"
  },
  
  "ti-letter-q" : {
    iconSet: 'tabler icons', code: "\uec60"
  },
  
  "ti-letter-r" : {
    iconSet: 'tabler icons', code: "\uec61"
  },
  
  "ti-letter-s" : {
    iconSet: 'tabler icons', code: "\uec62"
  },
  
  "ti-letter-spacing" : {
    iconSet: 'tabler icons', code: "\ueea6"
  },
  
  "ti-letter-t" : {
    iconSet: 'tabler icons', code: "\uec63"
  },
  
  "ti-letter-u" : {
    iconSet: 'tabler icons', code: "\uec64"
  },
  
  "ti-letter-v" : {
    iconSet: 'tabler icons', code: "\uec65"
  },
  
  "ti-letter-w" : {
    iconSet: 'tabler icons', code: "\uec66"
  },
  
  "ti-letter-x" : {
    iconSet: 'tabler icons', code: "\uec67"
  },
  
  "ti-letter-y" : {
    iconSet: 'tabler icons', code: "\uec68"
  },
  
  "ti-letter-z" : {
    iconSet: 'tabler icons', code: "\uec69"
  },
  
  "ti-license" : {
    iconSet: 'tabler icons', code: "\uebc0"
  },
  
  "ti-license-off" : {
    iconSet: 'tabler icons', code: "\uf153"
  },
  
  "ti-lifebuoy" : {
    iconSet: 'tabler icons', code: "\ueadd"
  },
  
  "ti-lifebuoy-off" : {
    iconSet: 'tabler icons', code: "\uf154"
  },
  
  "ti-lighter" : {
    iconSet: 'tabler icons', code: "\uf794"
  },
  
  "ti-line" : {
    iconSet: 'tabler icons', code: "\uec40"
  },
  
  "ti-line-dashed" : {
    iconSet: 'tabler icons', code: "\ueea7"
  },
  
  "ti-line-dotted" : {
    iconSet: 'tabler icons', code: "\ueea8"
  },
  
  "ti-line-height" : {
    iconSet: 'tabler icons', code: "\ueb94"
  },
  
  "ti-link" : {
    iconSet: 'tabler icons', code: "\ueade"
  },
  
  "ti-link-off" : {
    iconSet: 'tabler icons', code: "\uf402"
  },
  
  "ti-list" : {
    iconSet: 'tabler icons', code: "\ueb6b"
  },
  
  "ti-list-check" : {
    iconSet: 'tabler icons', code: "\ueb6a"
  },
  
  "ti-list-details" : {
    iconSet: 'tabler icons', code: "\uef40"
  },
  
  "ti-list-numbers" : {
    iconSet: 'tabler icons', code: "\uef11"
  },
  
  "ti-list-search" : {
    iconSet: 'tabler icons', code: "\ueea9"
  },
  
  "ti-live-photo" : {
    iconSet: 'tabler icons', code: "\ueadf"
  },
  
  "ti-live-photo-off" : {
    iconSet: 'tabler icons', code: "\uf403"
  },
  
  "ti-live-view" : {
    iconSet: 'tabler icons', code: "\uec6b"
  },
  
  "ti-loader" : {
    iconSet: 'tabler icons', code: "\ueca3"
  },
  
  "ti-loader-2" : {
    iconSet: 'tabler icons', code: "\uf226"
  },
  
  "ti-loader-3" : {
    iconSet: 'tabler icons', code: "\uf513"
  },
  
  "ti-loader-quarter" : {
    iconSet: 'tabler icons', code: "\ueca2"
  },
  
  "ti-location" : {
    iconSet: 'tabler icons', code: "\ueae0"
  },
  
  "ti-location-broken" : {
    iconSet: 'tabler icons', code: "\uf2c4"
  },
  
  "ti-location-filled" : {
    iconSet: 'tabler icons', code: "\uf67f"
  },
  
  "ti-location-off" : {
    iconSet: 'tabler icons', code: "\uf155"
  },
  
  "ti-lock" : {
    iconSet: 'tabler icons', code: "\ueae2"
  },
  
  "ti-lock-access" : {
    iconSet: 'tabler icons', code: "\ueeaa"
  },
  
  "ti-lock-access-off" : {
    iconSet: 'tabler icons', code: "\uf404"
  },
  
  "ti-lock-bolt" : {
    iconSet: 'tabler icons', code: "\uf924"
  },
  
  "ti-lock-cancel" : {
    iconSet: 'tabler icons', code: "\uf925"
  },
  
  "ti-lock-check" : {
    iconSet: 'tabler icons', code: "\uf926"
  },
  
  "ti-lock-code" : {
    iconSet: 'tabler icons', code: "\uf927"
  },
  
  "ti-lock-cog" : {
    iconSet: 'tabler icons', code: "\uf928"
  },
  
  "ti-lock-dollar" : {
    iconSet: 'tabler icons', code: "\uf929"
  },
  
  "ti-lock-down" : {
    iconSet: 'tabler icons', code: "\uf92a"
  },
  
  "ti-lock-exclamation" : {
    iconSet: 'tabler icons', code: "\uf92b"
  },
  
  "ti-lock-heart" : {
    iconSet: 'tabler icons', code: "\uf92c"
  },
  
  "ti-lock-minus" : {
    iconSet: 'tabler icons', code: "\uf92d"
  },
  
  "ti-lock-off" : {
    iconSet: 'tabler icons', code: "\ued1e"
  },
  
  "ti-lock-open" : {
    iconSet: 'tabler icons', code: "\ueae1"
  },
  
  "ti-lock-open-off" : {
    iconSet: 'tabler icons', code: "\uf156"
  },
  
  "ti-lock-pause" : {
    iconSet: 'tabler icons', code: "\uf92e"
  },
  
  "ti-lock-pin" : {
    iconSet: 'tabler icons', code: "\uf92f"
  },
  
  "ti-lock-plus" : {
    iconSet: 'tabler icons', code: "\uf930"
  },
  
  "ti-lock-question" : {
    iconSet: 'tabler icons', code: "\uf931"
  },
  
  "ti-lock-search" : {
    iconSet: 'tabler icons', code: "\uf932"
  },
  
  "ti-lock-share" : {
    iconSet: 'tabler icons', code: "\uf933"
  },
  
  "ti-lock-square" : {
    iconSet: 'tabler icons', code: "\uef51"
  },
  
  "ti-lock-square-rounded" : {
    iconSet: 'tabler icons', code: "\uf636"
  },
  
  "ti-lock-square-rounded-filled" : {
    iconSet: 'tabler icons', code: "\uf6da"
  },
  
  "ti-lock-star" : {
    iconSet: 'tabler icons', code: "\uf934"
  },
  
  "ti-lock-up" : {
    iconSet: 'tabler icons', code: "\uf935"
  },
  
  "ti-lock-x" : {
    iconSet: 'tabler icons', code: "\uf936"
  },
  
  "ti-logic-and" : {
    iconSet: 'tabler icons', code: "\uf240"
  },
  
  "ti-logic-buffer" : {
    iconSet: 'tabler icons', code: "\uf241"
  },
  
  "ti-logic-nand" : {
    iconSet: 'tabler icons', code: "\uf242"
  },
  
  "ti-logic-nor" : {
    iconSet: 'tabler icons', code: "\uf243"
  },
  
  "ti-logic-not" : {
    iconSet: 'tabler icons', code: "\uf244"
  },
  
  "ti-logic-or" : {
    iconSet: 'tabler icons', code: "\uf245"
  },
  
  "ti-logic-xnor" : {
    iconSet: 'tabler icons', code: "\uf246"
  },
  
  "ti-logic-xor" : {
    iconSet: 'tabler icons', code: "\uf247"
  },
  
  "ti-login" : {
    iconSet: 'tabler icons', code: "\ueba7"
  },
  
  "ti-logout" : {
    iconSet: 'tabler icons', code: "\ueba8"
  },
  
  "ti-lollipop" : {
    iconSet: 'tabler icons', code: "\uefcc"
  },
  
  "ti-lollipop-off" : {
    iconSet: 'tabler icons', code: "\uf157"
  },
  
  "ti-luggage" : {
    iconSet: 'tabler icons', code: "\uefad"
  },
  
  "ti-luggage-off" : {
    iconSet: 'tabler icons', code: "\uf158"
  },
  
  "ti-lungs" : {
    iconSet: 'tabler icons', code: "\uef62"
  },
  
  "ti-lungs-off" : {
    iconSet: 'tabler icons', code: "\uf405"
  },
  
  "ti-macro" : {
    iconSet: 'tabler icons', code: "\ueeab"
  },
  
  "ti-macro-off" : {
    iconSet: 'tabler icons', code: "\uf406"
  },
  
  "ti-magnet" : {
    iconSet: 'tabler icons', code: "\ueae3"
  },
  
  "ti-magnet-off" : {
    iconSet: 'tabler icons', code: "\uf159"
  },
  
  "ti-mail" : {
    iconSet: 'tabler icons', code: "\ueae5"
  },
  
  "ti-mail-ai" : {
    iconSet: 'tabler icons', code: "\ufa31"
  },
  
  "ti-mail-bolt" : {
    iconSet: 'tabler icons', code: "\uf937"
  },
  
  "ti-mail-cancel" : {
    iconSet: 'tabler icons', code: "\uf938"
  },
  
  "ti-mail-check" : {
    iconSet: 'tabler icons', code: "\uf939"
  },
  
  "ti-mail-code" : {
    iconSet: 'tabler icons', code: "\uf93a"
  },
  
  "ti-mail-cog" : {
    iconSet: 'tabler icons', code: "\uf93b"
  },
  
  "ti-mail-dollar" : {
    iconSet: 'tabler icons', code: "\uf93c"
  },
  
  "ti-mail-down" : {
    iconSet: 'tabler icons', code: "\uf93d"
  },
  
  "ti-mail-exclamation" : {
    iconSet: 'tabler icons', code: "\uf93e"
  },
  
  "ti-mail-fast" : {
    iconSet: 'tabler icons', code: "\uf069"
  },
  
  "ti-mail-forward" : {
    iconSet: 'tabler icons', code: "\ueeac"
  },
  
  "ti-mail-heart" : {
    iconSet: 'tabler icons', code: "\uf93f"
  },
  
  "ti-mail-minus" : {
    iconSet: 'tabler icons', code: "\uf940"
  },
  
  "ti-mail-off" : {
    iconSet: 'tabler icons', code: "\uf15a"
  },
  
  "ti-mail-opened" : {
    iconSet: 'tabler icons', code: "\ueae4"
  },
  
  "ti-mail-pause" : {
    iconSet: 'tabler icons', code: "\uf941"
  },
  
  "ti-mail-pin" : {
    iconSet: 'tabler icons', code: "\uf942"
  },
  
  "ti-mail-plus" : {
    iconSet: 'tabler icons', code: "\uf943"
  },
  
  "ti-mail-question" : {
    iconSet: 'tabler icons', code: "\uf944"
  },
  
  "ti-mail-search" : {
    iconSet: 'tabler icons', code: "\uf945"
  },
  
  "ti-mail-share" : {
    iconSet: 'tabler icons', code: "\uf946"
  },
  
  "ti-mail-star" : {
    iconSet: 'tabler icons', code: "\uf947"
  },
  
  "ti-mail-up" : {
    iconSet: 'tabler icons', code: "\uf948"
  },
  
  "ti-mail-x" : {
    iconSet: 'tabler icons', code: "\uf949"
  },
  
  "ti-mailbox" : {
    iconSet: 'tabler icons', code: "\ueead"
  },
  
  "ti-mailbox-off" : {
    iconSet: 'tabler icons', code: "\uf15b"
  },
  
  "ti-man" : {
    iconSet: 'tabler icons', code: "\ueae6"
  },
  
  "ti-manual-gearbox" : {
    iconSet: 'tabler icons', code: "\ued7b"
  },
  
  "ti-map" : {
    iconSet: 'tabler icons', code: "\ueae9"
  },
  
  "ti-map-2" : {
    iconSet: 'tabler icons', code: "\ueae7"
  },
  
  "ti-map-off" : {
    iconSet: 'tabler icons', code: "\uf15c"
  },
  
  "ti-map-pin" : {
    iconSet: 'tabler icons', code: "\ueae8"
  },
  
  "ti-map-pin-bolt" : {
    iconSet: 'tabler icons', code: "\uf94a"
  },
  
  "ti-map-pin-cancel" : {
    iconSet: 'tabler icons', code: "\uf94b"
  },
  
  "ti-map-pin-check" : {
    iconSet: 'tabler icons', code: "\uf94c"
  },
  
  "ti-map-pin-code" : {
    iconSet: 'tabler icons', code: "\uf94d"
  },
  
  "ti-map-pin-cog" : {
    iconSet: 'tabler icons', code: "\uf94e"
  },
  
  "ti-map-pin-dollar" : {
    iconSet: 'tabler icons', code: "\uf94f"
  },
  
  "ti-map-pin-down" : {
    iconSet: 'tabler icons', code: "\uf950"
  },
  
  "ti-map-pin-exclamation" : {
    iconSet: 'tabler icons', code: "\uf951"
  },
  
  "ti-map-pin-filled" : {
    iconSet: 'tabler icons', code: "\uf680"
  },
  
  "ti-map-pin-heart" : {
    iconSet: 'tabler icons', code: "\uf952"
  },
  
  "ti-map-pin-minus" : {
    iconSet: 'tabler icons', code: "\uf953"
  },
  
  "ti-map-pin-off" : {
    iconSet: 'tabler icons', code: "\uecf3"
  },
  
  "ti-map-pin-pause" : {
    iconSet: 'tabler icons', code: "\uf954"
  },
  
  "ti-map-pin-pin" : {
    iconSet: 'tabler icons', code: "\uf955"
  },
  
  "ti-map-pin-plus" : {
    iconSet: 'tabler icons', code: "\uf956"
  },
  
  "ti-map-pin-question" : {
    iconSet: 'tabler icons', code: "\uf957"
  },
  
  "ti-map-pin-search" : {
    iconSet: 'tabler icons', code: "\uf958"
  },
  
  "ti-map-pin-share" : {
    iconSet: 'tabler icons', code: "\uf795"
  },
  
  "ti-map-pin-star" : {
    iconSet: 'tabler icons', code: "\uf959"
  },
  
  "ti-map-pin-up" : {
    iconSet: 'tabler icons', code: "\uf95a"
  },
  
  "ti-map-pin-x" : {
    iconSet: 'tabler icons', code: "\uf95b"
  },
  
  "ti-map-pins" : {
    iconSet: 'tabler icons', code: "\ued5e"
  },
  
  "ti-map-search" : {
    iconSet: 'tabler icons', code: "\uef82"
  },
  
  "ti-markdown" : {
    iconSet: 'tabler icons', code: "\uec41"
  },
  
  "ti-markdown-off" : {
    iconSet: 'tabler icons', code: "\uf407"
  },
  
  "ti-marquee" : {
    iconSet: 'tabler icons', code: "\uec77"
  },
  
  "ti-marquee-2" : {
    iconSet: 'tabler icons', code: "\ueeae"
  },
  
  "ti-marquee-off" : {
    iconSet: 'tabler icons', code: "\uf15d"
  },
  
  "ti-mars" : {
    iconSet: 'tabler icons', code: "\uec80"
  },
  
  "ti-mask" : {
    iconSet: 'tabler icons', code: "\ueeb0"
  },
  
  "ti-mask-off" : {
    iconSet: 'tabler icons', code: "\ueeaf"
  },
  
  "ti-masks-theater" : {
    iconSet: 'tabler icons', code: "\uf263"
  },
  
  "ti-masks-theater-off" : {
    iconSet: 'tabler icons', code: "\uf408"
  },
  
  "ti-massage" : {
    iconSet: 'tabler icons', code: "\ueeb1"
  },
  
  "ti-matchstick" : {
    iconSet: 'tabler icons', code: "\uf577"
  },
  
  "ti-math" : {
    iconSet: 'tabler icons', code: "\uebeb"
  },
  
  "ti-math-1-divide-2" : {
    iconSet: 'tabler icons', code: "\uf4e2"
  },
  
  "ti-math-1-divide-3" : {
    iconSet: 'tabler icons', code: "\uf4e3"
  },
  
  "ti-math-avg" : {
    iconSet: 'tabler icons', code: "\uf0f4"
  },
  
  "ti-math-equal-greater" : {
    iconSet: 'tabler icons', code: "\uf4e4"
  },
  
  "ti-math-equal-lower" : {
    iconSet: 'tabler icons', code: "\uf4e5"
  },
  
  "ti-math-function" : {
    iconSet: 'tabler icons', code: "\ueeb2"
  },
  
  "ti-math-function-off" : {
    iconSet: 'tabler icons', code: "\uf15e"
  },
  
  "ti-math-function-y" : {
    iconSet: 'tabler icons', code: "\uf4e6"
  },
  
  "ti-math-greater" : {
    iconSet: 'tabler icons', code: "\uf4e7"
  },
  
  "ti-math-integral" : {
    iconSet: 'tabler icons', code: "\uf4e9"
  },
  
  "ti-math-integral-x" : {
    iconSet: 'tabler icons', code: "\uf4e8"
  },
  
  "ti-math-integrals" : {
    iconSet: 'tabler icons', code: "\uf4ea"
  },
  
  "ti-math-lower" : {
    iconSet: 'tabler icons', code: "\uf4eb"
  },
  
  "ti-math-max" : {
    iconSet: 'tabler icons', code: "\uf0f5"
  },
  
  "ti-math-min" : {
    iconSet: 'tabler icons', code: "\uf0f6"
  },
  
  "ti-math-not" : {
    iconSet: 'tabler icons', code: "\uf4ec"
  },
  
  "ti-math-off" : {
    iconSet: 'tabler icons', code: "\uf409"
  },
  
  "ti-math-pi" : {
    iconSet: 'tabler icons', code: "\uf4ee"
  },
  
  "ti-math-pi-divide-2" : {
    iconSet: 'tabler icons', code: "\uf4ed"
  },
  
  "ti-math-symbols" : {
    iconSet: 'tabler icons', code: "\ueeb3"
  },
  
  "ti-math-x-divide-2" : {
    iconSet: 'tabler icons', code: "\uf4ef"
  },
  
  "ti-math-x-divide-y" : {
    iconSet: 'tabler icons', code: "\uf4f1"
  },
  
  "ti-math-x-divide-y-2" : {
    iconSet: 'tabler icons', code: "\uf4f0"
  },
  
  "ti-math-x-minus-x" : {
    iconSet: 'tabler icons', code: "\uf4f2"
  },
  
  "ti-math-x-minus-y" : {
    iconSet: 'tabler icons', code: "\uf4f3"
  },
  
  "ti-math-x-plus-x" : {
    iconSet: 'tabler icons', code: "\uf4f4"
  },
  
  "ti-math-x-plus-y" : {
    iconSet: 'tabler icons', code: "\uf4f5"
  },
  
  "ti-math-xy" : {
    iconSet: 'tabler icons', code: "\uf4f6"
  },
  
  "ti-math-y-minus-y" : {
    iconSet: 'tabler icons', code: "\uf4f7"
  },
  
  "ti-math-y-plus-y" : {
    iconSet: 'tabler icons', code: "\uf4f8"
  },
  
  "ti-maximize" : {
    iconSet: 'tabler icons', code: "\ueaea"
  },
  
  "ti-maximize-off" : {
    iconSet: 'tabler icons', code: "\uf15f"
  },
  
  "ti-meat" : {
    iconSet: 'tabler icons', code: "\uef12"
  },
  
  "ti-meat-off" : {
    iconSet: 'tabler icons', code: "\uf40a"
  },
  
  "ti-medal" : {
    iconSet: 'tabler icons', code: "\uec78"
  },
  
  "ti-medal-2" : {
    iconSet: 'tabler icons', code: "\uefcd"
  },
  
  "ti-medical-cross" : {
    iconSet: 'tabler icons', code: "\uec2f"
  },
  
  "ti-medical-cross-filled" : {
    iconSet: 'tabler icons', code: "\uf681"
  },
  
  "ti-medical-cross-off" : {
    iconSet: 'tabler icons', code: "\uf160"
  },
  
  "ti-medicine-syrup" : {
    iconSet: 'tabler icons', code: "\uef63"
  },
  
  "ti-meeple" : {
    iconSet: 'tabler icons', code: "\uf514"
  },
  
  "ti-menorah" : {
    iconSet: 'tabler icons', code: "\uf58c"
  },
  
  "ti-menu" : {
    iconSet: 'tabler icons', code: "\ueaeb"
  },
  
  "ti-menu-2" : {
    iconSet: 'tabler icons', code: "\uec42"
  },
  
  "ti-menu-order" : {
    iconSet: 'tabler icons', code: "\uf5f5"
  },
  
  "ti-message" : {
    iconSet: 'tabler icons', code: "\ueaef"
  },
  
  "ti-message-2" : {
    iconSet: 'tabler icons', code: "\ueaec"
  },
  
  "ti-message-2-bolt" : {
    iconSet: 'tabler icons', code: "\uf95c"
  },
  
  "ti-message-2-cancel" : {
    iconSet: 'tabler icons', code: "\uf95d"
  },
  
  "ti-message-2-check" : {
    iconSet: 'tabler icons', code: "\uf95e"
  },
  
  "ti-message-2-code" : {
    iconSet: 'tabler icons', code: "\uf012"
  },
  
  "ti-message-2-cog" : {
    iconSet: 'tabler icons', code: "\uf95f"
  },
  
  "ti-message-2-dollar" : {
    iconSet: 'tabler icons', code: "\uf960"
  },
  
  "ti-message-2-down" : {
    iconSet: 'tabler icons', code: "\uf961"
  },
  
  "ti-message-2-exclamation" : {
    iconSet: 'tabler icons', code: "\uf962"
  },
  
  "ti-message-2-heart" : {
    iconSet: 'tabler icons', code: "\uf963"
  },
  
  "ti-message-2-minus" : {
    iconSet: 'tabler icons', code: "\uf964"
  },
  
  "ti-message-2-off" : {
    iconSet: 'tabler icons', code: "\uf40b"
  },
  
  "ti-message-2-pause" : {
    iconSet: 'tabler icons', code: "\uf965"
  },
  
  "ti-message-2-pin" : {
    iconSet: 'tabler icons', code: "\uf966"
  },
  
  "ti-message-2-plus" : {
    iconSet: 'tabler icons', code: "\uf967"
  },
  
  "ti-message-2-question" : {
    iconSet: 'tabler icons', code: "\uf968"
  },
  
  "ti-message-2-search" : {
    iconSet: 'tabler icons', code: "\uf969"
  },
  
  "ti-message-2-share" : {
    iconSet: 'tabler icons', code: "\uf077"
  },
  
  "ti-message-2-star" : {
    iconSet: 'tabler icons', code: "\uf96a"
  },
  
  "ti-message-2-up" : {
    iconSet: 'tabler icons', code: "\uf96b"
  },
  
  "ti-message-2-x" : {
    iconSet: 'tabler icons', code: "\uf96c"
  },
  
  "ti-message-bolt" : {
    iconSet: 'tabler icons', code: "\uf96d"
  },
  
  "ti-message-cancel" : {
    iconSet: 'tabler icons', code: "\uf96e"
  },
  
  "ti-message-chatbot" : {
    iconSet: 'tabler icons', code: "\uf38a"
  },
  
  "ti-message-check" : {
    iconSet: 'tabler icons', code: "\uf96f"
  },
  
  "ti-message-circle" : {
    iconSet: 'tabler icons', code: "\ueaed"
  },
  
  "ti-message-circle-2" : {
    iconSet: 'tabler icons', code: "\ued3f"
  },
  
  "ti-message-circle-2-filled" : {
    iconSet: 'tabler icons', code: "\uf682"
  },
  
  "ti-message-circle-bolt" : {
    iconSet: 'tabler icons', code: "\uf970"
  },
  
  "ti-message-circle-cancel" : {
    iconSet: 'tabler icons', code: "\uf971"
  },
  
  "ti-message-circle-check" : {
    iconSet: 'tabler icons', code: "\uf972"
  },
  
  "ti-message-circle-code" : {
    iconSet: 'tabler icons', code: "\uf973"
  },
  
  "ti-message-circle-cog" : {
    iconSet: 'tabler icons', code: "\uf974"
  },
  
  "ti-message-circle-dollar" : {
    iconSet: 'tabler icons', code: "\uf975"
  },
  
  "ti-message-circle-down" : {
    iconSet: 'tabler icons', code: "\uf976"
  },
  
  "ti-message-circle-exclamation" : {
    iconSet: 'tabler icons', code: "\uf977"
  },
  
  "ti-message-circle-heart" : {
    iconSet: 'tabler icons', code: "\uf978"
  },
  
  "ti-message-circle-minus" : {
    iconSet: 'tabler icons', code: "\uf979"
  },
  
  "ti-message-circle-off" : {
    iconSet: 'tabler icons', code: "\ued40"
  },
  
  "ti-message-circle-pause" : {
    iconSet: 'tabler icons', code: "\uf97a"
  },
  
  "ti-message-circle-pin" : {
    iconSet: 'tabler icons', code: "\uf97b"
  },
  
  "ti-message-circle-plus" : {
    iconSet: 'tabler icons', code: "\uf97c"
  },
  
  "ti-message-circle-question" : {
    iconSet: 'tabler icons', code: "\uf97d"
  },
  
  "ti-message-circle-search" : {
    iconSet: 'tabler icons', code: "\uf97e"
  },
  
  "ti-message-circle-share" : {
    iconSet: 'tabler icons', code: "\uf97f"
  },
  
  "ti-message-circle-star" : {
    iconSet: 'tabler icons', code: "\uf980"
  },
  
  "ti-message-circle-up" : {
    iconSet: 'tabler icons', code: "\uf981"
  },
  
  "ti-message-circle-x" : {
    iconSet: 'tabler icons', code: "\uf982"
  },
  
  "ti-message-code" : {
    iconSet: 'tabler icons', code: "\uf013"
  },
  
  "ti-message-cog" : {
    iconSet: 'tabler icons', code: "\uf983"
  },
  
  "ti-message-dollar" : {
    iconSet: 'tabler icons', code: "\uf984"
  },
  
  "ti-message-dots" : {
    iconSet: 'tabler icons', code: "\ueaee"
  },
  
  "ti-message-down" : {
    iconSet: 'tabler icons', code: "\uf985"
  },
  
  "ti-message-exclamation" : {
    iconSet: 'tabler icons', code: "\uf986"
  },
  
  "ti-message-forward" : {
    iconSet: 'tabler icons', code: "\uf28f"
  },
  
  "ti-message-heart" : {
    iconSet: 'tabler icons', code: "\uf987"
  },
  
  "ti-message-language" : {
    iconSet: 'tabler icons', code: "\uefae"
  },
  
  "ti-message-minus" : {
    iconSet: 'tabler icons', code: "\uf988"
  },
  
  "ti-message-off" : {
    iconSet: 'tabler icons', code: "\ued41"
  },
  
  "ti-message-pause" : {
    iconSet: 'tabler icons', code: "\uf989"
  },
  
  "ti-message-pin" : {
    iconSet: 'tabler icons', code: "\uf98a"
  },
  
  "ti-message-plus" : {
    iconSet: 'tabler icons', code: "\uec9a"
  },
  
  "ti-message-question" : {
    iconSet: 'tabler icons', code: "\uf98b"
  },
  
  "ti-message-report" : {
    iconSet: 'tabler icons', code: "\uec9b"
  },
  
  "ti-message-search" : {
    iconSet: 'tabler icons', code: "\uf98c"
  },
  
  "ti-message-share" : {
    iconSet: 'tabler icons', code: "\uf078"
  },
  
  "ti-message-star" : {
    iconSet: 'tabler icons', code: "\uf98d"
  },
  
  "ti-message-up" : {
    iconSet: 'tabler icons', code: "\uf98e"
  },
  
  "ti-message-x" : {
    iconSet: 'tabler icons', code: "\uf98f"
  },
  
  "ti-messages" : {
    iconSet: 'tabler icons', code: "\ueb6c"
  },
  
  "ti-messages-off" : {
    iconSet: 'tabler icons', code: "\ued42"
  },
  
  "ti-meteor" : {
    iconSet: 'tabler icons', code: "\uf1fd"
  },
  
  "ti-meteor-off" : {
    iconSet: 'tabler icons', code: "\uf40c"
  },
  
  "ti-mickey" : {
    iconSet: 'tabler icons', code: "\uf2a3"
  },
  
  "ti-mickey-filled" : {
    iconSet: 'tabler icons', code: "\uf683"
  },
  
  "ti-microphone" : {
    iconSet: 'tabler icons', code: "\ueaf0"
  },
  
  "ti-microphone-2" : {
    iconSet: 'tabler icons', code: "\uef2c"
  },
  
  "ti-microphone-2-off" : {
    iconSet: 'tabler icons', code: "\uf40d"
  },
  
  "ti-microphone-off" : {
    iconSet: 'tabler icons', code: "\ued16"
  },
  
  "ti-microscope" : {
    iconSet: 'tabler icons', code: "\uef64"
  },
  
  "ti-microscope-off" : {
    iconSet: 'tabler icons', code: "\uf40e"
  },
  
  "ti-microwave" : {
    iconSet: 'tabler icons', code: "\uf248"
  },
  
  "ti-microwave-off" : {
    iconSet: 'tabler icons', code: "\uf264"
  },
  
  "ti-military-award" : {
    iconSet: 'tabler icons', code: "\uf079"
  },
  
  "ti-military-rank" : {
    iconSet: 'tabler icons', code: "\uefcf"
  },
  
  "ti-milk" : {
    iconSet: 'tabler icons', code: "\uef13"
  },
  
  "ti-milk-off" : {
    iconSet: 'tabler icons', code: "\uf40f"
  },
  
  "ti-milkshake" : {
    iconSet: 'tabler icons', code: "\uf4c8"
  },
  
  "ti-minimize" : {
    iconSet: 'tabler icons', code: "\ueaf1"
  },
  
  "ti-minus" : {
    iconSet: 'tabler icons', code: "\ueaf2"
  },
  
  "ti-minus-vertical" : {
    iconSet: 'tabler icons', code: "\ueeb4"
  },
  
  "ti-mist" : {
    iconSet: 'tabler icons', code: "\uec30"
  },
  
  "ti-mist-off" : {
    iconSet: 'tabler icons', code: "\uf410"
  },
  
  "ti-mobiledata" : {
    iconSet: 'tabler icons', code: "\uf9f5"
  },
  
  "ti-mobiledata-off" : {
    iconSet: 'tabler icons', code: "\uf9f4"
  },
  
  "ti-moneybag" : {
    iconSet: 'tabler icons', code: "\uf506"
  },
  
  "ti-mood-angry" : {
    iconSet: 'tabler icons', code: "\uf2de"
  },
  
  "ti-mood-annoyed" : {
    iconSet: 'tabler icons', code: "\uf2e0"
  },
  
  "ti-mood-annoyed-2" : {
    iconSet: 'tabler icons', code: "\uf2df"
  },
  
  "ti-mood-boy" : {
    iconSet: 'tabler icons', code: "\ued2d"
  },
  
  "ti-mood-check" : {
    iconSet: 'tabler icons', code: "\uf7b3"
  },
  
  "ti-mood-cog" : {
    iconSet: 'tabler icons', code: "\uf7b4"
  },
  
  "ti-mood-confuzed" : {
    iconSet: 'tabler icons', code: "\ueaf3"
  },
  
  "ti-mood-confuzed-filled" : {
    iconSet: 'tabler icons', code: "\uf7f2"
  },
  
  "ti-mood-crazy-happy" : {
    iconSet: 'tabler icons', code: "\ued90"
  },
  
  "ti-mood-cry" : {
    iconSet: 'tabler icons', code: "\uecbb"
  },
  
  "ti-mood-dollar" : {
    iconSet: 'tabler icons', code: "\uf7b5"
  },
  
  "ti-mood-edit" : {
    iconSet: 'tabler icons', code: "\ufa05"
  },
  
  "ti-mood-empty" : {
    iconSet: 'tabler icons', code: "\ueeb5"
  },
  
  "ti-mood-empty-filled" : {
    iconSet: 'tabler icons', code: "\uf7f3"
  },
  
  "ti-mood-happy" : {
    iconSet: 'tabler icons', code: "\ueaf4"
  },
  
  "ti-mood-happy-filled" : {
    iconSet: 'tabler icons', code: "\uf7f4"
  },
  
  "ti-mood-heart" : {
    iconSet: 'tabler icons', code: "\uf7b6"
  },
  
  "ti-mood-kid" : {
    iconSet: 'tabler icons', code: "\uec03"
  },
  
  "ti-mood-kid-filled" : {
    iconSet: 'tabler icons', code: "\uf7f5"
  },
  
  "ti-mood-look-left" : {
    iconSet: 'tabler icons', code: "\uf2c5"
  },
  
  "ti-mood-look-right" : {
    iconSet: 'tabler icons', code: "\uf2c6"
  },
  
  "ti-mood-minus" : {
    iconSet: 'tabler icons', code: "\uf7b7"
  },
  
  "ti-mood-nerd" : {
    iconSet: 'tabler icons', code: "\uf2e1"
  },
  
  "ti-mood-nervous" : {
    iconSet: 'tabler icons', code: "\uef96"
  },
  
  "ti-mood-neutral" : {
    iconSet: 'tabler icons', code: "\ueaf5"
  },
  
  "ti-mood-neutral-filled" : {
    iconSet: 'tabler icons', code: "\uf7f6"
  },
  
  "ti-mood-off" : {
    iconSet: 'tabler icons', code: "\uf161"
  },
  
  "ti-mood-pin" : {
    iconSet: 'tabler icons', code: "\uf7b8"
  },
  
  "ti-mood-plus" : {
    iconSet: 'tabler icons', code: "\uf7b9"
  },
  
  "ti-mood-sad" : {
    iconSet: 'tabler icons', code: "\ueaf6"
  },
  
  "ti-mood-sad-2" : {
    iconSet: 'tabler icons', code: "\uf2e2"
  },
  
  "ti-mood-sad-dizzy" : {
    iconSet: 'tabler icons', code: "\uf2e3"
  },
  
  "ti-mood-sad-filled" : {
    iconSet: 'tabler icons', code: "\uf7f7"
  },
  
  "ti-mood-sad-squint" : {
    iconSet: 'tabler icons', code: "\uf2e4"
  },
  
  "ti-mood-search" : {
    iconSet: 'tabler icons', code: "\uf7ba"
  },
  
  "ti-mood-share" : {
    iconSet: 'tabler icons', code: "\ufa06"
  },
  
  "ti-mood-sick" : {
    iconSet: 'tabler icons', code: "\uf2e5"
  },
  
  "ti-mood-silence" : {
    iconSet: 'tabler icons', code: "\uf2e6"
  },
  
  "ti-mood-sing" : {
    iconSet: 'tabler icons', code: "\uf2c7"
  },
  
  "ti-mood-smile" : {
    iconSet: 'tabler icons', code: "\ueaf7"
  },
  
  "ti-mood-smile-beam" : {
    iconSet: 'tabler icons', code: "\uf2e7"
  },
  
  "ti-mood-smile-dizzy" : {
    iconSet: 'tabler icons', code: "\uf2e8"
  },
  
  "ti-mood-smile-filled" : {
    iconSet: 'tabler icons', code: "\uf7f8"
  },
  
  "ti-mood-suprised" : {
    iconSet: 'tabler icons', code: "\uec04"
  },
  
  "ti-mood-tongue" : {
    iconSet: 'tabler icons', code: "\ueb95"
  },
  
  "ti-mood-tongue-wink" : {
    iconSet: 'tabler icons', code: "\uf2ea"
  },
  
  "ti-mood-tongue-wink-2" : {
    iconSet: 'tabler icons', code: "\uf2e9"
  },
  
  "ti-mood-unamused" : {
    iconSet: 'tabler icons', code: "\uf2eb"
  },
  
  "ti-mood-up" : {
    iconSet: 'tabler icons', code: "\uf7bb"
  },
  
  "ti-mood-wink" : {
    iconSet: 'tabler icons', code: "\uf2ed"
  },
  
  "ti-mood-wink-2" : {
    iconSet: 'tabler icons', code: "\uf2ec"
  },
  
  "ti-mood-wrrr" : {
    iconSet: 'tabler icons', code: "\uf2ee"
  },
  
  "ti-mood-x" : {
    iconSet: 'tabler icons', code: "\uf7bc"
  },
  
  "ti-mood-xd" : {
    iconSet: 'tabler icons', code: "\uf2ef"
  },
  
  "ti-moon" : {
    iconSet: 'tabler icons', code: "\ueaf8"
  },
  
  "ti-moon-2" : {
    iconSet: 'tabler icons', code: "\uece6"
  },
  
  "ti-moon-filled" : {
    iconSet: 'tabler icons', code: "\uf684"
  },
  
  "ti-moon-off" : {
    iconSet: 'tabler icons', code: "\uf162"
  },
  
  "ti-moon-stars" : {
    iconSet: 'tabler icons', code: "\uece7"
  },
  
  "ti-moped" : {
    iconSet: 'tabler icons', code: "\uecbc"
  },
  
  "ti-motorbike" : {
    iconSet: 'tabler icons', code: "\ueeb6"
  },
  
  "ti-mountain" : {
    iconSet: 'tabler icons', code: "\uef97"
  },
  
  "ti-mountain-off" : {
    iconSet: 'tabler icons', code: "\uf411"
  },
  
  "ti-mouse" : {
    iconSet: 'tabler icons', code: "\ueaf9"
  },
  
  "ti-mouse-2" : {
    iconSet: 'tabler icons', code: "\uf1d7"
  },
  
  "ti-mouse-off" : {
    iconSet: 'tabler icons', code: "\uf163"
  },
  
  "ti-moustache" : {
    iconSet: 'tabler icons', code: "\uf4c9"
  },
  
  "ti-movie" : {
    iconSet: 'tabler icons', code: "\ueafa"
  },
  
  "ti-movie-off" : {
    iconSet: 'tabler icons', code: "\uf164"
  },
  
  "ti-mug" : {
    iconSet: 'tabler icons', code: "\ueafb"
  },
  
  "ti-mug-off" : {
    iconSet: 'tabler icons', code: "\uf165"
  },
  
  "ti-multiplier-0-5x" : {
    iconSet: 'tabler icons', code: "\uef41"
  },
  
  "ti-multiplier-1-5x" : {
    iconSet: 'tabler icons', code: "\uef42"
  },
  
  "ti-multiplier-1x" : {
    iconSet: 'tabler icons', code: "\uef43"
  },
  
  "ti-multiplier-2x" : {
    iconSet: 'tabler icons', code: "\uef44"
  },
  
  "ti-mushroom" : {
    iconSet: 'tabler icons', code: "\uef14"
  },
  
  "ti-mushroom-filled" : {
    iconSet: 'tabler icons', code: "\uf7f9"
  },
  
  "ti-mushroom-off" : {
    iconSet: 'tabler icons', code: "\uf412"
  },
  
  "ti-music" : {
    iconSet: 'tabler icons', code: "\ueafc"
  },
  
  "ti-music-off" : {
    iconSet: 'tabler icons', code: "\uf166"
  },
  
  "ti-navigation" : {
    iconSet: 'tabler icons', code: "\uf2c8"
  },
  
  "ti-navigation-filled" : {
    iconSet: 'tabler icons', code: "\uf685"
  },
  
  "ti-navigation-off" : {
    iconSet: 'tabler icons', code: "\uf413"
  },
  
  "ti-needle" : {
    iconSet: 'tabler icons', code: "\uf508"
  },
  
  "ti-needle-thread" : {
    iconSet: 'tabler icons', code: "\uf507"
  },
  
  "ti-network" : {
    iconSet: 'tabler icons', code: "\uf09f"
  },
  
  "ti-network-off" : {
    iconSet: 'tabler icons', code: "\uf414"
  },
  
  "ti-new-section" : {
    iconSet: 'tabler icons', code: "\uebc1"
  },
  
  "ti-news" : {
    iconSet: 'tabler icons', code: "\ueafd"
  },
  
  "ti-news-off" : {
    iconSet: 'tabler icons', code: "\uf167"
  },
  
  "ti-nfc" : {
    iconSet: 'tabler icons', code: "\ueeb7"
  },
  
  "ti-nfc-off" : {
    iconSet: 'tabler icons', code: "\uf168"
  },
  
  "ti-no-copyright" : {
    iconSet: 'tabler icons', code: "\uefb9"
  },
  
  "ti-no-creative-commons" : {
    iconSet: 'tabler icons', code: "\uefba"
  },
  
  "ti-no-derivatives" : {
    iconSet: 'tabler icons', code: "\uefbb"
  },
  
  "ti-north-star" : {
    iconSet: 'tabler icons', code: "\uf014"
  },
  
  "ti-note" : {
    iconSet: 'tabler icons', code: "\ueb6d"
  },
  
  "ti-note-off" : {
    iconSet: 'tabler icons', code: "\uf169"
  },
  
  "ti-notebook" : {
    iconSet: 'tabler icons', code: "\ueb96"
  },
  
  "ti-notebook-off" : {
    iconSet: 'tabler icons', code: "\uf415"
  },
  
  "ti-notes" : {
    iconSet: 'tabler icons', code: "\ueb6e"
  },
  
  "ti-notes-off" : {
    iconSet: 'tabler icons', code: "\uf16a"
  },
  
  "ti-notification" : {
    iconSet: 'tabler icons', code: "\ueafe"
  },
  
  "ti-notification-off" : {
    iconSet: 'tabler icons', code: "\uf16b"
  },
  
  "ti-number" : {
    iconSet: 'tabler icons', code: "\uf1fe"
  },
  
  "ti-number-0" : {
    iconSet: 'tabler icons', code: "\uedf0"
  },
  
  "ti-number-1" : {
    iconSet: 'tabler icons', code: "\uedf1"
  },
  
  "ti-number-2" : {
    iconSet: 'tabler icons', code: "\uedf2"
  },
  
  "ti-number-3" : {
    iconSet: 'tabler icons', code: "\uedf3"
  },
  
  "ti-number-4" : {
    iconSet: 'tabler icons', code: "\uedf4"
  },
  
  "ti-number-5" : {
    iconSet: 'tabler icons', code: "\uedf5"
  },
  
  "ti-number-6" : {
    iconSet: 'tabler icons', code: "\uedf6"
  },
  
  "ti-number-7" : {
    iconSet: 'tabler icons', code: "\uedf7"
  },
  
  "ti-number-8" : {
    iconSet: 'tabler icons', code: "\uedf8"
  },
  
  "ti-number-9" : {
    iconSet: 'tabler icons', code: "\uedf9"
  },
  
  "ti-numbers" : {
    iconSet: 'tabler icons', code: "\uf015"
  },
  
  "ti-nurse" : {
    iconSet: 'tabler icons', code: "\uef65"
  },
  
  "ti-octagon" : {
    iconSet: 'tabler icons', code: "\uecbd"
  },
  
  "ti-octagon-filled" : {
    iconSet: 'tabler icons', code: "\uf686"
  },
  
  "ti-octagon-off" : {
    iconSet: 'tabler icons', code: "\ueeb8"
  },
  
  "ti-old" : {
    iconSet: 'tabler icons', code: "\ueeb9"
  },
  
  "ti-olympics" : {
    iconSet: 'tabler icons', code: "\ueeba"
  },
  
  "ti-olympics-off" : {
    iconSet: 'tabler icons', code: "\uf416"
  },
  
  "ti-om" : {
    iconSet: 'tabler icons', code: "\uf58d"
  },
  
  "ti-omega" : {
    iconSet: 'tabler icons', code: "\ueb97"
  },
  
  "ti-outbound" : {
    iconSet: 'tabler icons', code: "\uf249"
  },
  
  "ti-outlet" : {
    iconSet: 'tabler icons', code: "\uebd7"
  },
  
  "ti-oval" : {
    iconSet: 'tabler icons', code: "\uf02e"
  },
  
  "ti-oval-filled" : {
    iconSet: 'tabler icons', code: "\uf687"
  },
  
  "ti-oval-vertical" : {
    iconSet: 'tabler icons', code: "\uf02d"
  },
  
  "ti-oval-vertical-filled" : {
    iconSet: 'tabler icons', code: "\uf688"
  },
  
  "ti-overline" : {
    iconSet: 'tabler icons', code: "\ueebb"
  },
  
  "ti-package" : {
    iconSet: 'tabler icons', code: "\ueaff"
  },
  
  "ti-package-export" : {
    iconSet: 'tabler icons', code: "\uf07a"
  },
  
  "ti-package-import" : {
    iconSet: 'tabler icons', code: "\uf07b"
  },
  
  "ti-package-off" : {
    iconSet: 'tabler icons', code: "\uf16c"
  },
  
  "ti-packages" : {
    iconSet: 'tabler icons', code: "\uf2c9"
  },
  
  "ti-pacman" : {
    iconSet: 'tabler icons', code: "\ueebc"
  },
  
  "ti-page-break" : {
    iconSet: 'tabler icons', code: "\uec81"
  },
  
  "ti-paint" : {
    iconSet: 'tabler icons', code: "\ueb00"
  },
  
  "ti-paint-filled" : {
    iconSet: 'tabler icons', code: "\uf75f"
  },
  
  "ti-paint-off" : {
    iconSet: 'tabler icons', code: "\uf16d"
  },
  
  "ti-palette" : {
    iconSet: 'tabler icons', code: "\ueb01"
  },
  
  "ti-palette-off" : {
    iconSet: 'tabler icons', code: "\uf16e"
  },
  
  "ti-panorama-horizontal" : {
    iconSet: 'tabler icons', code: "\ued33"
  },
  
  "ti-panorama-horizontal-off" : {
    iconSet: 'tabler icons', code: "\uf417"
  },
  
  "ti-panorama-vertical" : {
    iconSet: 'tabler icons', code: "\ued34"
  },
  
  "ti-panorama-vertical-off" : {
    iconSet: 'tabler icons', code: "\uf418"
  },
  
  "ti-paper-bag" : {
    iconSet: 'tabler icons', code: "\uf02f"
  },
  
  "ti-paper-bag-off" : {
    iconSet: 'tabler icons', code: "\uf16f"
  },
  
  "ti-paperclip" : {
    iconSet: 'tabler icons', code: "\ueb02"
  },
  
  "ti-parachute" : {
    iconSet: 'tabler icons', code: "\ued7c"
  },
  
  "ti-parachute-off" : {
    iconSet: 'tabler icons', code: "\uf170"
  },
  
  "ti-parentheses" : {
    iconSet: 'tabler icons', code: "\uebd8"
  },
  
  "ti-parentheses-off" : {
    iconSet: 'tabler icons', code: "\uf171"
  },
  
  "ti-parking" : {
    iconSet: 'tabler icons', code: "\ueb03"
  },
  
  "ti-parking-off" : {
    iconSet: 'tabler icons', code: "\uf172"
  },
  
  "ti-password" : {
    iconSet: 'tabler icons', code: "\uf4ca"
  },
  
  "ti-paw" : {
    iconSet: 'tabler icons', code: "\ueff9"
  },
  
  "ti-paw-filled" : {
    iconSet: 'tabler icons', code: "\uf689"
  },
  
  "ti-paw-off" : {
    iconSet: 'tabler icons', code: "\uf419"
  },
  
  "ti-pdf" : {
    iconSet: 'tabler icons', code: "\uf7ac"
  },
  
  "ti-peace" : {
    iconSet: 'tabler icons', code: "\uecbe"
  },
  
  "ti-pencil" : {
    iconSet: 'tabler icons', code: "\ueb04"
  },
  
  "ti-pencil-minus" : {
    iconSet: 'tabler icons', code: "\uf1eb"
  },
  
  "ti-pencil-off" : {
    iconSet: 'tabler icons', code: "\uf173"
  },
  
  "ti-pencil-plus" : {
    iconSet: 'tabler icons', code: "\uf1ec"
  },
  
  "ti-pennant" : {
    iconSet: 'tabler icons', code: "\ued7d"
  },
  
  "ti-pennant-2" : {
    iconSet: 'tabler icons', code: "\uf06a"
  },
  
  "ti-pennant-2-filled" : {
    iconSet: 'tabler icons', code: "\uf68a"
  },
  
  "ti-pennant-filled" : {
    iconSet: 'tabler icons', code: "\uf68b"
  },
  
  "ti-pennant-off" : {
    iconSet: 'tabler icons', code: "\uf174"
  },
  
  "ti-pentagon" : {
    iconSet: 'tabler icons', code: "\uefe3"
  },
  
  "ti-pentagon-filled" : {
    iconSet: 'tabler icons', code: "\uf68c"
  },
  
  "ti-pentagon-off" : {
    iconSet: 'tabler icons', code: "\uf41a"
  },
  
  "ti-pentagram" : {
    iconSet: 'tabler icons', code: "\uf586"
  },
  
  "ti-pepper" : {
    iconSet: 'tabler icons', code: "\uef15"
  },
  
  "ti-pepper-off" : {
    iconSet: 'tabler icons', code: "\uf175"
  },
  
  "ti-percentage" : {
    iconSet: 'tabler icons', code: "\uecf4"
  },
  
  "ti-perfume" : {
    iconSet: 'tabler icons', code: "\uf509"
  },
  
  "ti-perspective" : {
    iconSet: 'tabler icons', code: "\ueebd"
  },
  
  "ti-perspective-off" : {
    iconSet: 'tabler icons', code: "\uf176"
  },
  
  "ti-phone" : {
    iconSet: 'tabler icons', code: "\ueb09"
  },
  
  "ti-phone-call" : {
    iconSet: 'tabler icons', code: "\ueb05"
  },
  
  "ti-phone-calling" : {
    iconSet: 'tabler icons', code: "\uec43"
  },
  
  "ti-phone-check" : {
    iconSet: 'tabler icons', code: "\uec05"
  },
  
  "ti-phone-incoming" : {
    iconSet: 'tabler icons', code: "\ueb06"
  },
  
  "ti-phone-off" : {
    iconSet: 'tabler icons', code: "\uecf5"
  },
  
  "ti-phone-outgoing" : {
    iconSet: 'tabler icons', code: "\ueb07"
  },
  
  "ti-phone-pause" : {
    iconSet: 'tabler icons', code: "\ueb08"
  },
  
  "ti-phone-plus" : {
    iconSet: 'tabler icons', code: "\uec06"
  },
  
  "ti-phone-x" : {
    iconSet: 'tabler icons', code: "\uec07"
  },
  
  "ti-photo" : {
    iconSet: 'tabler icons', code: "\ueb0a"
  },
  
  "ti-photo-ai" : {
    iconSet: 'tabler icons', code: "\ufa32"
  },
  
  "ti-photo-bolt" : {
    iconSet: 'tabler icons', code: "\uf990"
  },
  
  "ti-photo-cancel" : {
    iconSet: 'tabler icons', code: "\uf35d"
  },
  
  "ti-photo-check" : {
    iconSet: 'tabler icons', code: "\uf35e"
  },
  
  "ti-photo-code" : {
    iconSet: 'tabler icons', code: "\uf991"
  },
  
  "ti-photo-cog" : {
    iconSet: 'tabler icons', code: "\uf992"
  },
  
  "ti-photo-dollar" : {
    iconSet: 'tabler icons', code: "\uf993"
  },
  
  "ti-photo-down" : {
    iconSet: 'tabler icons', code: "\uf35f"
  },
  
  "ti-photo-edit" : {
    iconSet: 'tabler icons', code: "\uf360"
  },
  
  "ti-photo-exclamation" : {
    iconSet: 'tabler icons', code: "\uf994"
  },
  
  "ti-photo-heart" : {
    iconSet: 'tabler icons', code: "\uf361"
  },
  
  "ti-photo-minus" : {
    iconSet: 'tabler icons', code: "\uf362"
  },
  
  "ti-photo-off" : {
    iconSet: 'tabler icons', code: "\uecf6"
  },
  
  "ti-photo-pause" : {
    iconSet: 'tabler icons', code: "\uf995"
  },
  
  "ti-photo-pin" : {
    iconSet: 'tabler icons', code: "\uf996"
  },
  
  "ti-photo-plus" : {
    iconSet: 'tabler icons', code: "\uf363"
  },
  
  "ti-photo-question" : {
    iconSet: 'tabler icons', code: "\uf997"
  },
  
  "ti-photo-search" : {
    iconSet: 'tabler icons', code: "\uf364"
  },
  
  "ti-photo-sensor" : {
    iconSet: 'tabler icons', code: "\uf798"
  },
  
  "ti-photo-sensor-2" : {
    iconSet: 'tabler icons', code: "\uf796"
  },
  
  "ti-photo-sensor-3" : {
    iconSet: 'tabler icons', code: "\uf797"
  },
  
  "ti-photo-share" : {
    iconSet: 'tabler icons', code: "\uf998"
  },
  
  "ti-photo-shield" : {
    iconSet: 'tabler icons', code: "\uf365"
  },
  
  "ti-photo-star" : {
    iconSet: 'tabler icons', code: "\uf366"
  },
  
  "ti-photo-up" : {
    iconSet: 'tabler icons', code: "\uf38b"
  },
  
  "ti-photo-x" : {
    iconSet: 'tabler icons', code: "\uf367"
  },
  
  "ti-physotherapist" : {
    iconSet: 'tabler icons', code: "\ueebe"
  },
  
  "ti-picture-in-picture" : {
    iconSet: 'tabler icons', code: "\ued35"
  },
  
  "ti-picture-in-picture-off" : {
    iconSet: 'tabler icons', code: "\ued43"
  },
  
  "ti-picture-in-picture-on" : {
    iconSet: 'tabler icons', code: "\ued44"
  },
  
  "ti-picture-in-picture-top" : {
    iconSet: 'tabler icons', code: "\uefe4"
  },
  
  "ti-pig" : {
    iconSet: 'tabler icons', code: "\uef52"
  },
  
  "ti-pig-money" : {
    iconSet: 'tabler icons', code: "\uf38c"
  },
  
  "ti-pig-off" : {
    iconSet: 'tabler icons', code: "\uf177"
  },
  
  "ti-pilcrow" : {
    iconSet: 'tabler icons', code: "\uf5f6"
  },
  
  "ti-pill" : {
    iconSet: 'tabler icons', code: "\uec44"
  },
  
  "ti-pill-off" : {
    iconSet: 'tabler icons', code: "\uf178"
  },
  
  "ti-pills" : {
    iconSet: 'tabler icons', code: "\uef66"
  },
  
  "ti-pin" : {
    iconSet: 'tabler icons', code: "\uec9c"
  },
  
  "ti-pin-filled" : {
    iconSet: 'tabler icons', code: "\uf68d"
  },
  
  "ti-ping-pong" : {
    iconSet: 'tabler icons', code: "\uf38d"
  },
  
  "ti-pinned" : {
    iconSet: 'tabler icons', code: "\ued60"
  },
  
  "ti-pinned-filled" : {
    iconSet: 'tabler icons', code: "\uf68e"
  },
  
  "ti-pinned-off" : {
    iconSet: 'tabler icons', code: "\ued5f"
  },
  
  "ti-pizza" : {
    iconSet: 'tabler icons', code: "\uedbb"
  },
  
  "ti-pizza-off" : {
    iconSet: 'tabler icons', code: "\uf179"
  },
  
  "ti-placeholder" : {
    iconSet: 'tabler icons', code: "\uf626"
  },
  
  "ti-plane" : {
    iconSet: 'tabler icons', code: "\ueb6f"
  },
  
  "ti-plane-arrival" : {
    iconSet: 'tabler icons', code: "\ueb99"
  },
  
  "ti-plane-departure" : {
    iconSet: 'tabler icons', code: "\ueb9a"
  },
  
  "ti-plane-inflight" : {
    iconSet: 'tabler icons', code: "\uef98"
  },
  
  "ti-plane-off" : {
    iconSet: 'tabler icons', code: "\uf17a"
  },
  
  "ti-plane-tilt" : {
    iconSet: 'tabler icons', code: "\uf1ed"
  },
  
  "ti-planet" : {
    iconSet: 'tabler icons', code: "\uec08"
  },
  
  "ti-planet-off" : {
    iconSet: 'tabler icons', code: "\uf17b"
  },
  
  "ti-plant" : {
    iconSet: 'tabler icons', code: "\ued50"
  },
  
  "ti-plant-2" : {
    iconSet: 'tabler icons', code: "\ued7e"
  },
  
  "ti-plant-2-off" : {
    iconSet: 'tabler icons', code: "\uf17c"
  },
  
  "ti-plant-off" : {
    iconSet: 'tabler icons', code: "\uf17d"
  },
  
  "ti-play-card" : {
    iconSet: 'tabler icons', code: "\ueebf"
  },
  
  "ti-play-card-off" : {
    iconSet: 'tabler icons', code: "\uf17e"
  },
  
  "ti-player-eject" : {
    iconSet: 'tabler icons', code: "\uefbc"
  },
  
  "ti-player-eject-filled" : {
    iconSet: 'tabler icons', code: "\uf68f"
  },
  
  "ti-player-pause" : {
    iconSet: 'tabler icons', code: "\ued45"
  },
  
  "ti-player-pause-filled" : {
    iconSet: 'tabler icons', code: "\uf690"
  },
  
  "ti-player-play" : {
    iconSet: 'tabler icons', code: "\ued46"
  },
  
  "ti-player-play-filled" : {
    iconSet: 'tabler icons', code: "\uf691"
  },
  
  "ti-player-record" : {
    iconSet: 'tabler icons', code: "\ued47"
  },
  
  "ti-player-record-filled" : {
    iconSet: 'tabler icons', code: "\uf692"
  },
  
  "ti-player-skip-back" : {
    iconSet: 'tabler icons', code: "\ued48"
  },
  
  "ti-player-skip-back-filled" : {
    iconSet: 'tabler icons', code: "\uf693"
  },
  
  "ti-player-skip-forward" : {
    iconSet: 'tabler icons', code: "\ued49"
  },
  
  "ti-player-skip-forward-filled" : {
    iconSet: 'tabler icons', code: "\uf694"
  },
  
  "ti-player-stop" : {
    iconSet: 'tabler icons', code: "\ued4a"
  },
  
  "ti-player-stop-filled" : {
    iconSet: 'tabler icons', code: "\uf695"
  },
  
  "ti-player-track-next" : {
    iconSet: 'tabler icons', code: "\ued4b"
  },
  
  "ti-player-track-next-filled" : {
    iconSet: 'tabler icons', code: "\uf696"
  },
  
  "ti-player-track-prev" : {
    iconSet: 'tabler icons', code: "\ued4c"
  },
  
  "ti-player-track-prev-filled" : {
    iconSet: 'tabler icons', code: "\uf697"
  },
  
  "ti-playlist" : {
    iconSet: 'tabler icons', code: "\ueec0"
  },
  
  "ti-playlist-add" : {
    iconSet: 'tabler icons', code: "\uf008"
  },
  
  "ti-playlist-off" : {
    iconSet: 'tabler icons', code: "\uf17f"
  },
  
  "ti-playlist-x" : {
    iconSet: 'tabler icons', code: "\uf009"
  },
  
  "ti-playstation-circle" : {
    iconSet: 'tabler icons', code: "\uf2ad"
  },
  
  "ti-playstation-square" : {
    iconSet: 'tabler icons', code: "\uf2ae"
  },
  
  "ti-playstation-triangle" : {
    iconSet: 'tabler icons', code: "\uf2af"
  },
  
  "ti-playstation-x" : {
    iconSet: 'tabler icons', code: "\uf2b0"
  },
  
  "ti-plug" : {
    iconSet: 'tabler icons', code: "\uebd9"
  },
  
  "ti-plug-connected" : {
    iconSet: 'tabler icons', code: "\uf00a"
  },
  
  "ti-plug-connected-x" : {
    iconSet: 'tabler icons', code: "\uf0a0"
  },
  
  "ti-plug-off" : {
    iconSet: 'tabler icons', code: "\uf180"
  },
  
  "ti-plug-x" : {
    iconSet: 'tabler icons', code: "\uf0a1"
  },
  
  "ti-plus" : {
    iconSet: 'tabler icons', code: "\ueb0b"
  },
  
  "ti-plus-equal" : {
    iconSet: 'tabler icons', code: "\uf7ad"
  },
  
  "ti-plus-minus" : {
    iconSet: 'tabler icons', code: "\uf7ae"
  },
  
  "ti-png" : {
    iconSet: 'tabler icons', code: "\uf3ad"
  },
  
  "ti-podium" : {
    iconSet: 'tabler icons', code: "\uf1d8"
  },
  
  "ti-podium-off" : {
    iconSet: 'tabler icons', code: "\uf41b"
  },
  
  "ti-point" : {
    iconSet: 'tabler icons', code: "\ueb0c"
  },
  
  "ti-point-filled" : {
    iconSet: 'tabler icons', code: "\uf698"
  },
  
  "ti-point-off" : {
    iconSet: 'tabler icons', code: "\uf181"
  },
  
  "ti-pointer" : {
    iconSet: 'tabler icons', code: "\uf265"
  },
  
  "ti-pointer-bolt" : {
    iconSet: 'tabler icons', code: "\uf999"
  },
  
  "ti-pointer-cancel" : {
    iconSet: 'tabler icons', code: "\uf99a"
  },
  
  "ti-pointer-check" : {
    iconSet: 'tabler icons', code: "\uf99b"
  },
  
  "ti-pointer-code" : {
    iconSet: 'tabler icons', code: "\uf99c"
  },
  
  "ti-pointer-cog" : {
    iconSet: 'tabler icons', code: "\uf99d"
  },
  
  "ti-pointer-dollar" : {
    iconSet: 'tabler icons', code: "\uf99e"
  },
  
  "ti-pointer-down" : {
    iconSet: 'tabler icons', code: "\uf99f"
  },
  
  "ti-pointer-exclamation" : {
    iconSet: 'tabler icons', code: "\uf9a0"
  },
  
  "ti-pointer-heart" : {
    iconSet: 'tabler icons', code: "\uf9a1"
  },
  
  "ti-pointer-minus" : {
    iconSet: 'tabler icons', code: "\uf9a2"
  },
  
  "ti-pointer-off" : {
    iconSet: 'tabler icons', code: "\uf9a3"
  },
  
  "ti-pointer-pause" : {
    iconSet: 'tabler icons', code: "\uf9a4"
  },
  
  "ti-pointer-pin" : {
    iconSet: 'tabler icons', code: "\uf9a5"
  },
  
  "ti-pointer-plus" : {
    iconSet: 'tabler icons', code: "\uf9a6"
  },
  
  "ti-pointer-question" : {
    iconSet: 'tabler icons', code: "\uf9a7"
  },
  
  "ti-pointer-search" : {
    iconSet: 'tabler icons', code: "\uf9a8"
  },
  
  "ti-pointer-share" : {
    iconSet: 'tabler icons', code: "\uf9a9"
  },
  
  "ti-pointer-star" : {
    iconSet: 'tabler icons', code: "\uf9aa"
  },
  
  "ti-pointer-up" : {
    iconSet: 'tabler icons', code: "\uf9ab"
  },
  
  "ti-pointer-x" : {
    iconSet: 'tabler icons', code: "\uf9ac"
  },
  
  "ti-pokeball" : {
    iconSet: 'tabler icons', code: "\ueec1"
  },
  
  "ti-pokeball-off" : {
    iconSet: 'tabler icons', code: "\uf41c"
  },
  
  "ti-poker-chip" : {
    iconSet: 'tabler icons', code: "\uf515"
  },
  
  "ti-polaroid" : {
    iconSet: 'tabler icons', code: "\ueec2"
  },
  
  "ti-polygon" : {
    iconSet: 'tabler icons', code: "\uefd0"
  },
  
  "ti-polygon-off" : {
    iconSet: 'tabler icons', code: "\uf182"
  },
  
  "ti-poo" : {
    iconSet: 'tabler icons', code: "\uf258"
  },
  
  "ti-pool" : {
    iconSet: 'tabler icons', code: "\ued91"
  },
  
  "ti-pool-off" : {
    iconSet: 'tabler icons', code: "\uf41d"
  },
  
  "ti-power" : {
    iconSet: 'tabler icons', code: "\ueb0d"
  },
  
  "ti-pray" : {
    iconSet: 'tabler icons', code: "\uecbf"
  },
  
  "ti-premium-rights" : {
    iconSet: 'tabler icons', code: "\uefbd"
  },
  
  "ti-prescription" : {
    iconSet: 'tabler icons', code: "\uef99"
  },
  
  "ti-presentation" : {
    iconSet: 'tabler icons', code: "\ueb70"
  },
  
  "ti-presentation-analytics" : {
    iconSet: 'tabler icons', code: "\ueec3"
  },
  
  "ti-presentation-off" : {
    iconSet: 'tabler icons', code: "\uf183"
  },
  
  "ti-printer" : {
    iconSet: 'tabler icons', code: "\ueb0e"
  },
  
  "ti-printer-off" : {
    iconSet: 'tabler icons', code: "\uf184"
  },
  
  "ti-prison" : {
    iconSet: 'tabler icons', code: "\uef79"
  },
  
  "ti-progress" : {
    iconSet: 'tabler icons', code: "\ufa0d"
  },
  
  "ti-progress-alert" : {
    iconSet: 'tabler icons', code: "\ufa07"
  },
  
  "ti-progress-bolt" : {
    iconSet: 'tabler icons', code: "\ufa08"
  },
  
  "ti-progress-check" : {
    iconSet: 'tabler icons', code: "\ufa09"
  },
  
  "ti-progress-down" : {
    iconSet: 'tabler icons', code: "\ufa0a"
  },
  
  "ti-progress-help" : {
    iconSet: 'tabler icons', code: "\ufa0b"
  },
  
  "ti-progress-x" : {
    iconSet: 'tabler icons', code: "\ufa0c"
  },
  
  "ti-prompt" : {
    iconSet: 'tabler icons', code: "\ueb0f"
  },
  
  "ti-propeller" : {
    iconSet: 'tabler icons', code: "\ueec4"
  },
  
  "ti-propeller-off" : {
    iconSet: 'tabler icons', code: "\uf185"
  },
  
  "ti-pumpkin-scary" : {
    iconSet: 'tabler icons', code: "\uf587"
  },
  
  "ti-puzzle" : {
    iconSet: 'tabler icons', code: "\ueb10"
  },
  
  "ti-puzzle-2" : {
    iconSet: 'tabler icons', code: "\uef83"
  },
  
  "ti-puzzle-filled" : {
    iconSet: 'tabler icons', code: "\uf699"
  },
  
  "ti-puzzle-off" : {
    iconSet: 'tabler icons', code: "\uf186"
  },
  
  "ti-pyramid" : {
    iconSet: 'tabler icons', code: "\ueec5"
  },
  
  "ti-pyramid-off" : {
    iconSet: 'tabler icons', code: "\uf187"
  },
  
  "ti-qrcode" : {
    iconSet: 'tabler icons', code: "\ueb11"
  },
  
  "ti-qrcode-off" : {
    iconSet: 'tabler icons', code: "\uf41e"
  },
  
  "ti-question-mark" : {
    iconSet: 'tabler icons', code: "\uec9d"
  },
  
  "ti-quote" : {
    iconSet: 'tabler icons', code: "\uefbe"
  },
  
  "ti-quote-off" : {
    iconSet: 'tabler icons', code: "\uf188"
  },
  
  "ti-radar" : {
    iconSet: 'tabler icons', code: "\uf017"
  },
  
  "ti-radar-2" : {
    iconSet: 'tabler icons', code: "\uf016"
  },
  
  "ti-radar-off" : {
    iconSet: 'tabler icons', code: "\uf41f"
  },
  
  "ti-radio" : {
    iconSet: 'tabler icons', code: "\uef2d"
  },
  
  "ti-radio-off" : {
    iconSet: 'tabler icons', code: "\uf420"
  },
  
  "ti-radioactive" : {
    iconSet: 'tabler icons', code: "\uecc0"
  },
  
  "ti-radioactive-filled" : {
    iconSet: 'tabler icons', code: "\uf760"
  },
  
  "ti-radioactive-off" : {
    iconSet: 'tabler icons', code: "\uf189"
  },
  
  "ti-radius-bottom-left" : {
    iconSet: 'tabler icons', code: "\ueec6"
  },
  
  "ti-radius-bottom-right" : {
    iconSet: 'tabler icons', code: "\ueec7"
  },
  
  "ti-radius-top-left" : {
    iconSet: 'tabler icons', code: "\ueec8"
  },
  
  "ti-radius-top-right" : {
    iconSet: 'tabler icons', code: "\ueec9"
  },
  
  "ti-rainbow" : {
    iconSet: 'tabler icons', code: "\uedbc"
  },
  
  "ti-rainbow-off" : {
    iconSet: 'tabler icons', code: "\uf18a"
  },
  
  "ti-rating-12-plus" : {
    iconSet: 'tabler icons', code: "\uf266"
  },
  
  "ti-rating-14-plus" : {
    iconSet: 'tabler icons', code: "\uf267"
  },
  
  "ti-rating-16-plus" : {
    iconSet: 'tabler icons', code: "\uf268"
  },
  
  "ti-rating-18-plus" : {
    iconSet: 'tabler icons', code: "\uf269"
  },
  
  "ti-rating-21-plus" : {
    iconSet: 'tabler icons', code: "\uf26a"
  },
  
  "ti-razor" : {
    iconSet: 'tabler icons', code: "\uf4b5"
  },
  
  "ti-razor-electric" : {
    iconSet: 'tabler icons', code: "\uf4b4"
  },
  
  "ti-receipt" : {
    iconSet: 'tabler icons', code: "\uedfd"
  },
  
  "ti-receipt-2" : {
    iconSet: 'tabler icons', code: "\uedfa"
  },
  
  "ti-receipt-off" : {
    iconSet: 'tabler icons', code: "\uedfb"
  },
  
  "ti-receipt-refund" : {
    iconSet: 'tabler icons', code: "\uedfc"
  },
  
  "ti-receipt-tax" : {
    iconSet: 'tabler icons', code: "\uedbd"
  },
  
  "ti-recharging" : {
    iconSet: 'tabler icons', code: "\ueeca"
  },
  
  "ti-record-mail" : {
    iconSet: 'tabler icons', code: "\ueb12"
  },
  
  "ti-record-mail-off" : {
    iconSet: 'tabler icons', code: "\uf18b"
  },
  
  "ti-rectangle" : {
    iconSet: 'tabler icons', code: "\ued37"
  },
  
  "ti-rectangle-filled" : {
    iconSet: 'tabler icons', code: "\uf69a"
  },
  
  "ti-rectangle-vertical" : {
    iconSet: 'tabler icons', code: "\ued36"
  },
  
  "ti-rectangle-vertical-filled" : {
    iconSet: 'tabler icons', code: "\uf69b"
  },
  
  "ti-recycle" : {
    iconSet: 'tabler icons', code: "\ueb9b"
  },
  
  "ti-recycle-off" : {
    iconSet: 'tabler icons', code: "\uf18c"
  },
  
  "ti-refresh" : {
    iconSet: 'tabler icons', code: "\ueb13"
  },
  
  "ti-refresh-alert" : {
    iconSet: 'tabler icons', code: "\ued57"
  },
  
  "ti-refresh-dot" : {
    iconSet: 'tabler icons', code: "\uefbf"
  },
  
  "ti-refresh-off" : {
    iconSet: 'tabler icons', code: "\uf18d"
  },
  
  "ti-regex" : {
    iconSet: 'tabler icons', code: "\uf31f"
  },
  
  "ti-regex-off" : {
    iconSet: 'tabler icons', code: "\uf421"
  },
  
  "ti-registered" : {
    iconSet: 'tabler icons', code: "\ueb14"
  },
  
  "ti-relation-many-to-many" : {
    iconSet: 'tabler icons', code: "\ued7f"
  },
  
  "ti-relation-one-to-many" : {
    iconSet: 'tabler icons', code: "\ued80"
  },
  
  "ti-relation-one-to-one" : {
    iconSet: 'tabler icons', code: "\ued81"
  },
  
  "ti-reload" : {
    iconSet: 'tabler icons', code: "\uf3ae"
  },
  
  "ti-repeat" : {
    iconSet: 'tabler icons', code: "\ueb72"
  },
  
  "ti-repeat-off" : {
    iconSet: 'tabler icons', code: "\uf18e"
  },
  
  "ti-repeat-once" : {
    iconSet: 'tabler icons', code: "\ueb71"
  },
  
  "ti-replace" : {
    iconSet: 'tabler icons', code: "\uebc7"
  },
  
  "ti-replace-filled" : {
    iconSet: 'tabler icons', code: "\uf69c"
  },
  
  "ti-replace-off" : {
    iconSet: 'tabler icons', code: "\uf422"
  },
  
  "ti-report" : {
    iconSet: 'tabler icons', code: "\ueece"
  },
  
  "ti-report-analytics" : {
    iconSet: 'tabler icons', code: "\ueecb"
  },
  
  "ti-report-medical" : {
    iconSet: 'tabler icons', code: "\ueecc"
  },
  
  "ti-report-money" : {
    iconSet: 'tabler icons', code: "\ueecd"
  },
  
  "ti-report-off" : {
    iconSet: 'tabler icons', code: "\uf18f"
  },
  
  "ti-report-search" : {
    iconSet: 'tabler icons', code: "\uef84"
  },
  
  "ti-reserved-line" : {
    iconSet: 'tabler icons', code: "\uf9f6"
  },
  
  "ti-resize" : {
    iconSet: 'tabler icons', code: "\ueecf"
  },
  
  "ti-ribbon-health" : {
    iconSet: 'tabler icons', code: "\uf58e"
  },
  
  "ti-ripple" : {
    iconSet: 'tabler icons', code: "\ued82"
  },
  
  "ti-ripple-off" : {
    iconSet: 'tabler icons', code: "\uf190"
  },
  
  "ti-road" : {
    iconSet: 'tabler icons', code: "\uf018"
  },
  
  "ti-road-off" : {
    iconSet: 'tabler icons', code: "\uf191"
  },
  
  "ti-road-sign" : {
    iconSet: 'tabler icons', code: "\uecdd"
  },
  
  "ti-robot" : {
    iconSet: 'tabler icons', code: "\uf00b"
  },
  
  "ti-robot-off" : {
    iconSet: 'tabler icons', code: "\uf192"
  },
  
  "ti-rocket" : {
    iconSet: 'tabler icons', code: "\uec45"
  },
  
  "ti-rocket-off" : {
    iconSet: 'tabler icons', code: "\uf193"
  },
  
  "ti-roller-skating" : {
    iconSet: 'tabler icons', code: "\uefd1"
  },
  
  "ti-rollercoaster" : {
    iconSet: 'tabler icons', code: "\uf0a2"
  },
  
  "ti-rollercoaster-off" : {
    iconSet: 'tabler icons', code: "\uf423"
  },
  
  "ti-rosette" : {
    iconSet: 'tabler icons', code: "\uf599"
  },
  
  "ti-rosette-filled" : {
    iconSet: 'tabler icons', code: "\uf69d"
  },
  
  "ti-rosette-number-0" : {
    iconSet: 'tabler icons', code: "\uf58f"
  },
  
  "ti-rosette-number-1" : {
    iconSet: 'tabler icons', code: "\uf590"
  },
  
  "ti-rosette-number-2" : {
    iconSet: 'tabler icons', code: "\uf591"
  },
  
  "ti-rosette-number-3" : {
    iconSet: 'tabler icons', code: "\uf592"
  },
  
  "ti-rosette-number-4" : {
    iconSet: 'tabler icons', code: "\uf593"
  },
  
  "ti-rosette-number-5" : {
    iconSet: 'tabler icons', code: "\uf594"
  },
  
  "ti-rosette-number-6" : {
    iconSet: 'tabler icons', code: "\uf595"
  },
  
  "ti-rosette-number-7" : {
    iconSet: 'tabler icons', code: "\uf596"
  },
  
  "ti-rosette-number-8" : {
    iconSet: 'tabler icons', code: "\uf597"
  },
  
  "ti-rosette-number-9" : {
    iconSet: 'tabler icons', code: "\uf598"
  },
  
  "ti-rotate" : {
    iconSet: 'tabler icons', code: "\ueb16"
  },
  
  "ti-rotate-2" : {
    iconSet: 'tabler icons', code: "\uebb4"
  },
  
  "ti-rotate-360" : {
    iconSet: 'tabler icons', code: "\uef85"
  },
  
  "ti-rotate-clockwise" : {
    iconSet: 'tabler icons', code: "\ueb15"
  },
  
  "ti-rotate-clockwise-2" : {
    iconSet: 'tabler icons', code: "\uebb5"
  },
  
  "ti-rotate-dot" : {
    iconSet: 'tabler icons', code: "\uefe5"
  },
  
  "ti-rotate-rectangle" : {
    iconSet: 'tabler icons', code: "\uec15"
  },
  
  "ti-route" : {
    iconSet: 'tabler icons', code: "\ueb17"
  },
  
  "ti-route-2" : {
    iconSet: 'tabler icons', code: "\uf4b6"
  },
  
  "ti-route-off" : {
    iconSet: 'tabler icons', code: "\uf194"
  },
  
  "ti-router" : {
    iconSet: 'tabler icons', code: "\ueb18"
  },
  
  "ti-router-off" : {
    iconSet: 'tabler icons', code: "\uf424"
  },
  
  "ti-row-insert-bottom" : {
    iconSet: 'tabler icons', code: "\ueed0"
  },
  
  "ti-row-insert-top" : {
    iconSet: 'tabler icons', code: "\ueed1"
  },
  
  "ti-rss" : {
    iconSet: 'tabler icons', code: "\ueb19"
  },
  
  "ti-rubber-stamp" : {
    iconSet: 'tabler icons', code: "\uf5ab"
  },
  
  "ti-rubber-stamp-off" : {
    iconSet: 'tabler icons', code: "\uf5aa"
  },
  
  "ti-ruler" : {
    iconSet: 'tabler icons', code: "\ueb1a"
  },
  
  "ti-ruler-2" : {
    iconSet: 'tabler icons', code: "\ueed2"
  },
  
  "ti-ruler-2-off" : {
    iconSet: 'tabler icons', code: "\uf195"
  },
  
  "ti-ruler-3" : {
    iconSet: 'tabler icons', code: "\uf290"
  },
  
  "ti-ruler-measure" : {
    iconSet: 'tabler icons', code: "\uf291"
  },
  
  "ti-ruler-off" : {
    iconSet: 'tabler icons', code: "\uf196"
  },
  
  "ti-run" : {
    iconSet: 'tabler icons', code: "\uec82"
  },
  
  "ti-s-turn-down" : {
    iconSet: 'tabler icons', code: "\uf516"
  },
  
  "ti-s-turn-left" : {
    iconSet: 'tabler icons', code: "\uf517"
  },
  
  "ti-s-turn-right" : {
    iconSet: 'tabler icons', code: "\uf518"
  },
  
  "ti-s-turn-up" : {
    iconSet: 'tabler icons', code: "\uf519"
  },
  
  "ti-sailboat" : {
    iconSet: 'tabler icons', code: "\uec83"
  },
  
  "ti-sailboat-2" : {
    iconSet: 'tabler icons', code: "\uf5f7"
  },
  
  "ti-sailboat-off" : {
    iconSet: 'tabler icons', code: "\uf425"
  },
  
  "ti-salad" : {
    iconSet: 'tabler icons', code: "\uf50a"
  },
  
  "ti-salt" : {
    iconSet: 'tabler icons', code: "\uef16"
  },
  
  "ti-satellite" : {
    iconSet: 'tabler icons', code: "\ueed3"
  },
  
  "ti-satellite-off" : {
    iconSet: 'tabler icons', code: "\uf197"
  },
  
  "ti-sausage" : {
    iconSet: 'tabler icons', code: "\uef17"
  },
  
  "ti-scale" : {
    iconSet: 'tabler icons', code: "\uebc2"
  },
  
  "ti-scale-off" : {
    iconSet: 'tabler icons', code: "\uf198"
  },
  
  "ti-scale-outline" : {
    iconSet: 'tabler icons', code: "\uef53"
  },
  
  "ti-scale-outline-off" : {
    iconSet: 'tabler icons', code: "\uf199"
  },
  
  "ti-scan" : {
    iconSet: 'tabler icons', code: "\uebc8"
  },
  
  "ti-scan-eye" : {
    iconSet: 'tabler icons', code: "\uf1ff"
  },
  
  "ti-schema" : {
    iconSet: 'tabler icons', code: "\uf200"
  },
  
  "ti-schema-off" : {
    iconSet: 'tabler icons', code: "\uf426"
  },
  
  "ti-school" : {
    iconSet: 'tabler icons', code: "\uecf7"
  },
  
  "ti-school-bell" : {
    iconSet: 'tabler icons', code: "\uf64a"
  },
  
  "ti-school-off" : {
    iconSet: 'tabler icons', code: "\uf19a"
  },
  
  "ti-scissors" : {
    iconSet: 'tabler icons', code: "\ueb1b"
  },
  
  "ti-scissors-off" : {
    iconSet: 'tabler icons', code: "\uf19b"
  },
  
  "ti-scooter" : {
    iconSet: 'tabler icons', code: "\uec6c"
  },
  
  "ti-scooter-electric" : {
    iconSet: 'tabler icons', code: "\uecc1"
  },
  
  "ti-screen-share" : {
    iconSet: 'tabler icons', code: "\ued18"
  },
  
  "ti-screen-share-off" : {
    iconSet: 'tabler icons', code: "\ued17"
  },
  
  "ti-screenshot" : {
    iconSet: 'tabler icons', code: "\uf201"
  },
  
  "ti-scribble" : {
    iconSet: 'tabler icons', code: "\uf0a3"
  },
  
  "ti-scribble-off" : {
    iconSet: 'tabler icons', code: "\uf427"
  },
  
  "ti-script" : {
    iconSet: 'tabler icons', code: "\uf2da"
  },
  
  "ti-script-minus" : {
    iconSet: 'tabler icons', code: "\uf2d7"
  },
  
  "ti-script-plus" : {
    iconSet: 'tabler icons', code: "\uf2d8"
  },
  
  "ti-script-x" : {
    iconSet: 'tabler icons', code: "\uf2d9"
  },
  
  "ti-scuba-mask" : {
    iconSet: 'tabler icons', code: "\ueed4"
  },
  
  "ti-scuba-mask-off" : {
    iconSet: 'tabler icons', code: "\uf428"
  },
  
  "ti-sdk" : {
    iconSet: 'tabler icons', code: "\uf3af"
  },
  
  "ti-search" : {
    iconSet: 'tabler icons', code: "\ueb1c"
  },
  
  "ti-search-off" : {
    iconSet: 'tabler icons', code: "\uf19c"
  },
  
  "ti-section" : {
    iconSet: 'tabler icons', code: "\ueed5"
  },
  
  "ti-section-sign" : {
    iconSet: 'tabler icons', code: "\uf019"
  },
  
  "ti-seeding" : {
    iconSet: 'tabler icons', code: "\ued51"
  },
  
  "ti-seeding-off" : {
    iconSet: 'tabler icons', code: "\uf19d"
  },
  
  "ti-select" : {
    iconSet: 'tabler icons', code: "\uec9e"
  },
  
  "ti-select-all" : {
    iconSet: 'tabler icons', code: "\uf9f7"
  },
  
  "ti-selector" : {
    iconSet: 'tabler icons', code: "\ueb1d"
  },
  
  "ti-send" : {
    iconSet: 'tabler icons', code: "\ueb1e"
  },
  
  "ti-send-off" : {
    iconSet: 'tabler icons', code: "\uf429"
  },
  
  "ti-seo" : {
    iconSet: 'tabler icons', code: "\uf26b"
  },
  
  "ti-separator" : {
    iconSet: 'tabler icons', code: "\uebda"
  },
  
  "ti-separator-horizontal" : {
    iconSet: 'tabler icons', code: "\uec79"
  },
  
  "ti-separator-vertical" : {
    iconSet: 'tabler icons', code: "\uec7a"
  },
  
  "ti-server" : {
    iconSet: 'tabler icons', code: "\ueb1f"
  },
  
  "ti-server-2" : {
    iconSet: 'tabler icons', code: "\uf07c"
  },
  
  "ti-server-bolt" : {
    iconSet: 'tabler icons', code: "\uf320"
  },
  
  "ti-server-cog" : {
    iconSet: 'tabler icons', code: "\uf321"
  },
  
  "ti-server-off" : {
    iconSet: 'tabler icons', code: "\uf19e"
  },
  
  "ti-servicemark" : {
    iconSet: 'tabler icons', code: "\uec09"
  },
  
  "ti-settings" : {
    iconSet: 'tabler icons', code: "\ueb20"
  },
  
  "ti-settings-2" : {
    iconSet: 'tabler icons', code: "\uf5ac"
  },
  
  "ti-settings-automation" : {
    iconSet: 'tabler icons', code: "\ueed6"
  },
  
  "ti-settings-bolt" : {
    iconSet: 'tabler icons', code: "\uf9ad"
  },
  
  "ti-settings-cancel" : {
    iconSet: 'tabler icons', code: "\uf9ae"
  },
  
  "ti-settings-check" : {
    iconSet: 'tabler icons', code: "\uf9af"
  },
  
  "ti-settings-code" : {
    iconSet: 'tabler icons', code: "\uf9b0"
  },
  
  "ti-settings-cog" : {
    iconSet: 'tabler icons', code: "\uf9b1"
  },
  
  "ti-settings-dollar" : {
    iconSet: 'tabler icons', code: "\uf9b2"
  },
  
  "ti-settings-down" : {
    iconSet: 'tabler icons', code: "\uf9b3"
  },
  
  "ti-settings-exclamation" : {
    iconSet: 'tabler icons', code: "\uf9b4"
  },
  
  "ti-settings-filled" : {
    iconSet: 'tabler icons', code: "\uf69e"
  },
  
  "ti-settings-heart" : {
    iconSet: 'tabler icons', code: "\uf9b5"
  },
  
  "ti-settings-minus" : {
    iconSet: 'tabler icons', code: "\uf9b6"
  },
  
  "ti-settings-off" : {
    iconSet: 'tabler icons', code: "\uf19f"
  },
  
  "ti-settings-pause" : {
    iconSet: 'tabler icons', code: "\uf9b7"
  },
  
  "ti-settings-pin" : {
    iconSet: 'tabler icons', code: "\uf9b8"
  },
  
  "ti-settings-plus" : {
    iconSet: 'tabler icons', code: "\uf9b9"
  },
  
  "ti-settings-question" : {
    iconSet: 'tabler icons', code: "\uf9ba"
  },
  
  "ti-settings-search" : {
    iconSet: 'tabler icons', code: "\uf9bb"
  },
  
  "ti-settings-share" : {
    iconSet: 'tabler icons', code: "\uf9bc"
  },
  
  "ti-settings-star" : {
    iconSet: 'tabler icons', code: "\uf9bd"
  },
  
  "ti-settings-up" : {
    iconSet: 'tabler icons', code: "\uf9be"
  },
  
  "ti-settings-x" : {
    iconSet: 'tabler icons', code: "\uf9bf"
  },
  
  "ti-shadow" : {
    iconSet: 'tabler icons', code: "\ueed8"
  },
  
  "ti-shadow-off" : {
    iconSet: 'tabler icons', code: "\ueed7"
  },
  
  "ti-shape" : {
    iconSet: 'tabler icons', code: "\ueb9c"
  },
  
  "ti-shape-2" : {
    iconSet: 'tabler icons', code: "\ueed9"
  },
  
  "ti-shape-3" : {
    iconSet: 'tabler icons', code: "\ueeda"
  },
  
  "ti-shape-off" : {
    iconSet: 'tabler icons', code: "\uf1a0"
  },
  
  "ti-share" : {
    iconSet: 'tabler icons', code: "\ueb21"
  },
  
  "ti-share-2" : {
    iconSet: 'tabler icons', code: "\uf799"
  },
  
  "ti-share-3" : {
    iconSet: 'tabler icons', code: "\uf7bd"
  },
  
  "ti-share-off" : {
    iconSet: 'tabler icons', code: "\uf1a1"
  },
  
  "ti-shield" : {
    iconSet: 'tabler icons', code: "\ueb24"
  },
  
  "ti-shield-bolt" : {
    iconSet: 'tabler icons', code: "\uf9c0"
  },
  
  "ti-shield-cancel" : {
    iconSet: 'tabler icons', code: "\uf9c1"
  },
  
  "ti-shield-check" : {
    iconSet: 'tabler icons', code: "\ueb22"
  },
  
  "ti-shield-check-filled" : {
    iconSet: 'tabler icons', code: "\uf761"
  },
  
  "ti-shield-checkered" : {
    iconSet: 'tabler icons', code: "\uef9a"
  },
  
  "ti-shield-checkered-filled" : {
    iconSet: 'tabler icons', code: "\uf762"
  },
  
  "ti-shield-chevron" : {
    iconSet: 'tabler icons', code: "\uef9b"
  },
  
  "ti-shield-code" : {
    iconSet: 'tabler icons', code: "\uf9c2"
  },
  
  "ti-shield-cog" : {
    iconSet: 'tabler icons', code: "\uf9c3"
  },
  
  "ti-shield-dollar" : {
    iconSet: 'tabler icons', code: "\uf9c4"
  },
  
  "ti-shield-down" : {
    iconSet: 'tabler icons', code: "\uf9c5"
  },
  
  "ti-shield-exclamation" : {
    iconSet: 'tabler icons', code: "\uf9c6"
  },
  
  "ti-shield-filled" : {
    iconSet: 'tabler icons', code: "\uf69f"
  },
  
  "ti-shield-half" : {
    iconSet: 'tabler icons', code: "\uf358"
  },
  
  "ti-shield-half-filled" : {
    iconSet: 'tabler icons', code: "\uf357"
  },
  
  "ti-shield-heart" : {
    iconSet: 'tabler icons', code: "\uf9c7"
  },
  
  "ti-shield-lock" : {
    iconSet: 'tabler icons', code: "\ued58"
  },
  
  "ti-shield-lock-filled" : {
    iconSet: 'tabler icons', code: "\uf763"
  },
  
  "ti-shield-minus" : {
    iconSet: 'tabler icons', code: "\uf9c8"
  },
  
  "ti-shield-off" : {
    iconSet: 'tabler icons', code: "\uecf8"
  },
  
  "ti-shield-pause" : {
    iconSet: 'tabler icons', code: "\uf9c9"
  },
  
  "ti-shield-pin" : {
    iconSet: 'tabler icons', code: "\uf9ca"
  },
  
  "ti-shield-plus" : {
    iconSet: 'tabler icons', code: "\uf9cb"
  },
  
  "ti-shield-question" : {
    iconSet: 'tabler icons', code: "\uf9cc"
  },
  
  "ti-shield-search" : {
    iconSet: 'tabler icons', code: "\uf9cd"
  },
  
  "ti-shield-share" : {
    iconSet: 'tabler icons', code: "\uf9ce"
  },
  
  "ti-shield-star" : {
    iconSet: 'tabler icons', code: "\uf9cf"
  },
  
  "ti-shield-up" : {
    iconSet: 'tabler icons', code: "\uf9d0"
  },
  
  "ti-shield-x" : {
    iconSet: 'tabler icons', code: "\ueb23"
  },
  
  "ti-ship" : {
    iconSet: 'tabler icons', code: "\uec84"
  },
  
  "ti-ship-off" : {
    iconSet: 'tabler icons', code: "\uf42a"
  },
  
  "ti-shirt" : {
    iconSet: 'tabler icons', code: "\uec0a"
  },
  
  "ti-shirt-filled" : {
    iconSet: 'tabler icons', code: "\uf6a0"
  },
  
  "ti-shirt-off" : {
    iconSet: 'tabler icons', code: "\uf1a2"
  },
  
  "ti-shirt-sport" : {
    iconSet: 'tabler icons', code: "\uf26c"
  },
  
  "ti-shoe" : {
    iconSet: 'tabler icons', code: "\uefd2"
  },
  
  "ti-shoe-off" : {
    iconSet: 'tabler icons', code: "\uf1a4"
  },
  
  "ti-shopping-bag" : {
    iconSet: 'tabler icons', code: "\uf5f8"
  },
  
  "ti-shopping-cart" : {
    iconSet: 'tabler icons', code: "\ueb25"
  },
  
  "ti-shopping-cart-discount" : {
    iconSet: 'tabler icons', code: "\ueedb"
  },
  
  "ti-shopping-cart-off" : {
    iconSet: 'tabler icons', code: "\ueedc"
  },
  
  "ti-shopping-cart-plus" : {
    iconSet: 'tabler icons', code: "\ueedd"
  },
  
  "ti-shopping-cart-x" : {
    iconSet: 'tabler icons', code: "\ueede"
  },
  
  "ti-shovel" : {
    iconSet: 'tabler icons', code: "\uf1d9"
  },
  
  "ti-shredder" : {
    iconSet: 'tabler icons', code: "\ueedf"
  },
  
  "ti-sign-left" : {
    iconSet: 'tabler icons', code: "\uf06b"
  },
  
  "ti-sign-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6a1"
  },
  
  "ti-sign-right" : {
    iconSet: 'tabler icons', code: "\uf06c"
  },
  
  "ti-sign-right-filled" : {
    iconSet: 'tabler icons', code: "\uf6a2"
  },
  
  "ti-signal-2g" : {
    iconSet: 'tabler icons', code: "\uf79a"
  },
  
  "ti-signal-3g" : {
    iconSet: 'tabler icons', code: "\uf1ee"
  },
  
  "ti-signal-4g" : {
    iconSet: 'tabler icons', code: "\uf1ef"
  },
  
  "ti-signal-4g-plus" : {
    iconSet: 'tabler icons', code: "\uf259"
  },
  
  "ti-signal-5g" : {
    iconSet: 'tabler icons', code: "\uf1f0"
  },
  
  "ti-signal-6g" : {
    iconSet: 'tabler icons', code: "\uf9f8"
  },
  
  "ti-signal-e" : {
    iconSet: 'tabler icons', code: "\uf9f9"
  },
  
  "ti-signal-g" : {
    iconSet: 'tabler icons', code: "\uf9fa"
  },
  
  "ti-signal-h" : {
    iconSet: 'tabler icons', code: "\uf9fc"
  },
  
  "ti-signal-h-plus" : {
    iconSet: 'tabler icons', code: "\uf9fb"
  },
  
  "ti-signal-lte" : {
    iconSet: 'tabler icons', code: "\uf9fd"
  },
  
  "ti-signature" : {
    iconSet: 'tabler icons', code: "\ueee0"
  },
  
  "ti-signature-off" : {
    iconSet: 'tabler icons', code: "\uf1a5"
  },
  
  "ti-sitemap" : {
    iconSet: 'tabler icons', code: "\ueb9d"
  },
  
  "ti-sitemap-off" : {
    iconSet: 'tabler icons', code: "\uf1a6"
  },
  
  "ti-skateboard" : {
    iconSet: 'tabler icons', code: "\uecc2"
  },
  
  "ti-skateboard-off" : {
    iconSet: 'tabler icons', code: "\uf42b"
  },
  
  "ti-skull" : {
    iconSet: 'tabler icons', code: "\uf292"
  },
  
  "ti-slash" : {
    iconSet: 'tabler icons', code: "\uf4f9"
  },
  
  "ti-slashes" : {
    iconSet: 'tabler icons', code: "\uf588"
  },
  
  "ti-sleigh" : {
    iconSet: 'tabler icons', code: "\uef9c"
  },
  
  "ti-slice" : {
    iconSet: 'tabler icons', code: "\uebdb"
  },
  
  "ti-slideshow" : {
    iconSet: 'tabler icons', code: "\uebc9"
  },
  
  "ti-smart-home" : {
    iconSet: 'tabler icons', code: "\uecde"
  },
  
  "ti-smart-home-off" : {
    iconSet: 'tabler icons', code: "\uf1a7"
  },
  
  "ti-smoking" : {
    iconSet: 'tabler icons', code: "\uecc4"
  },
  
  "ti-smoking-no" : {
    iconSet: 'tabler icons', code: "\uecc3"
  },
  
  "ti-snowflake" : {
    iconSet: 'tabler icons', code: "\uec0b"
  },
  
  "ti-snowflake-off" : {
    iconSet: 'tabler icons', code: "\uf1a8"
  },
  
  "ti-snowman" : {
    iconSet: 'tabler icons', code: "\uf26d"
  },
  
  "ti-soccer-field" : {
    iconSet: 'tabler icons', code: "\ued92"
  },
  
  "ti-social" : {
    iconSet: 'tabler icons', code: "\uebec"
  },
  
  "ti-social-off" : {
    iconSet: 'tabler icons', code: "\uf1a9"
  },
  
  "ti-sock" : {
    iconSet: 'tabler icons', code: "\ueee1"
  },
  
  "ti-sofa" : {
    iconSet: 'tabler icons', code: "\uefaf"
  },
  
  "ti-sofa-off" : {
    iconSet: 'tabler icons', code: "\uf42c"
  },
  
  "ti-solar-panel" : {
    iconSet: 'tabler icons', code: "\uf7bf"
  },
  
  "ti-solar-panel-2" : {
    iconSet: 'tabler icons', code: "\uf7be"
  },
  
  "ti-sort-0-9" : {
    iconSet: 'tabler icons', code: "\uf54d"
  },
  
  "ti-sort-9-0" : {
    iconSet: 'tabler icons', code: "\uf54e"
  },
  
  "ti-sort-a-z" : {
    iconSet: 'tabler icons', code: "\uf54f"
  },
  
  "ti-sort-ascending" : {
    iconSet: 'tabler icons', code: "\ueb26"
  },
  
  "ti-sort-ascending-2" : {
    iconSet: 'tabler icons', code: "\ueee2"
  },
  
  "ti-sort-ascending-letters" : {
    iconSet: 'tabler icons', code: "\uef18"
  },
  
  "ti-sort-ascending-numbers" : {
    iconSet: 'tabler icons', code: "\uef19"
  },
  
  "ti-sort-descending" : {
    iconSet: 'tabler icons', code: "\ueb27"
  },
  
  "ti-sort-descending-2" : {
    iconSet: 'tabler icons', code: "\ueee3"
  },
  
  "ti-sort-descending-letters" : {
    iconSet: 'tabler icons', code: "\uef1a"
  },
  
  "ti-sort-descending-numbers" : {
    iconSet: 'tabler icons', code: "\uef1b"
  },
  
  "ti-sort-z-a" : {
    iconSet: 'tabler icons', code: "\uf550"
  },
  
  "ti-sos" : {
    iconSet: 'tabler icons', code: "\uf24a"
  },
  
  "ti-soup" : {
    iconSet: 'tabler icons', code: "\uef2e"
  },
  
  "ti-soup-off" : {
    iconSet: 'tabler icons', code: "\uf42d"
  },
  
  "ti-source-code" : {
    iconSet: 'tabler icons', code: "\uf4a2"
  },
  
  "ti-space" : {
    iconSet: 'tabler icons', code: "\uec0c"
  },
  
  "ti-space-off" : {
    iconSet: 'tabler icons', code: "\uf1aa"
  },
  
  "ti-spacing-horizontal" : {
    iconSet: 'tabler icons', code: "\uef54"
  },
  
  "ti-spacing-vertical" : {
    iconSet: 'tabler icons', code: "\uef55"
  },
  
  "ti-spade" : {
    iconSet: 'tabler icons', code: "\ueffa"
  },
  
  "ti-spade-filled" : {
    iconSet: 'tabler icons', code: "\uf6a3"
  },
  
  "ti-sparkles" : {
    iconSet: 'tabler icons', code: "\uf6d7"
  },
  
  "ti-speakerphone" : {
    iconSet: 'tabler icons', code: "\ued61"
  },
  
  "ti-speedboat" : {
    iconSet: 'tabler icons', code: "\ued93"
  },
  
  "ti-spider" : {
    iconSet: 'tabler icons', code: "\uf293"
  },
  
  "ti-spiral" : {
    iconSet: 'tabler icons', code: "\uf294"
  },
  
  "ti-spiral-off" : {
    iconSet: 'tabler icons', code: "\uf42e"
  },
  
  "ti-sport-billard" : {
    iconSet: 'tabler icons', code: "\ueee4"
  },
  
  "ti-spray" : {
    iconSet: 'tabler icons', code: "\uf50b"
  },
  
  "ti-spy" : {
    iconSet: 'tabler icons', code: "\uf227"
  },
  
  "ti-spy-off" : {
    iconSet: 'tabler icons', code: "\uf42f"
  },
  
  "ti-sql" : {
    iconSet: 'tabler icons', code: "\uf7c0"
  },
  
  "ti-square" : {
    iconSet: 'tabler icons', code: "\ueb2c"
  },
  
  "ti-square-0-filled" : {
    iconSet: 'tabler icons', code: "\uf764"
  },
  
  "ti-square-1-filled" : {
    iconSet: 'tabler icons', code: "\uf765"
  },
  
  "ti-square-2-filled" : {
    iconSet: 'tabler icons', code: "\uf7fa"
  },
  
  "ti-square-3-filled" : {
    iconSet: 'tabler icons', code: "\uf766"
  },
  
  "ti-square-4-filled" : {
    iconSet: 'tabler icons', code: "\uf767"
  },
  
  "ti-square-5-filled" : {
    iconSet: 'tabler icons', code: "\uf768"
  },
  
  "ti-square-6-filled" : {
    iconSet: 'tabler icons', code: "\uf769"
  },
  
  "ti-square-7-filled" : {
    iconSet: 'tabler icons', code: "\uf76a"
  },
  
  "ti-square-8-filled" : {
    iconSet: 'tabler icons', code: "\uf76b"
  },
  
  "ti-square-9-filled" : {
    iconSet: 'tabler icons', code: "\uf76c"
  },
  
  "ti-square-arrow-down" : {
    iconSet: 'tabler icons', code: "\uf4b7"
  },
  
  "ti-square-arrow-left" : {
    iconSet: 'tabler icons', code: "\uf4b8"
  },
  
  "ti-square-arrow-right" : {
    iconSet: 'tabler icons', code: "\uf4b9"
  },
  
  "ti-square-arrow-up" : {
    iconSet: 'tabler icons', code: "\uf4ba"
  },
  
  "ti-square-asterisk" : {
    iconSet: 'tabler icons', code: "\uf01a"
  },
  
  "ti-square-check" : {
    iconSet: 'tabler icons', code: "\ueb28"
  },
  
  "ti-square-check-filled" : {
    iconSet: 'tabler icons', code: "\uf76d"
  },
  
  "ti-square-chevron-down" : {
    iconSet: 'tabler icons', code: "\uf627"
  },
  
  "ti-square-chevron-left" : {
    iconSet: 'tabler icons', code: "\uf628"
  },
  
  "ti-square-chevron-right" : {
    iconSet: 'tabler icons', code: "\uf629"
  },
  
  "ti-square-chevron-up" : {
    iconSet: 'tabler icons', code: "\uf62a"
  },
  
  "ti-square-chevrons-down" : {
    iconSet: 'tabler icons', code: "\uf64b"
  },
  
  "ti-square-chevrons-left" : {
    iconSet: 'tabler icons', code: "\uf64c"
  },
  
  "ti-square-chevrons-right" : {
    iconSet: 'tabler icons', code: "\uf64d"
  },
  
  "ti-square-chevrons-up" : {
    iconSet: 'tabler icons', code: "\uf64e"
  },
  
  "ti-square-dot" : {
    iconSet: 'tabler icons', code: "\ued59"
  },
  
  "ti-square-f0" : {
    iconSet: 'tabler icons', code: "\uf526"
  },
  
  "ti-square-f0-filled" : {
    iconSet: 'tabler icons', code: "\uf76e"
  },
  
  "ti-square-f1" : {
    iconSet: 'tabler icons', code: "\uf527"
  },
  
  "ti-square-f1-filled" : {
    iconSet: 'tabler icons', code: "\uf76f"
  },
  
  "ti-square-f2" : {
    iconSet: 'tabler icons', code: "\uf528"
  },
  
  "ti-square-f2-filled" : {
    iconSet: 'tabler icons', code: "\uf770"
  },
  
  "ti-square-f3" : {
    iconSet: 'tabler icons', code: "\uf529"
  },
  
  "ti-square-f3-filled" : {
    iconSet: 'tabler icons', code: "\uf771"
  },
  
  "ti-square-f4" : {
    iconSet: 'tabler icons', code: "\uf52a"
  },
  
  "ti-square-f4-filled" : {
    iconSet: 'tabler icons', code: "\uf772"
  },
  
  "ti-square-f5" : {
    iconSet: 'tabler icons', code: "\uf52b"
  },
  
  "ti-square-f5-filled" : {
    iconSet: 'tabler icons', code: "\uf773"
  },
  
  "ti-square-f6" : {
    iconSet: 'tabler icons', code: "\uf52c"
  },
  
  "ti-square-f6-filled" : {
    iconSet: 'tabler icons', code: "\uf774"
  },
  
  "ti-square-f7" : {
    iconSet: 'tabler icons', code: "\uf52d"
  },
  
  "ti-square-f7-filled" : {
    iconSet: 'tabler icons', code: "\uf775"
  },
  
  "ti-square-f8" : {
    iconSet: 'tabler icons', code: "\uf52e"
  },
  
  "ti-square-f8-filled" : {
    iconSet: 'tabler icons', code: "\uf776"
  },
  
  "ti-square-f9" : {
    iconSet: 'tabler icons', code: "\uf52f"
  },
  
  "ti-square-f9-filled" : {
    iconSet: 'tabler icons', code: "\uf777"
  },
  
  "ti-square-forbid" : {
    iconSet: 'tabler icons', code: "\ued5b"
  },
  
  "ti-square-forbid-2" : {
    iconSet: 'tabler icons', code: "\ued5a"
  },
  
  "ti-square-half" : {
    iconSet: 'tabler icons', code: "\ueffb"
  },
  
  "ti-square-key" : {
    iconSet: 'tabler icons', code: "\uf638"
  },
  
  "ti-square-letter-a" : {
    iconSet: 'tabler icons', code: "\uf47c"
  },
  
  "ti-square-letter-b" : {
    iconSet: 'tabler icons', code: "\uf47d"
  },
  
  "ti-square-letter-c" : {
    iconSet: 'tabler icons', code: "\uf47e"
  },
  
  "ti-square-letter-d" : {
    iconSet: 'tabler icons', code: "\uf47f"
  },
  
  "ti-square-letter-e" : {
    iconSet: 'tabler icons', code: "\uf480"
  },
  
  "ti-square-letter-f" : {
    iconSet: 'tabler icons', code: "\uf481"
  },
  
  "ti-square-letter-g" : {
    iconSet: 'tabler icons', code: "\uf482"
  },
  
  "ti-square-letter-h" : {
    iconSet: 'tabler icons', code: "\uf483"
  },
  
  "ti-square-letter-i" : {
    iconSet: 'tabler icons', code: "\uf484"
  },
  
  "ti-square-letter-j" : {
    iconSet: 'tabler icons', code: "\uf485"
  },
  
  "ti-square-letter-k" : {
    iconSet: 'tabler icons', code: "\uf486"
  },
  
  "ti-square-letter-l" : {
    iconSet: 'tabler icons', code: "\uf487"
  },
  
  "ti-square-letter-m" : {
    iconSet: 'tabler icons', code: "\uf488"
  },
  
  "ti-square-letter-n" : {
    iconSet: 'tabler icons', code: "\uf489"
  },
  
  "ti-square-letter-o" : {
    iconSet: 'tabler icons', code: "\uf48a"
  },
  
  "ti-square-letter-p" : {
    iconSet: 'tabler icons', code: "\uf48b"
  },
  
  "ti-square-letter-q" : {
    iconSet: 'tabler icons', code: "\uf48c"
  },
  
  "ti-square-letter-r" : {
    iconSet: 'tabler icons', code: "\uf48d"
  },
  
  "ti-square-letter-s" : {
    iconSet: 'tabler icons', code: "\uf48e"
  },
  
  "ti-square-letter-t" : {
    iconSet: 'tabler icons', code: "\uf48f"
  },
  
  "ti-square-letter-u" : {
    iconSet: 'tabler icons', code: "\uf490"
  },
  
  "ti-square-letter-v" : {
    iconSet: 'tabler icons', code: "\uf4bb"
  },
  
  "ti-square-letter-w" : {
    iconSet: 'tabler icons', code: "\uf491"
  },
  
  "ti-square-letter-x" : {
    iconSet: 'tabler icons', code: "\uf4bc"
  },
  
  "ti-square-letter-y" : {
    iconSet: 'tabler icons', code: "\uf492"
  },
  
  "ti-square-letter-z" : {
    iconSet: 'tabler icons', code: "\uf493"
  },
  
  "ti-square-minus" : {
    iconSet: 'tabler icons', code: "\ueb29"
  },
  
  "ti-square-number-0" : {
    iconSet: 'tabler icons', code: "\ueee5"
  },
  
  "ti-square-number-1" : {
    iconSet: 'tabler icons', code: "\ueee6"
  },
  
  "ti-square-number-2" : {
    iconSet: 'tabler icons', code: "\ueee7"
  },
  
  "ti-square-number-3" : {
    iconSet: 'tabler icons', code: "\ueee8"
  },
  
  "ti-square-number-4" : {
    iconSet: 'tabler icons', code: "\ueee9"
  },
  
  "ti-square-number-5" : {
    iconSet: 'tabler icons', code: "\ueeea"
  },
  
  "ti-square-number-6" : {
    iconSet: 'tabler icons', code: "\ueeeb"
  },
  
  "ti-square-number-7" : {
    iconSet: 'tabler icons', code: "\ueeec"
  },
  
  "ti-square-number-8" : {
    iconSet: 'tabler icons', code: "\ueeed"
  },
  
  "ti-square-number-9" : {
    iconSet: 'tabler icons', code: "\ueeee"
  },
  
  "ti-square-off" : {
    iconSet: 'tabler icons', code: "\ueeef"
  },
  
  "ti-square-plus" : {
    iconSet: 'tabler icons', code: "\ueb2a"
  },
  
  "ti-square-root" : {
    iconSet: 'tabler icons', code: "\ueef1"
  },
  
  "ti-square-root-2" : {
    iconSet: 'tabler icons', code: "\ueef0"
  },
  
  "ti-square-rotated" : {
    iconSet: 'tabler icons', code: "\uecdf"
  },
  
  "ti-square-rotated-filled" : {
    iconSet: 'tabler icons', code: "\uf6a4"
  },
  
  "ti-square-rotated-forbid" : {
    iconSet: 'tabler icons', code: "\uf01c"
  },
  
  "ti-square-rotated-forbid-2" : {
    iconSet: 'tabler icons', code: "\uf01b"
  },
  
  "ti-square-rotated-off" : {
    iconSet: 'tabler icons', code: "\ueef2"
  },
  
  "ti-square-rounded" : {
    iconSet: 'tabler icons', code: "\uf59a"
  },
  
  "ti-square-rounded-arrow-down" : {
    iconSet: 'tabler icons', code: "\uf639"
  },
  
  "ti-square-rounded-arrow-down-filled" : {
    iconSet: 'tabler icons', code: "\uf6db"
  },
  
  "ti-square-rounded-arrow-left" : {
    iconSet: 'tabler icons', code: "\uf63a"
  },
  
  "ti-square-rounded-arrow-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6dc"
  },
  
  "ti-square-rounded-arrow-right" : {
    iconSet: 'tabler icons', code: "\uf63b"
  },
  
  "ti-square-rounded-arrow-right-filled" : {
    iconSet: 'tabler icons', code: "\uf6dd"
  },
  
  "ti-square-rounded-arrow-up" : {
    iconSet: 'tabler icons', code: "\uf63c"
  },
  
  "ti-square-rounded-arrow-up-filled" : {
    iconSet: 'tabler icons', code: "\uf6de"
  },
  
  "ti-square-rounded-check" : {
    iconSet: 'tabler icons', code: "\uf63d"
  },
  
  "ti-square-rounded-check-filled" : {
    iconSet: 'tabler icons', code: "\uf6df"
  },
  
  "ti-square-rounded-chevron-down" : {
    iconSet: 'tabler icons', code: "\uf62b"
  },
  
  "ti-square-rounded-chevron-down-filled" : {
    iconSet: 'tabler icons', code: "\uf6e0"
  },
  
  "ti-square-rounded-chevron-left" : {
    iconSet: 'tabler icons', code: "\uf62c"
  },
  
  "ti-square-rounded-chevron-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6e1"
  },
  
  "ti-square-rounded-chevron-right" : {
    iconSet: 'tabler icons', code: "\uf62d"
  },
  
  "ti-square-rounded-chevron-right-filled" : {
    iconSet: 'tabler icons', code: "\uf6e2"
  },
  
  "ti-square-rounded-chevron-up" : {
    iconSet: 'tabler icons', code: "\uf62e"
  },
  
  "ti-square-rounded-chevron-up-filled" : {
    iconSet: 'tabler icons', code: "\uf6e3"
  },
  
  "ti-square-rounded-chevrons-down" : {
    iconSet: 'tabler icons', code: "\uf64f"
  },
  
  "ti-square-rounded-chevrons-down-filled" : {
    iconSet: 'tabler icons', code: "\uf6e4"
  },
  
  "ti-square-rounded-chevrons-left" : {
    iconSet: 'tabler icons', code: "\uf650"
  },
  
  "ti-square-rounded-chevrons-left-filled" : {
    iconSet: 'tabler icons', code: "\uf6e5"
  },
  
  "ti-square-rounded-chevrons-right" : {
    iconSet: 'tabler icons', code: "\uf651"
  },
  
  "ti-square-rounded-chevrons-right-filled" : {
    iconSet: 'tabler icons', code: "\uf6e6"
  },
  
  "ti-square-rounded-chevrons-up" : {
    iconSet: 'tabler icons', code: "\uf652"
  },
  
  "ti-square-rounded-chevrons-up-filled" : {
    iconSet: 'tabler icons', code: "\uf6e7"
  },
  
  "ti-square-rounded-filled" : {
    iconSet: 'tabler icons', code: "\uf6a5"
  },
  
  "ti-square-rounded-letter-a" : {
    iconSet: 'tabler icons', code: "\uf5ae"
  },
  
  "ti-square-rounded-letter-b" : {
    iconSet: 'tabler icons', code: "\uf5af"
  },
  
  "ti-square-rounded-letter-c" : {
    iconSet: 'tabler icons', code: "\uf5b0"
  },
  
  "ti-square-rounded-letter-d" : {
    iconSet: 'tabler icons', code: "\uf5b1"
  },
  
  "ti-square-rounded-letter-e" : {
    iconSet: 'tabler icons', code: "\uf5b2"
  },
  
  "ti-square-rounded-letter-f" : {
    iconSet: 'tabler icons', code: "\uf5b3"
  },
  
  "ti-square-rounded-letter-g" : {
    iconSet: 'tabler icons', code: "\uf5b4"
  },
  
  "ti-square-rounded-letter-h" : {
    iconSet: 'tabler icons', code: "\uf5b5"
  },
  
  "ti-square-rounded-letter-i" : {
    iconSet: 'tabler icons', code: "\uf5b6"
  },
  
  "ti-square-rounded-letter-j" : {
    iconSet: 'tabler icons', code: "\uf5b7"
  },
  
  "ti-square-rounded-letter-k" : {
    iconSet: 'tabler icons', code: "\uf5b8"
  },
  
  "ti-square-rounded-letter-l" : {
    iconSet: 'tabler icons', code: "\uf5b9"
  },
  
  "ti-square-rounded-letter-m" : {
    iconSet: 'tabler icons', code: "\uf5ba"
  },
  
  "ti-square-rounded-letter-n" : {
    iconSet: 'tabler icons', code: "\uf5bb"
  },
  
  "ti-square-rounded-letter-o" : {
    iconSet: 'tabler icons', code: "\uf5bc"
  },
  
  "ti-square-rounded-letter-p" : {
    iconSet: 'tabler icons', code: "\uf5bd"
  },
  
  "ti-square-rounded-letter-q" : {
    iconSet: 'tabler icons', code: "\uf5be"
  },
  
  "ti-square-rounded-letter-r" : {
    iconSet: 'tabler icons', code: "\uf5bf"
  },
  
  "ti-square-rounded-letter-s" : {
    iconSet: 'tabler icons', code: "\uf5c0"
  },
  
  "ti-square-rounded-letter-t" : {
    iconSet: 'tabler icons', code: "\uf5c1"
  },
  
  "ti-square-rounded-letter-u" : {
    iconSet: 'tabler icons', code: "\uf5c2"
  },
  
  "ti-square-rounded-letter-v" : {
    iconSet: 'tabler icons', code: "\uf5c3"
  },
  
  "ti-square-rounded-letter-w" : {
    iconSet: 'tabler icons', code: "\uf5c4"
  },
  
  "ti-square-rounded-letter-x" : {
    iconSet: 'tabler icons', code: "\uf5c5"
  },
  
  "ti-square-rounded-letter-y" : {
    iconSet: 'tabler icons', code: "\uf5c6"
  },
  
  "ti-square-rounded-letter-z" : {
    iconSet: 'tabler icons', code: "\uf5c7"
  },
  
  "ti-square-rounded-minus" : {
    iconSet: 'tabler icons', code: "\uf63e"
  },
  
  "ti-square-rounded-number-0" : {
    iconSet: 'tabler icons', code: "\uf5c8"
  },
  
  "ti-square-rounded-number-0-filled" : {
    iconSet: 'tabler icons', code: "\uf778"
  },
  
  "ti-square-rounded-number-1" : {
    iconSet: 'tabler icons', code: "\uf5c9"
  },
  
  "ti-square-rounded-number-1-filled" : {
    iconSet: 'tabler icons', code: "\uf779"
  },
  
  "ti-square-rounded-number-2" : {
    iconSet: 'tabler icons', code: "\uf5ca"
  },
  
  "ti-square-rounded-number-2-filled" : {
    iconSet: 'tabler icons', code: "\uf77a"
  },
  
  "ti-square-rounded-number-3" : {
    iconSet: 'tabler icons', code: "\uf5cb"
  },
  
  "ti-square-rounded-number-3-filled" : {
    iconSet: 'tabler icons', code: "\uf77b"
  },
  
  "ti-square-rounded-number-4" : {
    iconSet: 'tabler icons', code: "\uf5cc"
  },
  
  "ti-square-rounded-number-4-filled" : {
    iconSet: 'tabler icons', code: "\uf77c"
  },
  
  "ti-square-rounded-number-5" : {
    iconSet: 'tabler icons', code: "\uf5cd"
  },
  
  "ti-square-rounded-number-5-filled" : {
    iconSet: 'tabler icons', code: "\uf77d"
  },
  
  "ti-square-rounded-number-6" : {
    iconSet: 'tabler icons', code: "\uf5ce"
  },
  
  "ti-square-rounded-number-6-filled" : {
    iconSet: 'tabler icons', code: "\uf77e"
  },
  
  "ti-square-rounded-number-7" : {
    iconSet: 'tabler icons', code: "\uf5cf"
  },
  
  "ti-square-rounded-number-7-filled" : {
    iconSet: 'tabler icons', code: "\uf77f"
  },
  
  "ti-square-rounded-number-8" : {
    iconSet: 'tabler icons', code: "\uf5d0"
  },
  
  "ti-square-rounded-number-8-filled" : {
    iconSet: 'tabler icons', code: "\uf780"
  },
  
  "ti-square-rounded-number-9" : {
    iconSet: 'tabler icons', code: "\uf5d1"
  },
  
  "ti-square-rounded-number-9-filled" : {
    iconSet: 'tabler icons', code: "\uf781"
  },
  
  "ti-square-rounded-plus" : {
    iconSet: 'tabler icons', code: "\uf63f"
  },
  
  "ti-square-rounded-plus-filled" : {
    iconSet: 'tabler icons', code: "\uf6e8"
  },
  
  "ti-square-rounded-x" : {
    iconSet: 'tabler icons', code: "\uf640"
  },
  
  "ti-square-rounded-x-filled" : {
    iconSet: 'tabler icons', code: "\uf6e9"
  },
  
  "ti-square-toggle" : {
    iconSet: 'tabler icons', code: "\ueef4"
  },
  
  "ti-square-toggle-horizontal" : {
    iconSet: 'tabler icons', code: "\ueef3"
  },
  
  "ti-square-x" : {
    iconSet: 'tabler icons', code: "\ueb2b"
  },
  
  "ti-squares-diagonal" : {
    iconSet: 'tabler icons', code: "\ueef5"
  },
  
  "ti-squares-filled" : {
    iconSet: 'tabler icons', code: "\ueef6"
  },
  
  "ti-stack" : {
    iconSet: 'tabler icons', code: "\ueb2d"
  },
  
  "ti-stack-2" : {
    iconSet: 'tabler icons', code: "\ueef7"
  },
  
  "ti-stack-3" : {
    iconSet: 'tabler icons', code: "\uef9d"
  },
  
  "ti-stack-pop" : {
    iconSet: 'tabler icons', code: "\uf234"
  },
  
  "ti-stack-push" : {
    iconSet: 'tabler icons', code: "\uf235"
  },
  
  "ti-stairs" : {
    iconSet: 'tabler icons', code: "\ueca6"
  },
  
  "ti-stairs-down" : {
    iconSet: 'tabler icons', code: "\ueca4"
  },
  
  "ti-stairs-up" : {
    iconSet: 'tabler icons', code: "\ueca5"
  },
  
  "ti-star" : {
    iconSet: 'tabler icons', code: "\ueb2e"
  },
  
  "ti-star-filled" : {
    iconSet: 'tabler icons', code: "\uf6a6"
  },
  
  "ti-star-half" : {
    iconSet: 'tabler icons', code: "\ued19"
  },
  
  "ti-star-half-filled" : {
    iconSet: 'tabler icons', code: "\uf6a7"
  },
  
  "ti-star-off" : {
    iconSet: 'tabler icons', code: "\ued62"
  },
  
  "ti-stars" : {
    iconSet: 'tabler icons', code: "\ued38"
  },
  
  "ti-stars-filled" : {
    iconSet: 'tabler icons', code: "\uf6a8"
  },
  
  "ti-stars-off" : {
    iconSet: 'tabler icons', code: "\uf430"
  },
  
  "ti-status-change" : {
    iconSet: 'tabler icons', code: "\uf3b0"
  },
  
  "ti-steam" : {
    iconSet: 'tabler icons', code: "\uf24b"
  },
  
  "ti-steering-wheel" : {
    iconSet: 'tabler icons', code: "\uec7b"
  },
  
  "ti-steering-wheel-off" : {
    iconSet: 'tabler icons', code: "\uf431"
  },
  
  "ti-step-into" : {
    iconSet: 'tabler icons', code: "\uece0"
  },
  
  "ti-step-out" : {
    iconSet: 'tabler icons', code: "\uece1"
  },
  
  "ti-stereo-glasses" : {
    iconSet: 'tabler icons', code: "\uf4cb"
  },
  
  "ti-stethoscope" : {
    iconSet: 'tabler icons', code: "\uedbe"
  },
  
  "ti-stethoscope-off" : {
    iconSet: 'tabler icons', code: "\uf432"
  },
  
  "ti-sticker" : {
    iconSet: 'tabler icons', code: "\ueb2f"
  },
  
  "ti-storm" : {
    iconSet: 'tabler icons', code: "\uf24c"
  },
  
  "ti-storm-off" : {
    iconSet: 'tabler icons', code: "\uf433"
  },
  
  "ti-stretching" : {
    iconSet: 'tabler icons', code: "\uf2db"
  },
  
  "ti-strikethrough" : {
    iconSet: 'tabler icons', code: "\ueb9e"
  },
  
  "ti-submarine" : {
    iconSet: 'tabler icons', code: "\ued94"
  },
  
  "ti-subscript" : {
    iconSet: 'tabler icons', code: "\ueb9f"
  },
  
  "ti-subtask" : {
    iconSet: 'tabler icons', code: "\uec9f"
  },
  
  "ti-sum" : {
    iconSet: 'tabler icons', code: "\ueb73"
  },
  
  "ti-sum-off" : {
    iconSet: 'tabler icons', code: "\uf1ab"
  },
  
  "ti-sun" : {
    iconSet: 'tabler icons', code: "\ueb30"
  },
  
  "ti-sun-filled" : {
    iconSet: 'tabler icons', code: "\uf6a9"
  },
  
  "ti-sun-high" : {
    iconSet: 'tabler icons', code: "\uf236"
  },
  
  "ti-sun-low" : {
    iconSet: 'tabler icons', code: "\uf237"
  },
  
  "ti-sun-moon" : {
    iconSet: 'tabler icons', code: "\uf4a3"
  },
  
  "ti-sun-off" : {
    iconSet: 'tabler icons', code: "\ued63"
  },
  
  "ti-sun-wind" : {
    iconSet: 'tabler icons', code: "\uf238"
  },
  
  "ti-sunglasses" : {
    iconSet: 'tabler icons', code: "\uf239"
  },
  
  "ti-sunrise" : {
    iconSet: 'tabler icons', code: "\uef1c"
  },
  
  "ti-sunset" : {
    iconSet: 'tabler icons', code: "\uec31"
  },
  
  "ti-sunset-2" : {
    iconSet: 'tabler icons', code: "\uf23a"
  },
  
  "ti-superscript" : {
    iconSet: 'tabler icons', code: "\ueba0"
  },
  
  "ti-svg" : {
    iconSet: 'tabler icons', code: "\uf25a"
  },
  
  "ti-swimming" : {
    iconSet: 'tabler icons', code: "\uec92"
  },
  
  "ti-swipe" : {
    iconSet: 'tabler icons', code: "\uf551"
  },
  
  "ti-switch" : {
    iconSet: 'tabler icons', code: "\ueb33"
  },
  
  "ti-switch-2" : {
    iconSet: 'tabler icons', code: "\uedbf"
  },
  
  "ti-switch-3" : {
    iconSet: 'tabler icons', code: "\uedc0"
  },
  
  "ti-switch-horizontal" : {
    iconSet: 'tabler icons', code: "\ueb31"
  },
  
  "ti-switch-vertical" : {
    iconSet: 'tabler icons', code: "\ueb32"
  },
  
  "ti-sword" : {
    iconSet: 'tabler icons', code: "\uf030"
  },
  
  "ti-sword-off" : {
    iconSet: 'tabler icons', code: "\uf434"
  },
  
  "ti-swords" : {
    iconSet: 'tabler icons', code: "\uf132"
  },
  
  "ti-table" : {
    iconSet: 'tabler icons', code: "\ueba1"
  },
  
  "ti-table-alias" : {
    iconSet: 'tabler icons', code: "\uf25b"
  },
  
  "ti-table-down" : {
    iconSet: 'tabler icons', code: "\ufa1c"
  },
  
  "ti-table-export" : {
    iconSet: 'tabler icons', code: "\ueef8"
  },
  
  "ti-table-filled" : {
    iconSet: 'tabler icons', code: "\uf782"
  },
  
  "ti-table-heart" : {
    iconSet: 'tabler icons', code: "\ufa1d"
  },
  
  "ti-table-import" : {
    iconSet: 'tabler icons', code: "\ueef9"
  },
  
  "ti-table-minus" : {
    iconSet: 'tabler icons', code: "\ufa1e"
  },
  
  "ti-table-off" : {
    iconSet: 'tabler icons', code: "\ueefa"
  },
  
  "ti-table-options" : {
    iconSet: 'tabler icons', code: "\uf25c"
  },
  
  "ti-table-plus" : {
    iconSet: 'tabler icons', code: "\ufa1f"
  },
  
  "ti-table-share" : {
    iconSet: 'tabler icons', code: "\ufa20"
  },
  
  "ti-table-shortcut" : {
    iconSet: 'tabler icons', code: "\uf25d"
  },
  
  "ti-tag" : {
    iconSet: 'tabler icons', code: "\ueb34"
  },
  
  "ti-tag-off" : {
    iconSet: 'tabler icons', code: "\uefc0"
  },
  
  "ti-tags" : {
    iconSet: 'tabler icons', code: "\uef86"
  },
  
  "ti-tags-off" : {
    iconSet: 'tabler icons', code: "\uefc1"
  },
  
  "ti-tallymark-1" : {
    iconSet: 'tabler icons', code: "\uec46"
  },
  
  "ti-tallymark-2" : {
    iconSet: 'tabler icons', code: "\uec47"
  },
  
  "ti-tallymark-3" : {
    iconSet: 'tabler icons', code: "\uec48"
  },
  
  "ti-tallymark-4" : {
    iconSet: 'tabler icons', code: "\uec49"
  },
  
  "ti-tallymarks" : {
    iconSet: 'tabler icons', code: "\uec4a"
  },
  
  "ti-tank" : {
    iconSet: 'tabler icons', code: "\ued95"
  },
  
  "ti-target" : {
    iconSet: 'tabler icons', code: "\ueb35"
  },
  
  "ti-target-arrow" : {
    iconSet: 'tabler icons', code: "\uf51a"
  },
  
  "ti-target-off" : {
    iconSet: 'tabler icons', code: "\uf1ad"
  },
  
  "ti-teapot" : {
    iconSet: 'tabler icons', code: "\uf552"
  },
  
  "ti-telescope" : {
    iconSet: 'tabler icons', code: "\uf07d"
  },
  
  "ti-telescope-off" : {
    iconSet: 'tabler icons', code: "\uf1ae"
  },
  
  "ti-temperature" : {
    iconSet: 'tabler icons', code: "\ueb38"
  },
  
  "ti-temperature-celsius" : {
    iconSet: 'tabler icons', code: "\ueb36"
  },
  
  "ti-temperature-fahrenheit" : {
    iconSet: 'tabler icons', code: "\ueb37"
  },
  
  "ti-temperature-minus" : {
    iconSet: 'tabler icons', code: "\uebed"
  },
  
  "ti-temperature-off" : {
    iconSet: 'tabler icons', code: "\uf1af"
  },
  
  "ti-temperature-plus" : {
    iconSet: 'tabler icons', code: "\uebee"
  },
  
  "ti-template" : {
    iconSet: 'tabler icons', code: "\ueb39"
  },
  
  "ti-template-off" : {
    iconSet: 'tabler icons', code: "\uf1b0"
  },
  
  "ti-tent" : {
    iconSet: 'tabler icons', code: "\ueefb"
  },
  
  "ti-tent-off" : {
    iconSet: 'tabler icons', code: "\uf435"
  },
  
  "ti-terminal" : {
    iconSet: 'tabler icons', code: "\uebdc"
  },
  
  "ti-terminal-2" : {
    iconSet: 'tabler icons', code: "\uebef"
  },
  
  "ti-test-pipe" : {
    iconSet: 'tabler icons', code: "\ueb3a"
  },
  
  "ti-test-pipe-2" : {
    iconSet: 'tabler icons', code: "\uf0a4"
  },
  
  "ti-test-pipe-off" : {
    iconSet: 'tabler icons', code: "\uf1b1"
  },
  
  "ti-tex" : {
    iconSet: 'tabler icons', code: "\uf4e0"
  },
  
  "ti-text-caption" : {
    iconSet: 'tabler icons', code: "\uf4a4"
  },
  
  "ti-text-color" : {
    iconSet: 'tabler icons', code: "\uf2dc"
  },
  
  "ti-text-decrease" : {
    iconSet: 'tabler icons', code: "\uf202"
  },
  
  "ti-text-direction-ltr" : {
    iconSet: 'tabler icons', code: "\ueefc"
  },
  
  "ti-text-direction-rtl" : {
    iconSet: 'tabler icons', code: "\ueefd"
  },
  
  "ti-text-increase" : {
    iconSet: 'tabler icons', code: "\uf203"
  },
  
  "ti-text-orientation" : {
    iconSet: 'tabler icons', code: "\uf2a4"
  },
  
  "ti-text-plus" : {
    iconSet: 'tabler icons', code: "\uf2a5"
  },
  
  "ti-text-recognition" : {
    iconSet: 'tabler icons', code: "\uf204"
  },
  
  "ti-text-resize" : {
    iconSet: 'tabler icons', code: "\uef87"
  },
  
  "ti-text-size" : {
    iconSet: 'tabler icons', code: "\uf2b1"
  },
  
  "ti-text-spellcheck" : {
    iconSet: 'tabler icons', code: "\uf2a6"
  },
  
  "ti-text-wrap" : {
    iconSet: 'tabler icons', code: "\uebdd"
  },
  
  "ti-text-wrap-disabled" : {
    iconSet: 'tabler icons', code: "\ueca7"
  },
  
  "ti-texture" : {
    iconSet: 'tabler icons', code: "\uf51b"
  },
  
  "ti-theater" : {
    iconSet: 'tabler icons', code: "\uf79b"
  },
  
  "ti-thermometer" : {
    iconSet: 'tabler icons', code: "\uef67"
  },
  
  "ti-thumb-down" : {
    iconSet: 'tabler icons', code: "\ueb3b"
  },
  
  "ti-thumb-down-filled" : {
    iconSet: 'tabler icons', code: "\uf6aa"
  },
  
  "ti-thumb-down-off" : {
    iconSet: 'tabler icons', code: "\uf436"
  },
  
  "ti-thumb-up" : {
    iconSet: 'tabler icons', code: "\ueb3c"
  },
  
  "ti-thumb-up-filled" : {
    iconSet: 'tabler icons', code: "\uf6ab"
  },
  
  "ti-thumb-up-off" : {
    iconSet: 'tabler icons', code: "\uf437"
  },
  
  "ti-tic-tac" : {
    iconSet: 'tabler icons', code: "\uf51c"
  },
  
  "ti-ticket" : {
    iconSet: 'tabler icons', code: "\ueb3d"
  },
  
  "ti-ticket-off" : {
    iconSet: 'tabler icons', code: "\uf1b2"
  },
  
  "ti-tie" : {
    iconSet: 'tabler icons', code: "\uf07e"
  },
  
  "ti-tilde" : {
    iconSet: 'tabler icons', code: "\uf4a5"
  },
  
  "ti-tilt-shift" : {
    iconSet: 'tabler icons', code: "\ueefe"
  },
  
  "ti-tilt-shift-off" : {
    iconSet: 'tabler icons', code: "\uf1b3"
  },
  
  "ti-timeline" : {
    iconSet: 'tabler icons', code: "\uf031"
  },
  
  "ti-timeline-event" : {
    iconSet: 'tabler icons', code: "\uf553"
  },
  
  "ti-timeline-event-exclamation" : {
    iconSet: 'tabler icons', code: "\uf662"
  },
  
  "ti-timeline-event-minus" : {
    iconSet: 'tabler icons', code: "\uf663"
  },
  
  "ti-timeline-event-plus" : {
    iconSet: 'tabler icons', code: "\uf664"
  },
  
  "ti-timeline-event-text" : {
    iconSet: 'tabler icons', code: "\uf665"
  },
  
  "ti-timeline-event-x" : {
    iconSet: 'tabler icons', code: "\uf666"
  },
  
  "ti-tir" : {
    iconSet: 'tabler icons', code: "\uebf0"
  },
  
  "ti-toggle-left" : {
    iconSet: 'tabler icons', code: "\ueb3e"
  },
  
  "ti-toggle-right" : {
    iconSet: 'tabler icons', code: "\ueb3f"
  },
  
  "ti-toilet-paper" : {
    iconSet: 'tabler icons', code: "\uefd3"
  },
  
  "ti-toilet-paper-off" : {
    iconSet: 'tabler icons', code: "\uf1b4"
  },
  
  "ti-tool" : {
    iconSet: 'tabler icons', code: "\ueb40"
  },
  
  "ti-tools" : {
    iconSet: 'tabler icons', code: "\uebca"
  },
  
  "ti-tools-kitchen" : {
    iconSet: 'tabler icons', code: "\ued64"
  },
  
  "ti-tools-kitchen-2" : {
    iconSet: 'tabler icons', code: "\ueeff"
  },
  
  "ti-tools-kitchen-2-off" : {
    iconSet: 'tabler icons', code: "\uf1b5"
  },
  
  "ti-tools-kitchen-off" : {
    iconSet: 'tabler icons', code: "\uf1b6"
  },
  
  "ti-tools-off" : {
    iconSet: 'tabler icons', code: "\uf1b7"
  },
  
  "ti-tooltip" : {
    iconSet: 'tabler icons', code: "\uf2dd"
  },
  
  "ti-topology-bus" : {
    iconSet: 'tabler icons', code: "\uf5d9"
  },
  
  "ti-topology-complex" : {
    iconSet: 'tabler icons', code: "\uf5da"
  },
  
  "ti-topology-full" : {
    iconSet: 'tabler icons', code: "\uf5dc"
  },
  
  "ti-topology-full-hierarchy" : {
    iconSet: 'tabler icons', code: "\uf5db"
  },
  
  "ti-topology-ring" : {
    iconSet: 'tabler icons', code: "\uf5df"
  },
  
  "ti-topology-ring-2" : {
    iconSet: 'tabler icons', code: "\uf5dd"
  },
  
  "ti-topology-ring-3" : {
    iconSet: 'tabler icons', code: "\uf5de"
  },
  
  "ti-topology-star" : {
    iconSet: 'tabler icons', code: "\uf5e5"
  },
  
  "ti-topology-star-2" : {
    iconSet: 'tabler icons', code: "\uf5e0"
  },
  
  "ti-topology-star-3" : {
    iconSet: 'tabler icons', code: "\uf5e1"
  },
  
  "ti-topology-star-ring" : {
    iconSet: 'tabler icons', code: "\uf5e4"
  },
  
  "ti-topology-star-ring-2" : {
    iconSet: 'tabler icons', code: "\uf5e2"
  },
  
  "ti-topology-star-ring-3" : {
    iconSet: 'tabler icons', code: "\uf5e3"
  },
  
  "ti-torii" : {
    iconSet: 'tabler icons', code: "\uf59b"
  },
  
  "ti-tornado" : {
    iconSet: 'tabler icons', code: "\uece2"
  },
  
  "ti-tournament" : {
    iconSet: 'tabler icons', code: "\uecd0"
  },
  
  "ti-tower" : {
    iconSet: 'tabler icons', code: "\uf2cb"
  },
  
  "ti-tower-off" : {
    iconSet: 'tabler icons', code: "\uf2ca"
  },
  
  "ti-track" : {
    iconSet: 'tabler icons', code: "\uef00"
  },
  
  "ti-tractor" : {
    iconSet: 'tabler icons', code: "\uec0d"
  },
  
  "ti-trademark" : {
    iconSet: 'tabler icons', code: "\uec0e"
  },
  
  "ti-traffic-cone" : {
    iconSet: 'tabler icons', code: "\uec0f"
  },
  
  "ti-traffic-cone-off" : {
    iconSet: 'tabler icons', code: "\uf1b8"
  },
  
  "ti-traffic-lights" : {
    iconSet: 'tabler icons', code: "\ued39"
  },
  
  "ti-traffic-lights-off" : {
    iconSet: 'tabler icons', code: "\uf1b9"
  },
  
  "ti-train" : {
    iconSet: 'tabler icons', code: "\ued96"
  },
  
  "ti-transfer-in" : {
    iconSet: 'tabler icons', code: "\uef2f"
  },
  
  "ti-transfer-out" : {
    iconSet: 'tabler icons', code: "\uef30"
  },
  
  "ti-transform" : {
    iconSet: 'tabler icons', code: "\uf38e"
  },
  
  "ti-transform-filled" : {
    iconSet: 'tabler icons', code: "\uf6ac"
  },
  
  "ti-transition-bottom" : {
    iconSet: 'tabler icons', code: "\uf2b2"
  },
  
  "ti-transition-left" : {
    iconSet: 'tabler icons', code: "\uf2b3"
  },
  
  "ti-transition-right" : {
    iconSet: 'tabler icons', code: "\uf2b4"
  },
  
  "ti-transition-top" : {
    iconSet: 'tabler icons', code: "\uf2b5"
  },
  
  "ti-trash" : {
    iconSet: 'tabler icons', code: "\ueb41"
  },
  
  "ti-trash-filled" : {
    iconSet: 'tabler icons', code: "\uf783"
  },
  
  "ti-trash-off" : {
    iconSet: 'tabler icons', code: "\ued65"
  },
  
  "ti-trash-x" : {
    iconSet: 'tabler icons', code: "\uef88"
  },
  
  "ti-trash-x-filled" : {
    iconSet: 'tabler icons', code: "\uf784"
  },
  
  "ti-tree" : {
    iconSet: 'tabler icons', code: "\uef01"
  },
  
  "ti-trees" : {
    iconSet: 'tabler icons', code: "\uec10"
  },
  
  "ti-trekking" : {
    iconSet: 'tabler icons', code: "\uf5ad"
  },
  
  "ti-trending-down" : {
    iconSet: 'tabler icons', code: "\ueb42"
  },
  
  "ti-trending-down-2" : {
    iconSet: 'tabler icons', code: "\uedc1"
  },
  
  "ti-trending-down-3" : {
    iconSet: 'tabler icons', code: "\uedc2"
  },
  
  "ti-trending-up" : {
    iconSet: 'tabler icons', code: "\ueb43"
  },
  
  "ti-trending-up-2" : {
    iconSet: 'tabler icons', code: "\uedc3"
  },
  
  "ti-trending-up-3" : {
    iconSet: 'tabler icons', code: "\uedc4"
  },
  
  "ti-triangle" : {
    iconSet: 'tabler icons', code: "\ueb44"
  },
  
  "ti-triangle-filled" : {
    iconSet: 'tabler icons', code: "\uf6ad"
  },
  
  "ti-triangle-inverted" : {
    iconSet: 'tabler icons', code: "\uf01d"
  },
  
  "ti-triangle-inverted-filled" : {
    iconSet: 'tabler icons', code: "\uf6ae"
  },
  
  "ti-triangle-off" : {
    iconSet: 'tabler icons', code: "\uef02"
  },
  
  "ti-triangle-square-circle" : {
    iconSet: 'tabler icons', code: "\uece8"
  },
  
  "ti-triangles" : {
    iconSet: 'tabler icons', code: "\uf0a5"
  },
  
  "ti-trident" : {
    iconSet: 'tabler icons', code: "\uecc5"
  },
  
  "ti-trolley" : {
    iconSet: 'tabler icons', code: "\uf4cc"
  },
  
  "ti-trophy" : {
    iconSet: 'tabler icons', code: "\ueb45"
  },
  
  "ti-trophy-filled" : {
    iconSet: 'tabler icons', code: "\uf6af"
  },
  
  "ti-trophy-off" : {
    iconSet: 'tabler icons', code: "\uf438"
  },
  
  "ti-trowel" : {
    iconSet: 'tabler icons', code: "\uf368"
  },
  
  "ti-truck" : {
    iconSet: 'tabler icons', code: "\uebc4"
  },
  
  "ti-truck-delivery" : {
    iconSet: 'tabler icons', code: "\uec4b"
  },
  
  "ti-truck-loading" : {
    iconSet: 'tabler icons', code: "\uf1da"
  },
  
  "ti-truck-off" : {
    iconSet: 'tabler icons', code: "\uef03"
  },
  
  "ti-truck-return" : {
    iconSet: 'tabler icons', code: "\uec4c"
  },
  
  "ti-txt" : {
    iconSet: 'tabler icons', code: "\uf3b1"
  },
  
  "ti-typography" : {
    iconSet: 'tabler icons', code: "\uebc5"
  },
  
  "ti-typography-off" : {
    iconSet: 'tabler icons', code: "\uf1ba"
  },
  
  "ti-ufo" : {
    iconSet: 'tabler icons', code: "\uf26f"
  },
  
  "ti-ufo-off" : {
    iconSet: 'tabler icons', code: "\uf26e"
  },
  
  "ti-umbrella" : {
    iconSet: 'tabler icons', code: "\uebf1"
  },
  
  "ti-umbrella-filled" : {
    iconSet: 'tabler icons', code: "\uf6b0"
  },
  
  "ti-umbrella-off" : {
    iconSet: 'tabler icons', code: "\uf1bb"
  },
  
  "ti-underline" : {
    iconSet: 'tabler icons', code: "\ueba2"
  },
  
  "ti-unlink" : {
    iconSet: 'tabler icons', code: "\ueb46"
  },
  
  "ti-upload" : {
    iconSet: 'tabler icons', code: "\ueb47"
  },
  
  "ti-urgent" : {
    iconSet: 'tabler icons', code: "\ueb48"
  },
  
  "ti-usb" : {
    iconSet: 'tabler icons', code: "\uf00c"
  },
  
  "ti-user" : {
    iconSet: 'tabler icons', code: "\ueb4d"
  },
  
  "ti-user-bolt" : {
    iconSet: 'tabler icons', code: "\uf9d1"
  },
  
  "ti-user-cancel" : {
    iconSet: 'tabler icons', code: "\uf9d2"
  },
  
  "ti-user-check" : {
    iconSet: 'tabler icons', code: "\ueb49"
  },
  
  "ti-user-circle" : {
    iconSet: 'tabler icons', code: "\uef68"
  },
  
  "ti-user-code" : {
    iconSet: 'tabler icons', code: "\uf9d3"
  },
  
  "ti-user-cog" : {
    iconSet: 'tabler icons', code: "\uf9d4"
  },
  
  "ti-user-dollar" : {
    iconSet: 'tabler icons', code: "\uf9d5"
  },
  
  "ti-user-down" : {
    iconSet: 'tabler icons', code: "\uf9d6"
  },
  
  "ti-user-edit" : {
    iconSet: 'tabler icons', code: "\uf7cc"
  },
  
  "ti-user-exclamation" : {
    iconSet: 'tabler icons', code: "\uec12"
  },
  
  "ti-user-heart" : {
    iconSet: 'tabler icons', code: "\uf7cd"
  },
  
  "ti-user-minus" : {
    iconSet: 'tabler icons', code: "\ueb4a"
  },
  
  "ti-user-off" : {
    iconSet: 'tabler icons', code: "\uecf9"
  },
  
  "ti-user-pause" : {
    iconSet: 'tabler icons', code: "\uf9d7"
  },
  
  "ti-user-pin" : {
    iconSet: 'tabler icons', code: "\uf7ce"
  },
  
  "ti-user-plus" : {
    iconSet: 'tabler icons', code: "\ueb4b"
  },
  
  "ti-user-question" : {
    iconSet: 'tabler icons', code: "\uf7cf"
  },
  
  "ti-user-search" : {
    iconSet: 'tabler icons', code: "\uef89"
  },
  
  "ti-user-share" : {
    iconSet: 'tabler icons', code: "\uf9d8"
  },
  
  "ti-user-shield" : {
    iconSet: 'tabler icons', code: "\uf7d0"
  },
  
  "ti-user-star" : {
    iconSet: 'tabler icons', code: "\uf7d1"
  },
  
  "ti-user-up" : {
    iconSet: 'tabler icons', code: "\uf7d2"
  },
  
  "ti-user-x" : {
    iconSet: 'tabler icons', code: "\ueb4c"
  },
  
  "ti-users" : {
    iconSet: 'tabler icons', code: "\uebf2"
  },
  
  "ti-users-group" : {
    iconSet: 'tabler icons', code: "\ufa21"
  },
  
  "ti-users-minus" : {
    iconSet: 'tabler icons', code: "\ufa0e"
  },
  
  "ti-users-plus" : {
    iconSet: 'tabler icons', code: "\ufa0f"
  },
  
  "ti-uv-index" : {
    iconSet: 'tabler icons', code: "\uf3b2"
  },
  
  "ti-ux-circle" : {
    iconSet: 'tabler icons', code: "\uf369"
  },
  
  "ti-vaccine" : {
    iconSet: 'tabler icons', code: "\uef04"
  },
  
  "ti-vaccine-bottle" : {
    iconSet: 'tabler icons', code: "\uef69"
  },
  
  "ti-vaccine-bottle-off" : {
    iconSet: 'tabler icons', code: "\uf439"
  },
  
  "ti-vaccine-off" : {
    iconSet: 'tabler icons', code: "\uf1bc"
  },
  
  "ti-vacuum-cleaner" : {
    iconSet: 'tabler icons', code: "\uf5e6"
  },
  
  "ti-variable" : {
    iconSet: 'tabler icons', code: "\uef05"
  },
  
  "ti-variable-minus" : {
    iconSet: 'tabler icons', code: "\uf36a"
  },
  
  "ti-variable-off" : {
    iconSet: 'tabler icons', code: "\uf1bd"
  },
  
  "ti-variable-plus" : {
    iconSet: 'tabler icons', code: "\uf36b"
  },
  
  "ti-vector" : {
    iconSet: 'tabler icons', code: "\ueca9"
  },
  
  "ti-vector-bezier" : {
    iconSet: 'tabler icons', code: "\uef1d"
  },
  
  "ti-vector-bezier-2" : {
    iconSet: 'tabler icons', code: "\uf1a3"
  },
  
  "ti-vector-bezier-arc" : {
    iconSet: 'tabler icons', code: "\uf4cd"
  },
  
  "ti-vector-bezier-circle" : {
    iconSet: 'tabler icons', code: "\uf4ce"
  },
  
  "ti-vector-off" : {
    iconSet: 'tabler icons', code: "\uf1be"
  },
  
  "ti-vector-spline" : {
    iconSet: 'tabler icons', code: "\uf565"
  },
  
  "ti-vector-triangle" : {
    iconSet: 'tabler icons', code: "\ueca8"
  },
  
  "ti-vector-triangle-off" : {
    iconSet: 'tabler icons', code: "\uf1bf"
  },
  
  "ti-venus" : {
    iconSet: 'tabler icons', code: "\uec86"
  },
  
  "ti-versions" : {
    iconSet: 'tabler icons', code: "\ued52"
  },
  
  "ti-versions-filled" : {
    iconSet: 'tabler icons', code: "\uf6b1"
  },
  
  "ti-versions-off" : {
    iconSet: 'tabler icons', code: "\uf1c0"
  },
  
  "ti-video" : {
    iconSet: 'tabler icons', code: "\ued22"
  },
  
  "ti-video-minus" : {
    iconSet: 'tabler icons', code: "\ued1f"
  },
  
  "ti-video-off" : {
    iconSet: 'tabler icons', code: "\ued20"
  },
  
  "ti-video-plus" : {
    iconSet: 'tabler icons', code: "\ued21"
  },
  
  "ti-view-360" : {
    iconSet: 'tabler icons', code: "\ued84"
  },
  
  "ti-view-360-off" : {
    iconSet: 'tabler icons', code: "\uf1c1"
  },
  
  "ti-viewfinder" : {
    iconSet: 'tabler icons', code: "\ueb4e"
  },
  
  "ti-viewfinder-off" : {
    iconSet: 'tabler icons', code: "\uf1c2"
  },
  
  "ti-viewport-narrow" : {
    iconSet: 'tabler icons', code: "\uebf3"
  },
  
  "ti-viewport-wide" : {
    iconSet: 'tabler icons', code: "\uebf4"
  },
  
  "ti-vinyl" : {
    iconSet: 'tabler icons', code: "\uf00d"
  },
  
  "ti-vip" : {
    iconSet: 'tabler icons', code: "\uf3b3"
  },
  
  "ti-vip-off" : {
    iconSet: 'tabler icons', code: "\uf43a"
  },
  
  "ti-virus" : {
    iconSet: 'tabler icons', code: "\ueb74"
  },
  
  "ti-virus-off" : {
    iconSet: 'tabler icons', code: "\ued66"
  },
  
  "ti-virus-search" : {
    iconSet: 'tabler icons', code: "\ued67"
  },
  
  "ti-vocabulary" : {
    iconSet: 'tabler icons', code: "\uef1e"
  },
  
  "ti-vocabulary-off" : {
    iconSet: 'tabler icons', code: "\uf43b"
  },
  
  "ti-volcano" : {
    iconSet: 'tabler icons', code: "\uf79c"
  },
  
  "ti-volume" : {
    iconSet: 'tabler icons', code: "\ueb51"
  },
  
  "ti-volume-2" : {
    iconSet: 'tabler icons', code: "\ueb4f"
  },
  
  "ti-volume-3" : {
    iconSet: 'tabler icons', code: "\ueb50"
  },
  
  "ti-volume-off" : {
    iconSet: 'tabler icons', code: "\uf1c3"
  },
  
  "ti-walk" : {
    iconSet: 'tabler icons', code: "\uec87"
  },
  
  "ti-wall" : {
    iconSet: 'tabler icons', code: "\uef7a"
  },
  
  "ti-wall-off" : {
    iconSet: 'tabler icons', code: "\uf43c"
  },
  
  "ti-wallet" : {
    iconSet: 'tabler icons', code: "\ueb75"
  },
  
  "ti-wallet-off" : {
    iconSet: 'tabler icons', code: "\uf1c4"
  },
  
  "ti-wallpaper" : {
    iconSet: 'tabler icons', code: "\uef56"
  },
  
  "ti-wallpaper-off" : {
    iconSet: 'tabler icons', code: "\uf1c5"
  },
  
  "ti-wand" : {
    iconSet: 'tabler icons', code: "\uebcb"
  },
  
  "ti-wand-off" : {
    iconSet: 'tabler icons', code: "\uf1c6"
  },
  
  "ti-wash" : {
    iconSet: 'tabler icons', code: "\uf311"
  },
  
  "ti-wash-dry" : {
    iconSet: 'tabler icons', code: "\uf304"
  },
  
  "ti-wash-dry-1" : {
    iconSet: 'tabler icons', code: "\uf2fa"
  },
  
  "ti-wash-dry-2" : {
    iconSet: 'tabler icons', code: "\uf2fb"
  },
  
  "ti-wash-dry-3" : {
    iconSet: 'tabler icons', code: "\uf2fc"
  },
  
  "ti-wash-dry-a" : {
    iconSet: 'tabler icons', code: "\uf2fd"
  },
  
  "ti-wash-dry-dip" : {
    iconSet: 'tabler icons', code: "\uf2fe"
  },
  
  "ti-wash-dry-f" : {
    iconSet: 'tabler icons', code: "\uf2ff"
  },
  
  "ti-wash-dry-hang" : {
    iconSet: 'tabler icons', code: "\uf300"
  },
  
  "ti-wash-dry-off" : {
    iconSet: 'tabler icons', code: "\uf301"
  },
  
  "ti-wash-dry-p" : {
    iconSet: 'tabler icons', code: "\uf302"
  },
  
  "ti-wash-dry-shade" : {
    iconSet: 'tabler icons', code: "\uf303"
  },
  
  "ti-wash-dry-w" : {
    iconSet: 'tabler icons', code: "\uf322"
  },
  
  "ti-wash-dryclean" : {
    iconSet: 'tabler icons', code: "\uf305"
  },
  
  "ti-wash-dryclean-off" : {
    iconSet: 'tabler icons', code: "\uf323"
  },
  
  "ti-wash-gentle" : {
    iconSet: 'tabler icons', code: "\uf306"
  },
  
  "ti-wash-machine" : {
    iconSet: 'tabler icons', code: "\uf25e"
  },
  
  "ti-wash-off" : {
    iconSet: 'tabler icons', code: "\uf307"
  },
  
  "ti-wash-press" : {
    iconSet: 'tabler icons', code: "\uf308"
  },
  
  "ti-wash-temperature-1" : {
    iconSet: 'tabler icons', code: "\uf309"
  },
  
  "ti-wash-temperature-2" : {
    iconSet: 'tabler icons', code: "\uf30a"
  },
  
  "ti-wash-temperature-3" : {
    iconSet: 'tabler icons', code: "\uf30b"
  },
  
  "ti-wash-temperature-4" : {
    iconSet: 'tabler icons', code: "\uf30c"
  },
  
  "ti-wash-temperature-5" : {
    iconSet: 'tabler icons', code: "\uf30d"
  },
  
  "ti-wash-temperature-6" : {
    iconSet: 'tabler icons', code: "\uf30e"
  },
  
  "ti-wash-tumble-dry" : {
    iconSet: 'tabler icons', code: "\uf30f"
  },
  
  "ti-wash-tumble-off" : {
    iconSet: 'tabler icons', code: "\uf310"
  },
  
  "ti-wave-saw-tool" : {
    iconSet: 'tabler icons', code: "\uecd3"
  },
  
  "ti-wave-sine" : {
    iconSet: 'tabler icons', code: "\uecd4"
  },
  
  "ti-wave-square" : {
    iconSet: 'tabler icons', code: "\uecd5"
  },
  
  "ti-webhook" : {
    iconSet: 'tabler icons', code: "\uf01e"
  },
  
  "ti-webhook-off" : {
    iconSet: 'tabler icons', code: "\uf43d"
  },
  
  "ti-weight" : {
    iconSet: 'tabler icons', code: "\uf589"
  },
  
  "ti-wheelchair" : {
    iconSet: 'tabler icons', code: "\uf1db"
  },
  
  "ti-wheelchair-off" : {
    iconSet: 'tabler icons', code: "\uf43e"
  },
  
  "ti-whirl" : {
    iconSet: 'tabler icons', code: "\uf51d"
  },
  
  "ti-wifi" : {
    iconSet: 'tabler icons', code: "\ueb52"
  },
  
  "ti-wifi-0" : {
    iconSet: 'tabler icons', code: "\ueba3"
  },
  
  "ti-wifi-1" : {
    iconSet: 'tabler icons', code: "\ueba4"
  },
  
  "ti-wifi-2" : {
    iconSet: 'tabler icons', code: "\ueba5"
  },
  
  "ti-wifi-off" : {
    iconSet: 'tabler icons', code: "\uecfa"
  },
  
  "ti-wind" : {
    iconSet: 'tabler icons', code: "\uec34"
  },
  
  "ti-wind-off" : {
    iconSet: 'tabler icons', code: "\uf1c7"
  },
  
  "ti-windmill" : {
    iconSet: 'tabler icons', code: "\ued85"
  },
  
  "ti-windmill-filled" : {
    iconSet: 'tabler icons', code: "\uf6b2"
  },
  
  "ti-windmill-off" : {
    iconSet: 'tabler icons', code: "\uf1c8"
  },
  
  "ti-window" : {
    iconSet: 'tabler icons', code: "\uef06"
  },
  
  "ti-window-maximize" : {
    iconSet: 'tabler icons', code: "\uf1f1"
  },
  
  "ti-window-minimize" : {
    iconSet: 'tabler icons', code: "\uf1f2"
  },
  
  "ti-window-off" : {
    iconSet: 'tabler icons', code: "\uf1c9"
  },
  
  "ti-windsock" : {
    iconSet: 'tabler icons', code: "\uf06d"
  },
  
  "ti-wiper" : {
    iconSet: 'tabler icons', code: "\uecab"
  },
  
  "ti-wiper-wash" : {
    iconSet: 'tabler icons', code: "\uecaa"
  },
  
  "ti-woman" : {
    iconSet: 'tabler icons', code: "\ueb53"
  },
  
  "ti-wood" : {
    iconSet: 'tabler icons', code: "\uf359"
  },
  
  "ti-world" : {
    iconSet: 'tabler icons', code: "\ueb54"
  },
  
  "ti-world-bolt" : {
    iconSet: 'tabler icons', code: "\uf9d9"
  },
  
  "ti-world-cancel" : {
    iconSet: 'tabler icons', code: "\uf9da"
  },
  
  "ti-world-check" : {
    iconSet: 'tabler icons', code: "\uf9db"
  },
  
  "ti-world-code" : {
    iconSet: 'tabler icons', code: "\uf9dc"
  },
  
  "ti-world-cog" : {
    iconSet: 'tabler icons', code: "\uf9dd"
  },
  
  "ti-world-dollar" : {
    iconSet: 'tabler icons', code: "\uf9de"
  },
  
  "ti-world-down" : {
    iconSet: 'tabler icons', code: "\uf9df"
  },
  
  "ti-world-download" : {
    iconSet: 'tabler icons', code: "\uef8a"
  },
  
  "ti-world-exclamation" : {
    iconSet: 'tabler icons', code: "\uf9e0"
  },
  
  "ti-world-heart" : {
    iconSet: 'tabler icons', code: "\uf9e1"
  },
  
  "ti-world-latitude" : {
    iconSet: 'tabler icons', code: "\ued2e"
  },
  
  "ti-world-longitude" : {
    iconSet: 'tabler icons', code: "\ued2f"
  },
  
  "ti-world-minus" : {
    iconSet: 'tabler icons', code: "\uf9e2"
  },
  
  "ti-world-off" : {
    iconSet: 'tabler icons', code: "\uf1ca"
  },
  
  "ti-world-pause" : {
    iconSet: 'tabler icons', code: "\uf9e3"
  },
  
  "ti-world-pin" : {
    iconSet: 'tabler icons', code: "\uf9e4"
  },
  
  "ti-world-plus" : {
    iconSet: 'tabler icons', code: "\uf9e5"
  },
  
  "ti-world-question" : {
    iconSet: 'tabler icons', code: "\uf9e6"
  },
  
  "ti-world-search" : {
    iconSet: 'tabler icons', code: "\uf9e7"
  },
  
  "ti-world-share" : {
    iconSet: 'tabler icons', code: "\uf9e8"
  },
  
  "ti-world-star" : {
    iconSet: 'tabler icons', code: "\uf9e9"
  },
  
  "ti-world-up" : {
    iconSet: 'tabler icons', code: "\uf9ea"
  },
  
  "ti-world-upload" : {
    iconSet: 'tabler icons', code: "\uef8b"
  },
  
  "ti-world-www" : {
    iconSet: 'tabler icons', code: "\uf38f"
  },
  
  "ti-world-x" : {
    iconSet: 'tabler icons', code: "\uf9eb"
  },
  
  "ti-wrecking-ball" : {
    iconSet: 'tabler icons', code: "\ued97"
  },
  
  "ti-writing" : {
    iconSet: 'tabler icons', code: "\uef08"
  },
  
  "ti-writing-off" : {
    iconSet: 'tabler icons', code: "\uf1cb"
  },
  
  "ti-writing-sign" : {
    iconSet: 'tabler icons', code: "\uef07"
  },
  
  "ti-writing-sign-off" : {
    iconSet: 'tabler icons', code: "\uf1cc"
  },
  
  "ti-x" : {
    iconSet: 'tabler icons', code: "\ueb55"
  },
  
  "ti-xbox-a" : {
    iconSet: 'tabler icons', code: "\uf2b6"
  },
  
  "ti-xbox-b" : {
    iconSet: 'tabler icons', code: "\uf2b7"
  },
  
  "ti-xbox-x" : {
    iconSet: 'tabler icons', code: "\uf2b8"
  },
  
  "ti-xbox-y" : {
    iconSet: 'tabler icons', code: "\uf2b9"
  },
  
  "ti-xd" : {
    iconSet: 'tabler icons', code: "\ufa33"
  },
  
  "ti-yin-yang" : {
    iconSet: 'tabler icons', code: "\uec35"
  },
  
  "ti-yin-yang-filled" : {
    iconSet: 'tabler icons', code: "\uf785"
  },
  
  "ti-yoga" : {
    iconSet: 'tabler icons', code: "\uf01f"
  },
  
  "ti-zeppelin" : {
    iconSet: 'tabler icons', code: "\uf270"
  },
  
  "ti-zeppelin-off" : {
    iconSet: 'tabler icons', code: "\uf43f"
  },
  
  "ti-zip" : {
    iconSet: 'tabler icons', code: "\uf3b4"
  },
  
  "ti-zodiac-aquarius" : {
    iconSet: 'tabler icons', code: "\uecac"
  },
  
  "ti-zodiac-aries" : {
    iconSet: 'tabler icons', code: "\uecad"
  },
  
  "ti-zodiac-cancer" : {
    iconSet: 'tabler icons', code: "\uecae"
  },
  
  "ti-zodiac-capricorn" : {
    iconSet: 'tabler icons', code: "\uecaf"
  },
  
  "ti-zodiac-gemini" : {
    iconSet: 'tabler icons', code: "\uecb0"
  },
  
  "ti-zodiac-leo" : {
    iconSet: 'tabler icons', code: "\uecb1"
  },
  
  "ti-zodiac-libra" : {
    iconSet: 'tabler icons', code: "\uecb2"
  },
  
  "ti-zodiac-pisces" : {
    iconSet: 'tabler icons', code: "\uecb3"
  },
  
  "ti-zodiac-sagittarius" : {
    iconSet: 'tabler icons', code: "\uecb4"
  },
  
  "ti-zodiac-scorpio" : {
    iconSet: 'tabler icons', code: "\uecb5"
  },
  
  "ti-zodiac-taurus" : {
    iconSet: 'tabler icons', code: "\uecb6"
  },
  
  "ti-zodiac-virgo" : {
    iconSet: 'tabler icons', code: "\uecb7"
  },
  
  "ti-zoom-cancel" : {
    iconSet: 'tabler icons', code: "\uec4d"
  },
  
  "ti-zoom-check" : {
    iconSet: 'tabler icons', code: "\uef09"
  },
  
  "ti-zoom-check-filled" : {
    iconSet: 'tabler icons', code: "\uf786"
  },
  
  "ti-zoom-code" : {
    iconSet: 'tabler icons', code: "\uf07f"
  },
  
  "ti-zoom-exclamation" : {
    iconSet: 'tabler icons', code: "\uf080"
  },
  
  "ti-zoom-filled" : {
    iconSet: 'tabler icons', code: "\uf787"
  },
  
  "ti-zoom-in" : {
    iconSet: 'tabler icons', code: "\ueb56"
  },
  
  "ti-zoom-in-area" : {
    iconSet: 'tabler icons', code: "\uf1dc"
  },
  
  "ti-zoom-in-area-filled" : {
    iconSet: 'tabler icons', code: "\uf788"
  },
  
  "ti-zoom-in-filled" : {
    iconSet: 'tabler icons', code: "\uf789"
  },
  
  "ti-zoom-money" : {
    iconSet: 'tabler icons', code: "\uef0a"
  },
  
  "ti-zoom-out" : {
    iconSet: 'tabler icons', code: "\ueb57"
  },
  
  "ti-zoom-out-area" : {
    iconSet: 'tabler icons', code: "\uf1dd"
  },
  
  "ti-zoom-out-filled" : {
    iconSet: 'tabler icons', code: "\uf78a"
  },
  
  "ti-zoom-pan" : {
    iconSet: 'tabler icons', code: "\uf1de"
  },
  
  "ti-zoom-question" : {
    iconSet: 'tabler icons', code: "\uedeb"
  },
  
  "ti-zoom-replace" : {
    iconSet: 'tabler icons', code: "\uf2a7"
  },
  
  "ti-zoom-reset" : {
    iconSet: 'tabler icons', code: "\uf295"
  },
  
  "ti-zzz" : {
    iconSet: 'tabler icons', code: "\uf228"
  },
  
  "ti-zzz-off" : {
    iconSet: 'tabler icons', code: "\uf440"
  }
  }
  