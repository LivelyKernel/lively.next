import { string, obj } from "lively.lang";


export default class FontMetric {

  static default() {
    if (!this._fontMetric)
      throw new Error("FontMetric has not yet been initialized!")
    return this._fontMetric;
  }

  static initDefault(domEnv) {
    if (!this._fontMetric) {
      if (!domEnv && typeof document === "undefined")
        throw new Error("Cannot initialize FontMetric without document");
      if (!domEnv) domEnv = {document}
      this._fontMetric = this.forDOMEnv(domEnv);
    }
    return this._fontMetric;
  }

  static removeDefault() {
    if (this._fontMetric) {
      this._fontMetric.uninstall();
      this._fontMetric = null;
    }
  }

  static forDOMEnv({document}) {
    var fontMetric = new FontMetric();
    fontMetric.install(document, document.body);
    return fontMetric;
  }

  constructor() {
    this.charMap = {};
    this.cachedBoundsInfo = {};
    this.element = null;
  }

  reset() {
    var doc, parentNode;
    if (this.element) {
      parentNode = this.element.parentNode;
      doc = this.element.ownerDocument;
    }
    this.uninstall()
    this.charMap = {};
    this.cachedBoundsInfo = {};
    if (doc && parentNode)
      this.install(doc, parentNode);
  }

  install(doc, parentEl) {
    this.element = doc.createElement("div");
    this.element.name = "fontMetric";
    this.setMeasureNodeStyles(this.element.style, true);
    parentEl.appendChild(this.element);
    this._domMeasure = new DOMTextMeasure().install(doc, parentEl);
  }

  uninstall() {
    if (!this.element) return
    if (this.element.parentNode) this.element.parentNode.removeChild(this.element);
    this.element = null;
    if (this._domMeasure) this._domMeasure.uninstall();
  }

  setMeasureNodeStyles(style, isRoot) {
    style.width = style.height = "auto";
    style.left = style.top = "0px";
    style.visibility = "hidden";
    style.position = "absolute";
    style.whiteSpace = "pre";
    style.font = "inherit";
    style.overflow = isRoot ? "hidden" : "visible";
  }

  measure(style, text) {
    var { fontFamily, fontSize, fontWeight, fontStyle, textDecoration, textStyleClasses } = style,
        el = this.element,
        rect = null;
    el.textContent = text;
    Object.assign(el.style, {
      fontFamily, fontWeight, fontStyle, textDecoration,
      fontSize: fontSize + "px",
    })
    el.className = textStyleClasses ? textStyleClasses.join(" ") : "";
    var width, height;
    try {
      ({width, height} = el.getBoundingClientRect());
    } catch(e) { return {width: 0, height:0}; };

    return {height, width}
  }

  charBoundsFor(style, str) {
    let nCols = str.length,
        bounds = new Array(nCols),
        { cachedBoundsInfo: { bounds: cachedBounds, str: cachedStr, style: cachedStyle } } = this,
        isMonospace = !this.isProportional(style.fontFamily);

    if (isMonospace) {
      // measuring a single char does not give us a precise width
      var single = this.sizeFor(style, "x", true),
          double = this.sizeFor(style, "xx", true),
          width = double.width - single.width,
          height = single.height, x = 0;
      for (var i = 0; i < nCols; i++) {
        x = width*i;
        bounds[i]= {x, y: 0, width, height};
      }
    } else {
      var useCache = cachedBounds && obj.equals(cachedStyle, style),
          adjustSpacing = !style.fixedCharacterSpacing;

      for (let col = 0, x = 0; col < nCols; col++) {
        let width, height, char = str[col];
        if (adjustSpacing) {
          useCache = useCache && char === cachedStr[col];
          if (useCache)
            ({ width, height } = cachedBounds[col]);
          else {
            let prefix = str.substr(0, col+1);
            ({ width, height } = this.measure(style, prefix));
            width -= x;
          }
        } else {
          ({ width, height } = this.sizeFor(style, char));
        }
        bounds[col] = { x, y: 0, width, height };
        x = x + width;
      }
      if (adjustSpacing) this.cachedBoundsInfo = { bounds, str, style };

    }

    return bounds;
  }

  isProportional(fontFamily) {
    let style = { fontFamily, fontSize: 12 },
        w_width = this.sizeFor(style, 'w').width,
        i_width = this.sizeFor(style, 'i').width;
    return w_width !== i_width;
  }

  sizeFor(style, string, forceCache = false) {
    // Select style properties relevant to individual character size
    let { fontFamily, fontSize,
          fontWeight, fontStyle, textDecoration, textStyleClasses } = style,
        relevantStyle = { fontFamily, fontSize,
                          fontWeight, fontStyle, textDecoration, textStyleClasses };

    if (!forceCache && string.length > 1) return this.measure(relevantStyle, string);

    let className = textStyleClasses ? textStyleClasses.join(" ") : "";
    let styleKey = [fontFamily, fontSize, fontWeight, fontStyle, textDecoration, className].join('-');

    if (!this.charMap[styleKey])
      this.charMap[styleKey] = {};
    if (!this.charMap[styleKey][string])
      this.charMap[styleKey][string] = this.measure(relevantStyle, string);

    return this.charMap[styleKey][string];
  }

  asciiSizes(style) {
    var result = {};
    for (var i = 32; i <= 126; i++) {
      var char = String.fromCharCode(i);
      result[char] = this.sizeFor(style, char)
    }
    return result;
  }

  defaultLineHeight(style) {
    return this.sizeFor(style, " ").height;
  }

  isFontSupported(font) {
    let fd = this.fontDetector || (this.fontDetector = new FontDetector(this.element.ownerDocument));
    return fd.isFontSupported(font);
  }

  defaultCharExtent(styleOpts, styleKey) { return this._domMeasure.defaultCharExtent(styleOpts, styleKey); }

  manuallyComputeCharBoundsOfLine(line, offsetX = 0, offsetY = 0, styleOpts, styleKey, renderLineFn) {
    return this._domMeasure.manuallyComputeCharBoundsOfLine(
      line, offsetX, offsetY, styleOpts, styleKey, renderLineFn);
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// font detection

class FontDetector {
  /**
   * JavaScript code to detect available availability of a
   * particular font in a browser using JavaScript and CSS.
   *
   * Author : Lalit Patel
   * Website: http://www.lalit.org/lab/javascript-css-font-detect/
   * License: Apache Software License 2.0
   *          http://www.apache.org/licenses/LICENSE-2.0
   */
  // a font will be compared against all the three default fonts.
  // and if it doesn't match all 3 then that font is not available.

  constructor(document) {
    this.document = document;
    this.prepared = false;
    this.defaultWidth = {};
    this.defaultHeight = {};
    this.baseFonts = ['monospace', 'sans-serif', 'serif'];
    this.span = null;
  }

  prepare() {
    var defaultWidth = this.defaultWidth,
        defaultHeight = this.defaultHeight,
        baseFonts = this.baseFonts,
        // we use m or w because these two characters take up the maximum width.
        // And we use a LLi so that the same matching fonts can get separated
        testString = "mmmmmmmmmmlli",
        // we test using 72px font size, we may use any size. I guess larger the better.
        testSize = '72px',
        h = this.document.getElementsByTagName("body")[0],
        // create a SPAN in the document to get the width of the text we use to test
        s = this.span = this.document.createElement("span");
    s.style.fontSize = testSize;
    s.innerHTML = testString;
    for (let index in baseFonts) {
      //get the default width for the three base fonts
      s.style.fontFamily = baseFonts[index];
      h.appendChild(s);
      defaultWidth[baseFonts[index]] = s.offsetWidth; //width for the default font
      defaultHeight[baseFonts[index]] = s.offsetHeight; //height for the defualt font
      h.removeChild(s);
    }
    this.prepared = true;
  }

  isFontSupported(font) {
    if (!this.prepared) this.prepare();

    let {
      defaultWidth, defaultHeight,
      baseFonts, span,
      document: {body}
    } = this;

    try {
      body.appendChild(span);
      for (let index in baseFonts) {
        span.style.fontFamily = font + ',' + baseFonts[index]; // name of the font along with the base font for fallback.
        let matched = (span.offsetWidth != defaultWidth[baseFonts[index]]
                    || span.offsetHeight != defaultHeight[baseFonts[index]]);
        if (matched) return true;
      }
      return false;
    } finally { body.removeChild(span); }
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// complete list of google fonts:
// let googleFonts = await resource("https://raw.githubusercontent.com/jonathantneal/google-fonts-complete/master/google-fonts.json").readJson();
//
// list below is based on
//   https://en.wikipedia.org/wiki/List_of_typefaces
// and a selected list of google fonts
export const fonts = [
  {name: "serif",      type: "default"},
  {name: "sans-serif", type: "default"},
  {name: "monospace",  type: "default"},

  {name: "Adobe Jenson",                       type: "serif"},
  {name: "Albertus",                           type: "serif"},
  {name: "Aldus",                              type: "serif"},
  {name: "Alexandria",                         type: "serif"},
  {name: "Algerian",                           type: "serif"},
  {name: "American Typewriter",                type: "serif"},
  {name: "Antiqua",                            type: "serif"},
  {name: "Arno",                               type: "serif"},
  {name: "Aster",                              type: "serif"},
  {name: "Aurora",                             type: "serif"},
  {name: "News 706",                           type: "serif"},
  {name: "Baskerville",                        type: "serif"},
  {name: "Bell",                               type: "serif"},
  {name: "Belwe Roman",                        type: "serif"},
  {name: "Bembo",                              type: "serif"},
  {name: "Berkeley Old Style",                 type: "serif"},
  {name: "Bernhard Modern",                    type: "serif"},
  {name: "Bodoni",                             type: "serif"},
  {name: "Book Antiqua",                       type: "serif"},
  {name: "Bookman",                            type: "serif"},
  {name: "Bulmer",                             type: "serif"},
  {name: "Caledonia",                          type: "serif"},
  {name: "Californian FB",                     type: "serif"},
  {name: "Calisto MT",                         type: "serif"},
  {name: "Cambria",                            type: "serif"},
  {name: "Capitals",                           type: "serif"},
  {name: "Cartier",                            type: "serif"},
  {name: "Caslon",                             type: "serif"},
  {name: "Wyld",                               type: "serif"},
  {name: "Caslon Antique / Fifteenth Century", type: "serif"},
  {name: "Catull",                             type: "serif"},
  {name: "Centaur",                            type: "serif"},
  {name: "Century Old Style",                  type: "serif"},
  {name: "Century Schoolbook",                 type: "serif"},
  {name: "New Century Schoolbook",             type: "serif"},
  {name: "Century Schoolbook Infant",          type: "serif"},
  {name: "Charis SIL",                         type: "serif"},
  {name: "Charter (typeface)",                 type: "serif"},
  {name: "Cheltenham",                         type: "serif"},
  {name: "Clearface",                          type: "serif"},
  {name: "Cochin",                             type: "serif"},
  {name: "Colonna",                            type: "serif"},
  {name: "Computer Modern",                    type: "serif"},
  {name: "Concrete Roman",                     type: "serif"},
  {name: "Constantia",                         type: "serif"},
  {name: "Cooper Black",                       type: "serif"},
  {name: "Copperplate Gothic",                 type: "serif"},
  {name: "Corona",                             type: "serif"},
  {name: "News 705",                           type: "serif"},
  {name: "DejaVu Serif",                       type: "serif"},
  {name: "Didot",                              type: "serif"},
  {name: "Droid Serif",                        type: "serif"},
  {name: "Elephant",                           type: "serif"},
  {name: "Emerson",                            type: "serif"},
  {name: "Excelsior",                          type: "serif"},
  {name: "News 702",                           type: "serif"},
  {name: "Fairfield",                          type: "serif"},
  {name: "FF Scala",                           type: "serif"},
  {name: "Footlight",                          type: "serif"},
  {name: "FreeSerif",                          type: "serif"},
  {name: "Friz Quadrata",                      type: "serif"},
  {name: "Garamond",                           type: "serif"},
  {name: "Gentium",                            type: "serif"},
  {name: "Georgia",                            type: "serif"},
  {name: "Gloucester",                         type: "serif"},
  {name: "Goudy",                              type: "serif"},
  {name: "Granjon",                            type: "serif"},
  {name: "High Tower Text",                    type: "serif"},
  {name: "Hoefler Text",                       type: "serif"},
  {name: "Imprint",                            type: "serif"},
  {name: "Ionic No. 5",                        type: "serif"},
  {name: "News 701",                           type: "serif"},
  {name: "ITC Benguiat",                       type: "serif"},
  {name: "Janson",                             type: "serif"},
  {name: "Jokerman",                           type: "serif"},
  {name: "Joanna",                             type: "serif"},
  {name: "Korinna",                            type: "serif"},
  {name: "Lexicon",                            type: "serif"},
  {name: "Liberation Serif",                   type: "serif"},
  {name: "Linux Libertine",                    type: "serif"},
  {name: "Literaturnaya",                      type: "serif"},
  {name: "Lucida Bright",                      type: "serif"},
  {name: "Melior",                             type: "serif"},
  {name: "Memphis",                            type: "serif"},
  {name: "Miller",                             type: "serif"},
  {name: "Minion",                             type: "serif"},
  {name: "Modern",                             type: "serif"},
  {name: "Mona Lisa",                          type: "serif"},
  {name: "Mrs Eaves",                          type: "serif"},
  {name: "MS Serif",                           type: "serif"},
  {name: "New York",                           type: "serif"},
  {name: "Nimbus Roman",                       type: "serif"},
  {name: "NPS Rawlinson Roadway",              type: "serif"},
  {name: "OCR A Extended",                     type: "serif"},
  {name: "Palatino",                           type: "serif"},
  {name: "Book Antiqua",                       type: "serif"},
  {name: "Perpetua",                           type: "serif"},
  {name: "Plantin",                            type: "serif"},
  {name: "Playbill",                           type: "serif"},
  {name: "Primer",                             type: "serif"},
  {name: "Renault",                            type: "serif"},
  {name: "Requiem",                            type: "serif"},
  {name: "Rotis Serif",                        type: "serif"},
  {name: "Sabon",                              type: "serif"},
  {name: "Sistina",                            type: "serif"},
  {name: "Souvenir",                           type: "serif"},
  {name: "XITS",                               type: "serif"},
  {name: "Sylfaen",                            type: "serif"},
  {name: "Times New Roman",                    type: "serif"},
  {name: "Times",                              type: "serif"},
  {name: "Torino",                             type: "serif"},
  {name: "Trajan",                             type: "serif"},
  {name: "Trinité",                            type: "serif"},
  {name: "Trump Mediaeval",                    type: "serif"},
  {name: "Utopia",                             type: "serif"},
  {name: "Vera Serif",                         type: "serif"},
  {name: "Wide Latin",                         type: "serif"},
  {name: "Windsor",                            type: "serif"},
  {name: "XITS",                               type: "serif"},

  {name: "Playfair Display",  type: "serif", isGoogleFont: true},
  {name: "Cormorant",         type: "serif", isGoogleFont: true},
  {name: "Eczar",             type: "serif", isGoogleFont: true},
  {name: "Alegreya",          type: "serif", isGoogleFont: true},
  {name: "Lora",              type: "serif", isGoogleFont: true},
  {name: "Source Serif Pro",  type: "serif", isGoogleFont: true},
  {name: "Roboto Slab",       type: "serif", isGoogleFont: true},
  {name: "BioRhyme",          type: "serif", isGoogleFont: true},
  {name: "Libre Baskerville", type: "serif", isGoogleFont: true},
  {name: "Crimson Text",      type: "serif", isGoogleFont: true},
  {name: "Old Standard TT",   type: "serif", isGoogleFont: true},
  {name: "Domine",            type: "serif", isGoogleFont: true},
  {name: "Bitter",            type: "serif", isGoogleFont: true},
  {name: "Gentium Basic",     type: "serif", isGoogleFont: true},
  {name: "PT Serif",          type: "serif", isGoogleFont: true},
  {name: "Cardo",             type: "serif", isGoogleFont: true},
  {name: "Neuton",            type: "serif", isGoogleFont: true},
  {name: "Arvo",              type: "serif", isGoogleFont: true},
  {name: "Merriweather",      type: "serif", isGoogleFont: true},

  // slab serif
  {name: "Alexandria",          type: "slab serif"},
  {name: "American Typewriter", type: "slab serif"},
  {name: "Archer",              type: "slab serif"},
  {name: "Athens",              type: "slab serif"},
  {name: "Candida",             type: "slab serif"},
  {name: "Cholla Slab",         type: "slab serif"},
  {name: "City",                type: "slab serif"},
  {name: "Clarendon",           type: "slab serif"},
  {name: "Concrete Roman",      type: "slab serif"},
  {name: "Courier",             type: "slab serif"},
  {name: "Egyptienne",          type: "slab serif"},
  {name: "Guardian Egyptian",   type: "slab serif"},
  {name: "Ionic No. 5",         type: "slab serif"},
  {name: "Lexia",               type: "slab serif"},
  {name: "Memphis",             type: "slab serif"},
  {name: "Nilland",             type: "slab serif"},
  {name: "Roboto Slab",         type: "slab serif"},
  {name: "Rockwell",            type: "slab serif"},
  {name: "Schadow",             type: "slab serif"},
  {name: "Serifa",              type: "slab serif"},
  {name: "Skeleton Antique",    type: "slab serif"},
  {name: "Sreda",               type: "slab serif"},
  {name: "Swift",               type: "slab serif"},
  {name: "Tower",               type: "slab serif"},


  {name: "Agency FB",                     type: "sans-serif"},
  {name: "Akzidenz-Grotesk",              type: "sans-serif"},
  {name: "Andalé Sans",                   type: "sans-serif"},
  {name: "Antique Olive",                 type: "sans-serif"},
  {name: "Arial",                         type: "sans-serif"},
  {name: "Arial Unicode MS",              type: "sans-serif"},
  {name: "Avant Garde Gothic",            type: "sans-serif"},
  {name: "Avenir",                        type: "sans-serif"},
  {name: "Bank Gothic",                   type: "sans-serif"},
  {name: "Bauhaus",                       type: "sans-serif"},
  {name: "Bell Centennial",               type: "sans-serif"},
  {name: "Bell Gothic",                   type: "sans-serif"},
  {name: "Benguiat Gothic",               type: "sans-serif"},
  {name: "Berlin Sans",                   type: "sans-serif"},
  {name: "Brandon Grotesque",             type: "sans-serif"},
  {name: "Calibri",                       type: "sans-serif"},
  {name: "Casey",                         type: "sans-serif"},
  {name: "Century Gothic",                type: "sans-serif"},
  {name: "Charcoal",                      type: "sans-serif"},
  {name: "Chicago",                       type: "sans-serif"},
  {name: "Clearview",                     type: "sans-serif"},
  {name: "Comic Sans",                    type: "sans-serif"},
  {name: "Compacta",                      type: "sans-serif"},
  {name: "Corbel",                        type: "sans-serif"},
  {name: "DejaVu Sans",                   type: "sans-serif"},
  {name: "DIN",                           type: "sans-serif"},
  {name: "Dotum",                         type: "sans-serif"},
  {name: "Droid Sans",                    type: "sans-serif"},
  {name: "Dyslexie",                      type: "sans-serif"},
  {name: "Ecofont",                       type: "sans-serif"},
  {name: "Eras",                          type: "sans-serif"},
  {name: "Esseltub",                      type: "sans-serif"},
  {name: "Espy Sans",                     type: "sans-serif"},
  {name: "Eurocrat",                      type: "sans-serif"},
  {name: "Eurostile",                     type: "sans-serif"},
  {name: "Square 721",                    type: "sans-serif"},
  {name: "FF Dax",                        type: "sans-serif"},
  {name: "FF Meta",                       type: "sans-serif"},
  {name: "FF Scala Sans",                 type: "sans-serif"},
  {name: "Fira Sans",                     type: "sans-serif"},
  {name: "Folio",                         type: "sans-serif"},
  {name: "Franklin Gothic",               type: "sans-serif"},
  {name: "FreeSans",                      type: "sans-serif"},
  {name: "Frutiger",                      type: "sans-serif"},
  {name: "Futura",                        type: "sans-serif"},
  {name: "Geneva",                        type: "sans-serif"},
  {name: "Gill Sans",                     type: "sans-serif"},
  {name: "Gill Sans Schoolbook",          type: "sans-serif"},
  {name: "Gotham",                        type: "sans-serif"},
  {name: "Haettenschweiler",              type: "sans-serif"},
  {name: "Handel Gothic",                 type: "sans-serif"},
  {name: "Hei",                           type: "sans-serif"},
  {name: "Helvetica",                     type: "sans-serif"},
  {name: "Helvetica Neue",                type: "sans-serif"},
  {name: "Swiss 721",                     type: "sans-serif"},
  {name: "Highway Gothic",                type: "sans-serif"},
  {name: "Hobo",                          type: "sans-serif"},
  {name: "Impact",                        type: "sans-serif"},
  {name: "Industria",                     type: "sans-serif"},
  {name: "Interstate",                    type: "sans-serif"},
  {name: "Johnston/New Johnston",         type: "sans-serif"},
  {name: "Kabel",                         type: "sans-serif"},
  {name: "Klavika",                       type: "sans-serif"},
  {name: "Lexia Readable",                type: "sans-serif"},
  {name: "Liberation Sans",               type: "sans-serif"},
  {name: "Linux Biolinum",                type: "sans-serif"},
  {name: "Lucida Sans",                   type: "sans-serif"},
  {name: "Lucida Grande",                 type: "sans-serif"},
  {name: "Lucida Sans Unicode",           type: "sans-serif"},
  {name: "Lydian",                        type: "sans-serif"},
  {name: "Meiryo",                        type: "sans-serif"},
  {name: "Meta",                          type: "sans-serif"},
  {name: "Microgramma",                   type: "sans-serif"},
  {name: "Modern",                        type: "sans-serif"},
  {name: "Motorway",                      type: "sans-serif"},
  {name: "Arial",                         type: "sans-serif"},
  {name: "Myriad",                        type: "sans-serif"},
  {name: "Neutraface",                    type: "sans-serif"},
  {name: "Neuzeit S",                     type: "sans-serif"},
  {name: "News Gothic",                   type: "sans-serif"},
  {name: "Nimbus Sans L",                 type: "sans-serif"},
  {name: "Open Sans",                     type: "sans-serif"},
  {name: "Optima",                        type: "sans-serif"},
  {name: "Paris",                         type: "sans-serif"},
  {name: "Product Sans",                  type: "sans-serif"},
  {name: "Proxima Nova",                  type: "sans-serif"},
  {name: "Russian Federation",            type: "sans-serif"},
  {name: "Rail Alphabet",                 type: "sans-serif"},
  {name: "Roboto",                        type: "sans-serif"},
  {name: "Rotis Sans",                    type: "sans-serif"},
  {name: "Segoe UI",                      type: "sans-serif"},
  {name: "Skia",                          type: "sans-serif"},
  {name: "Source Sans Pro",               type: "sans-serif"},
  {name: "Sweden Sans",                   type: "sans-serif"},
  {name: "Syntax",                        type: "sans-serif"},
  {name: "Tahoma",                        type: "sans-serif"},
  {name: "Template Gothic",               type: "sans-serif"},
  {name: "Thesis Sans",                   type: "sans-serif"},
  {name: "Tiresias",                      type: "sans-serif"},
  {name: "Trade Gothic",                  type: "sans-serif"},
  {name: "Transport",                     type: "sans-serif"},
  {name: "Trebuchet MS",                  type: "sans-serif"},
  {name: "Twentieth Century (Tw Cen MT)", type: "sans-serif"},
  {name: "Ubuntu",                        type: "sans-serif"},
  {name: "Univers",                       type: "sans-serif"},
  {name: "Zurich",                        type: "sans-serif"},
  {name: "Vera Sans",                     type: "sans-serif"},
  {name: "Verdana",                       type: "sans-serif"},

  {name: "Work Sans",         type: "sans-serif", isGoogleFont: true},
  {name: "Rubik",             type: "sans-serif", isGoogleFont: true},
  {name: "Libre Franklin",    type: "sans-serif", isGoogleFont: true},
  {name: "Fira Sans",         type: "sans-serif", isGoogleFont: true},
  {name: "Alegreya Sans",     type: "sans-serif", isGoogleFont: true},
  {name: "Chivo",             type: "sans-serif", isGoogleFont: true},
  {name: "Source Sans Pro",   type: "sans-serif", isGoogleFont: true},
  {name: "Roboto",            type: "sans-serif", isGoogleFont: true},
  {name: "Poppins",           type: "sans-serif", isGoogleFont: true},
  {name: "Archivo Narrow",    type: "sans-serif", isGoogleFont: true},
  {name: "Karla",             type: "sans-serif", isGoogleFont: true},
  {name: "Montserrat",        type: "sans-serif", isGoogleFont: true},
  {name: "Rajdhani",          type: "sans-serif", isGoogleFont: true},
  {name: "PT Sans",           type: "sans-serif", isGoogleFont: true},
  {name: "Lato",              type: "sans-serif", isGoogleFont: true},
  {name: "Open Sans",         type: "sans-serif", isGoogleFont: true},
  {name: "Cabin",             type: "sans-serif", isGoogleFont: true},
  {name: "Raleway",           type: "sans-serif", isGoogleFont: true},

  {name: "Nyala",            type: "semi-serif"},
  {name: "Rotis Semi Serif", type: "semi-serif"},
  {name: "Easyreading",      type: "semi-serif"},

  {name: "Andalé Mono",                     type: "monospace"},
  {name: "Arial",                           type: "monospace"},
  {name: "Bitstream Vera (Vera Sans Mono)", type: "monospace"},
  {name: "Consolas",                        type: "monospace"},
  {name: "Courier",                         type: "monospace"},
  {name: "Courier New",                     type: "monospace"},
  {name: "DejaVu Sans Mono",                type: "monospace"},
  {name: "Droid Sans Mono",                 type: "monospace"},
  {name: "Everson Mono",                    type: "monospace"},
  {name: "Fixed",                           type: "monospace"},
  {name: "Fixedsys",                        type: "monospace"},
  {name: "Fixedsys Excelsior",              type: "monospace"},
  {name: "HyperFont",                       type: "monospace"},
  {name: "Inconsolata",                     type: "monospace"},
  {name: "Letter Gothic",                   type: "monospace"},
  {name: "Liberation Mono",                 type: "monospace"},
  {name: "Lucida Console",                  type: "monospace"},
  {name: "Lucida Sans Typewriter",          type: "monospace"},
  {name: "Lucida Typewriter",               type: "monospace"},
  {name: "Menlo",                           type: "monospace"},
  {name: "MICR",                            type: "monospace"},
  {name: "Monaco",                          type: "monospace"},
  {name: "Monospace",                       type: "monospace"},
  {name: "MS Gothic",                       type: "monospace"},
  {name: "MS Mincho",                       type: "monospace"},
  {name: "Nimbus Mono L",                   type: "monospace"},
  {name: "OCR-A",                           type: "monospace"},
  {name: "OCR-B",                           type: "monospace"},
  {name: "PragmataPro",                     type: "monospace"},
  {name: "Prestige Elite",                  type: "monospace"},
  {name: "ProFont",                         type: "monospace"},
  {name: "Proggy programming fonts",        type: "monospace"},
  {name: "SimHei",                          type: "monospace"},
  {name: "SimSun",                          type: "monospace"},
  {name: "Source Code Pro",                 type: "monospace"},
  {name: "Terminal",                        type: "monospace"},
  {name: "Trixie",                          type: "monospace"},
  {name: "Ubuntu Mono",                     type: "monospace"},
  {name: "Vera Sans Mono (Bitstream Vera)", type: "monospace"},

  {name: "Space Mono",        type: "monospace", isGoogleFont: true},
  {name: "Inconsolata",       type: "monospace", isGoogleFont: true},
  {name: "Anonymous Pro",     type: "monospace", isGoogleFont: true},

  {name: "Balloon",      type: "script"},
  {name: "Brush Script", type: "script"},
  {name: "Choc",         type: "script"},
  {name: "Dom Casual",   type: "script"},
  {name: "Mistral",      type: "script"},
  {name: "Papyrus",      type: "script"},
  {name: "Segoe Script", type: "script"},
  {name: "Utopia",       type: "script"},
  {name: "Coronet",         type: "script"},
  {name: "Curlz",           type: "script"},
  {name: "Gravura",         type: "script"},
  {name: "Script",          type: "script"},
  {name: "Wiesbaden Swing", type: "script"},

  {name: "American Scribe",     type: "script"},
  {name: "AMS Euler",           type: "script"},
  {name: "Apple Chancery",      type: "script"},
  {name: "Forte",               type: "script"},
  {name: "French Script",       type: "script"},
  {name: "ITC Zapf Chancery",   type: "script"},
  {name: "Kuenstler Script",    type: "script"},
  {name: "Monotype Corsiva",    type: "script"},
  {name: "Old English Text MT", type: "script"},
  {name: "Zapfino",             type: "script"},

  {name: "Andy",               type: "handwriting"},
  {name: "Ashley Script",      type: "handwriting"},
  {name: "Cézanne",            type: "handwriting"},
  {name: "Chalkboard",         type: "handwriting"},
  {name: "Comic Sans MS",      type: "handwriting"},
  {name: "Dom Casual",         type: "handwriting"},
  {name: "Kristen",            type: "handwriting"},
  {name: "Lucida Handwriting", type: "handwriting"},


  {name: "Bastard",            type: "blackletter"},
  {name: "Breitkopf Fraktur",  type: "blackletter"},
  {name: "Cloister Black",     type: "blackletter"},
  {name: "Fette Fraktur",      type: "blackletter"},
  {name: "Fletcher",           type: "blackletter"},
  {name: "Fraktur",            type: "blackletter"},
  {name: "Lucida Blackletter", type: "blackletter"},
  {name: "Old English Text",   type: "blackletter"},
  {name: "Schwabacher",        type: "blackletter"},


  {name: "Aharoni",             type: "non-latin"},
  {name: "Aparajita",           type: "non-latin"},
  {name: "Arial",               type: "non-latin"},
  {name: "Calibri",             type: "non-latin"},
  {name: "Chandas",             type: "non-latin"},
  {name: "Gadugi",              type: "non-latin"},
  {name: "Grecs du roi",        type: "non-latin"},
  {name: "Javanese script",     type: "non-latin"},
  {name: "Japanese Gothic",     type: "non-latin"},
  {name: "Jomolhari",           type: "non-latin"},
  {name: "Kiran",               type: "non-latin"},
  {name: "Kochi",               type: "non-latin"},
  {name: "Koren",               type: "non-latin"},
  {name: "Kruti Dev",           type: "non-latin"},
  {name: "Malgun Gothic",       type: "non-latin"},
  {name: "Meiryo",              type: "non-latin"},
  {name: "Microsoft JhengHei",  type: "non-latin"},
  {name: "Microsoft YaHei",     type: "non-latin"},
  {name: "Minchō",              type: "non-latin"},
  {name: "Ming",                type: "non-latin"},
  {name: "Mona",                type: "non-latin"},
  {name: "MS Gothic",           type: "non-latin"},
  {name: "Nastaliq Navees",     type: "non-latin"},
  {name: "Porson",              type: "non-latin"},
  {name: "Segoe UI Symbol",     type: "non-latin"},
  {name: "Shruti",              type: "non-latin"},
  {name: "SimSun",              type: "non-latin"},
  {name: "Sylfaen",             type: "non-latin"},
  {name: "Tahoma",              type: "non-latin"},
  {name: "Tengwar",             type: "non-latin"},
  {name: "Tibetan Machine Uni", type: "non-latin"},
  {name: "Wilson Greek",        type: "non-latin"},

  {name: "SMP",                  type: "unicode"},
  {name: "Microsoft Office",     type: "unicode"},
  {name: "Bitstream Cyberbit",   type: "unicode"},
  {name: "DejaVu fonts",         type: "unicode"},
  {name: "Charis SIL",           type: "unicode"},
  {name: "BMP",                  type: "unicode"},
  {name: "SMP",                  type: "unicode"},
  {name: "Code2002",             type: "unicode"},
  {name: "DejaVu fonts",         type: "unicode"},
  {name: "IPA",                  type: "unicode"},
  {name: "Everson Mono",         type: "unicode"},
  {name: "Windows",              type: "unicode"},
  {name: "Fixedsys Excelsior",   type: "unicode"},
  {name: "FreeFont",             type: "unicode"},
  {name: "Gentium",              type: "unicode"},
  {name: "GNU Unifont",          type: "unicode"},
  {name: "Georgia Ref",          type: "unicode"},
  {name: "Microsoft Office",     type: "unicode"},
  {name: "Junicode",             type: "unicode"},
  {name: "Mac OS 8.5",           type: "unicode"},
  {name: "macOS",                type: "unicode"},
  {name: "ISO 8859-x",           type: "unicode"},
  {name: "MS Gothic",            type: "unicode"},
  {name: "MS Mincho",            type: "unicode"},
  {name: "Nimbus Sans Global",   type: "unicode"},
  {name: "Noto",                 type: "unicode"},
  {name: "Fabrizio Schiavi",     type: "unicode"},
  {name: "Squarish Sans CT",     type: "unicode"},
  {name: "XITS",                 type: "unicode"},
  {name: "Titus Cyberbit Basic", type: "unicode"},
  {name: "Verdana Ref",          type: "unicode"},
  {name: "XITS",                 type: "unicode"},

  {name: "Apple Symbols",      type: "symbol"},
  {name: "Asana-Math",         type: "symbol"},
  {name: "Blackboard bold",    type: "symbol"},
  {name: "Bookshelf Symbol 7", type: "symbol"},
  {name: "Cambria Math",       type: "symbol"},
  {name: "Computer Modern",    type: "symbol"},
  {name: "Lucida Math",        type: "symbol"},
  {name: "Marlett",            type: "symbol"},
  {name: "Symbol",             type: "symbol"},
  {name: "Webdings",           type: "symbol"},
  {name: "Wingdings",          type: "symbol"},
  {name: "Wingdings 2",        type: "symbol"},
  {name: "Wingdings 3",        type: "symbol"},
  {name: "Zapf Dingbats",      type: "symbol"},

  {name: "Ad Lib",         type: "decorative"},
  {name: "Allegro",        type: "decorative"},
  {name: "Andreas",        type: "decorative"},
  {name: "Arnold Böcklin", type: "decorative"},
  {name: "Astur",          type: "decorative"},
  {name: "Banco",          type: "decorative"},
  {name: "Bauhaus",        type: "decorative"},
  {name: "Braggadocio",    type: "decorative"},
  {name: "Broadway",       type: "decorative"},
  {name: "Caslon Antique", type: "decorative"},
  {name: "Cooper Black",   type: "decorative"},
  {name: "Curlz",          type: "decorative"},
  {name: "Ellington",      type: "decorative"},
  {name: "Exocet",         type: "decorative"},
  {name: "FIG Script",     type: "decorative"},
  {name: "Forte",          type: "decorative"},
  {name: "Gabriola",       type: "decorative"},
  {name: "Horizon",        type: "decorative"},
  {name: "Jim Crow",       type: "decorative"},
  {name: "Lo-Type",        type: "decorative"},
  {name: "Neuland",        type: "decorative"},
  {name: "Peignot",        type: "decorative"},
  {name: "San Francisco",  type: "decorative"},
  {name: "Stencil",        type: "decorative"},
  {name: "Umbra",          type: "decorative"},
  {name: "Westminster",    type: "decorative"},
  {name: "Willow",         type: "decorative"},
  {name: "Windsor",        type: "decorative"},

  // Mimicry
  {name: "Lithos", type: "mimicry"},
  {name: "Skia",   type: "mimicry"},

  {name: "3x3",      type: "misc"},
  {name: "Compatil", type: "misc"},
  {name: "Generis",  type: "misc"},
  {name: "Grasset",  type: "misc"},
  {name: "LED",      type: "misc"},
  {name: "Luxi",     type: "misc"},
  {name: "System",   type: "misc"}
];


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// new text measure implementation

// Unicode characters that are considered "extending", i.e. treated as a single
// unit. The list below is based on
// https://github.com/codemirror/CodeMirror/blob/master/src/util/misc.js#L122
const extendingChars = /[\u0300-\u036f\u0483-\u0489\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u065e\u0670\u06d6-\u06dc\u06de-\u06e4\u06e7\u06e8\u06ea-\u06ed\u0711\u0730-\u074a\u07a6-\u07b0\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0900-\u0902\u093c\u0941-\u0948\u094d\u0951-\u0955\u0962\u0963\u0981\u09bc\u09be\u09c1-\u09c4\u09cd\u09d7\u09e2\u09e3\u0a01\u0a02\u0a3c\u0a41\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a70\u0a71\u0a75\u0a81\u0a82\u0abc\u0ac1-\u0ac5\u0ac7\u0ac8\u0acd\u0ae2\u0ae3\u0b01\u0b3c\u0b3e\u0b3f\u0b41-\u0b44\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b82\u0bbe\u0bc0\u0bcd\u0bd7\u0c3e-\u0c40\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0cbc\u0cbf\u0cc2\u0cc6\u0ccc\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0d3e\u0d41-\u0d44\u0d4d\u0d57\u0d62\u0d63\u0dca\u0dcf\u0dd2-\u0dd4\u0dd6\u0ddf\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0f18\u0f19\u0f35\u0f37\u0f39\u0f71-\u0f7e\u0f80-\u0f84\u0f86\u0f87\u0f90-\u0f97\u0f99-\u0fbc\u0fc6\u102d-\u1030\u1032-\u1037\u1039\u103a\u103d\u103e\u1058\u1059\u105e-\u1060\u1071-\u1074\u1082\u1085\u1086\u108d\u109d\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b7-\u17bd\u17c6\u17c9-\u17d3\u17dd\u180b-\u180d\u18a9\u1920-\u1922\u1927\u1928\u1932\u1939-\u193b\u1a17\u1a18\u1a56\u1a58-\u1a5e\u1a60\u1a62\u1a65-\u1a6c\u1a73-\u1a7c\u1a7f\u1b00-\u1b03\u1b34\u1b36-\u1b3a\u1b3c\u1b42\u1b6b-\u1b73\u1b80\u1b81\u1ba2-\u1ba5\u1ba8\u1ba9\u1c2c-\u1c33\u1c36\u1c37\u1cd0-\u1cd2\u1cd4-\u1ce0\u1ce2-\u1ce8\u1ced\u1dc0-\u1de6\u1dfd-\u1dff\u200c\u200d\u20d0-\u20f0\u2cef-\u2cf1\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua66f-\ua672\ua67c\ua67d\ua6f0\ua6f1\ua802\ua806\ua80b\ua825\ua826\ua8c4\ua8e0-\ua8f1\ua926-\ua92d\ua947-\ua951\ua980-\ua982\ua9b3\ua9b6-\ua9b9\ua9bc\uaa29-\uaa2e\uaa31\uaa32\uaa35\uaa36\uaa43\uaa4c\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uabe5\uabe8\uabed\udc00-\udfff\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\uff9e\uff9f]/
function isExtendingChar(ch) { return ch.charCodeAt(0) >= 768 && extendingChars.test(ch) }

// Returns a number from the range [`0`; `str.length`] unless `pos` is outside that range.
function skipExtendingChars(str, pos, dir) {
  while ((dir < 0 ? pos > 0 : pos < str.length) && isExtendingChar(str.charAt(pos)))
    pos = pos + dir;
  return pos
}


function test() {
  let measure = DOMTextMeasure.initDefault().reset();
  measure.defaultCharExtent({defaultTextStyle: {fontSize: 12, fontFamily: "serif"}});
}



class DOMTextMeasure {

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // setup

  reset() {
    var doc, parentNode;
    if (this.element) {
      parentNode = this.element.parentNode;
      doc = this.element.ownerDocument;
    }
    this.uninstall();
    // this.charMap = {};
    // this.cachedBoundsInfo = {};
    if (doc && parentNode)
      this.install(doc, parentNode);
    return this;
  }

  install(doc, parentEl) {
    this.maxElementsWithStyleCacheCount = 30;
    this.elementsWithStyleCache = {};
    this.elementsWithStyleCacheCount = 0;
    this.defaultCharWidthHeightCache = {};
    this.doc = doc;
    let el = this.element = doc.createElement("div");
    el.id = "domMeasure";
    this.setMeasureNodeStyles(el.style, true);
    parentEl.appendChild(el);
    return this;
  }

  uninstall() {
    let el = this.element;
    if (!el) return
    if (el.parentNode) el.parentNode.removeChild(el);
    this.element = null;
  }

  setMeasureNodeStyles(style, isRoot) {
    style.width = style.height = "auto";
    style.left = style.top = "0px";
    style.visibility = "hidden";
    style.position = "absolute";
    style.whiteSpace = "pre";
    style.font = "inherit";
    style.overflow = isRoot ? "hidden" : "visible";
  }

  generateStyleKey(styleOpts) {
    let {
      defaultTextStyle: {
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        textDecoration,
        textStyleClasses
      },
      paddingLeft, paddingRight, paddingTop, paddingBottom,
      width, height, clipMode, lineWrapping, textAlign,
      cssClassName = "newtext-text-layer"
    } = styleOpts;
    return [
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      textDecoration,
      textStyleClasses,
      paddingLeft, paddingRight, paddingTop, paddingBottom,
      width, height, clipMode, lineWrapping, textAlign,
      cssClassName
    ].join("-");
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // interface

  defaultCharExtent(styleOpts, styleKey) {
    if (!styleKey)
      styleKey = this.generateStyleKey(styleOpts);

    let {defaultCharWidthHeightCache} = this,
        found = defaultCharWidthHeightCache[styleKey];
    if (found) return found;
    let node = this._prepareMeasureForLineSimpleStyle(styleOpts, styleKey);
    node.textContent = "Hello World!";
    let {width, height} = node.getBoundingClientRect();
    return defaultCharWidthHeightCache[styleKey] = {width: width/12, height};
  }

  manuallyComputeCharBoundsOfLine(line, offsetX = 0, offsetY = 0, styleOpts, styleKey, renderLineFn) {
    if (!styleKey)
      styleKey = this.generateStyleKey(styleOpts);

    if (!renderLineFn)
      renderLineFn = this._defaultRenderLineFunction.bind(this);

    let lineNode = this._ensureMeasureNodeForLine(line, styleOpts, styleKey, renderLineFn),
        offset = cumulativeOffset(lineNode);

    try {
      return charBoundsOfLine(line, lineNode, -offset.left + offsetX, -offset.top + offsetY);
    } finally { lineNode.parentNode.removeChild(lineNode); }
  }
  
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // implementation
  _ensureMeasureNode(styleOpts, styleKey) {
    // create a DOM node that would be a textlayer node in a normal text morph.
    // In order to measure stuff this node gets line nodes appended later

    // returns an existing or new node with style
    let {doc: document, element: root, elementsWithStyleCache: cache} = this;
    if (cache[styleKey]) return cache[styleKey];

    let {
      defaultTextStyle, lineWrapping,
      width, height, clipMode, textAlign,
      paddingLeft = 0,
      paddingRight = 0,
      paddingTop = 0,
      paddingBottom = 0,
      cssClassName = "newtext-text-layer"
    } = styleOpts;

    switch (lineWrapping) {
      case true:
      case "by-words":      cssClassName = cssClassName + " wrap-by-words"; break;
      case "only-by-words": cssClassName = cssClassName + " only-wrap-by-words"; break;
      case "by-chars":      cssClassName = cssClassName + " wrap-by-chars"; break;
      case false:           cssClassName = cssClassName + " no-wrapping"; break;
    }

    let el = cache[styleKey] = document.createElement("div");
    el.className = cssClassName;
    el.id = styleKey;
    root.appendChild(el);
    this.elementsWithStyleCacheCount++;
    Object.assign(el.style, defaultTextStyle);
    el.style.position = "absolute";
    el.style.boxSizing = "border-box";
    el.style.fontSize = defaultTextStyle.fontSize + "px";
    el.style.paddingLeft = paddingLeft + "px";
    el.style.paddingTop = paddingTop + "px";
    el.style.paddingBottom = paddingBottom + "px";
    el.style.paddingRight = paddingRight + "px";
    if (defaultTextStyle.textStyleClasses)
      el.className = el.className + " " + defaultTextStyle.textStyleClasses.join(" ");
    if (typeof width === "number")
      el.style.width = width + "px";
    if (typeof height === "number")
      el.style.height = height + "px";
    if (clipMode)
      el.style.overflow = clipMode;
    if (textAlign)
      el.style.textAlign = textAlign;

    if (this.elementsWithStyleCacheCount > this.maxElementsWithStyleCacheCount) {
      let rmCacheEl = root.childNodes[0];
      root.removeChild(rmCacheEl);
      cache[rmCacheEl.id] = null;
    }
    return el;
  }

  _defaultRenderLineFunction(line) {
    let {doc: document} = this;

// while(textNode.childNodes.length)
//   textNode.removeChild(textNode.childNodes[0]);

    // this basically mirrors the renderLine method in text/renderer.js. For
    // optimization we do not use virtual-dom here but construct the nodes by hand

    let lineEl = document.createElement("div");
    lineEl.className = "line";
    // lineEl.style.position = "absolute";

    // FIXME... TextRenderer>>renderLine...!
    let { textAndAttributes } = line, renderedChunks = [];
    for (let i = 0; i < textAndAttributes.length; i = i+2) {
      let text = textAndAttributes[i], attr = textAndAttributes[i+1];
      if (!attr) {
        lineEl.appendChild(text.length ? document.createTextNode(text) : document.createElement("br"));
        continue;
      }

      let {
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        textDecoration,
        fontColor,
        backgroundColor,
        nativeCursor,
        textStyleClasses,
        link
      } = attr;

      let tagname = link ? "a" : "span",
          style = {}, attrs = {};

      if (link) {
        attrs.href = link;
        attrs.target = "_blank";
      }

      if (fontSize) style.fontSize               = fontSize + "px";
      if (fontFamily) style.fontFamily           = fontFamily;
      if (fontWeight) style.fontWeight           = fontWeight;
      if (fontStyle) style.fontStyle             = fontStyle;
      if (textDecoration) style.textDecoration   = textDecoration;
      if (fontColor) style.color                 = fontColor ? String(attr.fontColor) : "";
      if (backgroundColor) style.backgroundColor = backgroundColor ? String(attr.backgroundColor) : "";
      if (nativeCursor) style.cursor             = nativeCursor;

      if (textStyleClasses && textStyleClasses.length)
        attrs.className = textStyleClasses.join(" ");

      let el = document.createElement(tagname);
      Object.assign(el, attrs);
      Object.assign(el.style, style);
      
      if (text.length) el.textContent = text;
      else el.appendChild(document.createElement("br"));
      lineEl.appendChild(el);
    }
    return lineEl;
  }

  _ensureMeasureNodeForLine(line, styleOpts, styleKey, renderLineFn) {
    let {doc: document} = this,
        textNode = this._ensureMeasureNode(styleOpts, styleKey);
    let lineEl = renderLineFn(line);
    textNode.appendChild(lineEl);
    return lineEl;
  }

  _prepareMeasureForLineSimpleStyle(styleOpts, styleKey) {
    // returns an existing or new node with style
    let {doc: document, element: root, elementsWithStyleCache: cache} = this;
    if (cache[styleKey]) return cache[styleKey];
    let el = cache[styleKey] = document.createElement("div"),
        {defaultTextStyle, cssClassName} = styleOpts,
        {fontSize, textStyleClasses} = defaultTextStyle;
    el.id = styleKey;
    el.className = cssClassName;
    root.appendChild(el);
    this.elementsWithStyleCacheCount++;
    Object.assign(el.style, defaultTextStyle);
    el.style.fontSize = fontSize + "px";
    if (textStyleClasses)
      el.className = el.className + " " + textStyleClasses.join(" ");
    if (this.elementsWithStyleCacheCount > this.maxElementsWithStyleCacheCount) {
      let rmCacheEl = root.childNodes[0];
      root.removeChild(rmCacheEl);
      cache[rmCacheEl.id] = null;
    }
    return el;
  }

}

function cumulativeOffset(element) {
  let top = 0, left = 0;
  do {
    top = top + (element.offsetTop || 0);
    left = left + (element.offsetLeft || 0);
    element = element.offsetParent;
  } while(element);
  return {top, left};
}


function charBoundsOfLine(line, lineNode, offsetX = 0, offsetY = 0) {
  const {ELEMENT_NODE, TEXT_NODE, childNodes} = lineNode,
        maxLength = 20000;

  let document = lineNode.ownerDocument,
      node = childNodes[0],
      result = [],
      textLength = line.text.length,
      index = 0;

  let textNode, left, top, width, height, x, y,
      emptyNodeFill;
  if (!node) {
    emptyNodeFill = node = document.createElement("br");
    lineNode.appendChild(emptyNodeFill);
  }

  while (node) {

    if (index > maxLength) break;

    textNode = node.nodeType === ELEMENT_NODE && node.childNodes[0] ?
      node.childNodes[0] : node;

    if (textNode.nodeType === TEXT_NODE) {
      let length = textNode.length;
      for (let i = 0; i < length; i++) {
        // "right" bias for rect means that if we get multiple rects for a
        // single char (if it comes after a line break caused by wrapping, we
        // prefer the bounds on the next (the wrapped) line)
        ({left, top, width, height} = measureCharInner(document, textNode, i, "right")),
        x = left + offsetX;
        y = top + offsetY;
        result[index++] = {x,y,width,height};
      }

    } else if (node.nodeType === ELEMENT_NODE) {
      ({left, top, width, height} = node.getBoundingClientRect());
      x = left + offsetX,
      y = top + offsetY;
      result[index++] = {x,y,width,height};

    } else throw new Error(`Cannot deal with node ${node}`);

    node = node.nextSibling;
  }

  if (emptyNodeFill)
    emptyNodeFill.parentNode.removeChild(emptyNodeFill);

  return result;
}



function measureCharInner(document, node, index, bias = "left") {
  let rect, start = index, end = index + 1;
  if (node.nodeType == 3) { // If it is a text node, use a range to retrieve the coordinates.
    for (let i = 0; i < 4; i++) { // Retry a maximum of 4 times when nonsense rectangles are returned
      rect = getUsefulRect(range(document, node, start, end).getClientRects(), bias)
      if (rect.left || rect.right || start == 0) break
      end = start
      start = start - 1
    }
  }
  return rect;
  // let {bottom, height, left, right, top, width} = rect;
  // return {bottom, height, left, right, top, width};
}

function range(document, node, start, end, endNode) {
  let r = document.createRange()
  r.setEnd(endNode || node, end)
  r.setStart(node, start)
  return r
}

function getUsefulRect(rects, bias) {
  let rect = {left: 0, right: 0, top: 0, bottom: 0};
  if (bias == "left") for (let i = 0; i < rects.length; i++) {
    if ((rect = rects[i]).left != rect.right) break
  } else for (let i = rects.length - 1; i >= 0; i--) {
    if ((rect = rects[i]).left != rect.right) break
  }
  return rect
}
