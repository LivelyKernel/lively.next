export default class FontDetector {
  /**
   * JavaScript code to detect available availability of a
   * particular font in a browser using JavaScript and CSS.
   * Modified version of:
   *
   * Author : Lalit Patel
   * Website: http://www.lalit.org/lab/javascript-css-font-detect/
   * License: Apache Software License 2.0
   *          http://www.apache.org/licenses/LICENSE-2.0
   */
  // a font will be compared against all the three default fonts.
  // and if it doesn't match all 3 then that font is not available.

  static get fonts () { return fonts; }

  constructor (document) {
    this.document = document;
    this.prepared = false;
    this.defaultWidth = {};
    this.defaultHeight = {};
    this.possibleFontWeights = [
      'normal', 'bold', 'bolder', 'lighter',
      '100', '200', '300', '400', '500', '600', '700', '800', '900'
    ];
    this.namedToNumeric = new Map([
      'Thin',
      'Extra Light',
      'Light',
      'Normal',
      'Medium',
      'Semi Bold',
      'Bold',
      'Extra Bold',
      'Ultra Bold'
    ].map((name, i) => [name, String((i + 1) * 100)]));
    this.baseFonts = ['monospace', 'sans-serif', 'serif', 'Comic Sans MS'];
    this.span = null;
  }

  prepare () {
    const defaultWidth = this.defaultWidth;
    const defaultHeight = this.defaultHeight;
    const fontWeights = this.possibleFontWeights;
    const baseFonts = this.baseFonts;
    // we use m or w because these two characters take up the maximum width.
    // And we use a LLi so that the same matching fonts can get separated
    const testString = 'mmmmmmmmmmlli';
    // we test using 72px font size, we may use any size. I guess larger the better.
    const testSize = '72px';
    const h = this.document.getElementsByTagName('body')[0];
    // create a SPAN in the document to get the width of the text we use to test
    const s = this.span || this.document.createElement('span');
    s.style.fontSize = testSize;
    s.style.opacity = 0;
    s.innerHTML = testString;
    if (!s.parentNode) {
      const w = this.document.createElement('div');
      w.style.position = 'absolute';
      w.style.width = '100%';
      w.style.overflow = 'hidden';
      w.style['pointer-events'] = 'none';
      w.style['-webkit-user-select'] = 'none';
      w.appendChild(s);
      h.insertBefore(w, h.firstChild);
    }
    for (const j in fontWeights) {
      for (const i in baseFonts) {
        // get the default width for the three base fonts
        s.style.fontFamily = baseFonts[i];
        s.style.fontWeight = fontWeights[j];
        defaultWidth[baseFonts[i] + '@' + fontWeights[j]] = s.offsetWidth; // width for the default font
        defaultHeight[baseFonts[i] + '@' + fontWeights[j]] = s.offsetHeight; // height for the default font
      }
    }
    this.span = s;
    this.prepared = true;
  }

  isFontSupported (font, weight = 'normal') {
    if (!this.possibleFontWeights.includes(weight)) { weight = this.namedToNumeric.get(weight) || 'normal'; }
    if (!this.prepared) this.prepare();

    const {
      defaultWidth, defaultHeight,
      baseFonts, span,
      document: { body }
    } = this;

    if (!span.parentNode) body.appendChild(span);

    try {
      for (const index in baseFonts) {
        span.style.fontWeight = weight;
        span.style.fontFamily = font + ',' + baseFonts[index]; // name of the font along with the base font for fallback.
        const matched = (span.offsetWidth != defaultWidth[baseFonts[index] + '@' + weight] ||
                   span.offsetHeight != defaultHeight[baseFonts[index] + '@' + weight]);
        if (matched) {
          return true;
        }
      }
      return false;
    } finally {

    }
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
  { name: 'serif', type: 'default' },
  { name: 'sans-serif', type: 'default' },
  { name: 'monospace', type: 'default' },

  { name: 'Adobe Jenson', type: 'serif' },
  { name: 'Albertus', type: 'serif' },
  { name: 'Aldus', type: 'serif' },
  { name: 'Alexandria', type: 'serif' },
  { name: 'Algerian', type: 'serif' },
  { name: 'American Typewriter', type: 'serif' },
  { name: 'Antiqua', type: 'serif' },
  { name: 'Arno', type: 'serif' },
  { name: 'Aster', type: 'serif' },
  { name: 'Aurora', type: 'serif' },
  { name: 'News 706', type: 'serif' },
  { name: 'Baskerville', type: 'serif' },
  { name: 'Bell', type: 'serif' },
  { name: 'Belwe Roman', type: 'serif' },
  { name: 'Bembo', type: 'serif' },
  { name: 'Berkeley Old Style', type: 'serif' },
  { name: 'Bernhard Modern', type: 'serif' },
  { name: 'Bodoni', type: 'serif' },
  { name: 'Book Antiqua', type: 'serif' },
  { name: 'Bookman', type: 'serif' },
  { name: 'Bulmer', type: 'serif' },
  { name: 'Caledonia', type: 'serif' },
  { name: 'Californian FB', type: 'serif' },
  { name: 'Calisto MT', type: 'serif' },
  { name: 'Cambria', type: 'serif' },
  { name: 'Capitals', type: 'serif' },
  { name: 'Cartier', type: 'serif' },
  { name: 'Caslon', type: 'serif' },
  { name: 'Wyld', type: 'serif' },
  { name: 'Caslon Antique / Fifteenth Century', type: 'serif' },
  { name: 'Catull', type: 'serif' },
  { name: 'Centaur', type: 'serif' },
  { name: 'Century Old Style', type: 'serif' },
  { name: 'Century Schoolbook', type: 'serif' },
  { name: 'New Century Schoolbook', type: 'serif' },
  { name: 'Century Schoolbook Infant', type: 'serif' },
  { name: 'Charis SIL', type: 'serif' },
  { name: 'Charter (typeface)', type: 'serif' },
  { name: 'Cheltenham', type: 'serif' },
  { name: 'Clearface', type: 'serif' },
  { name: 'Cochin', type: 'serif' },
  { name: 'Colonna', type: 'serif' },
  { name: 'Computer Modern', type: 'serif' },
  { name: 'Concrete Roman', type: 'serif' },
  { name: 'Constantia', type: 'serif' },
  { name: 'Cooper Black', type: 'serif' },
  { name: 'Copperplate Gothic', type: 'serif' },
  { name: 'Corona', type: 'serif' },
  { name: 'News 705', type: 'serif' },
  { name: 'DejaVu Serif', type: 'serif' },
  { name: 'Didot', type: 'serif' },
  { name: 'Droid Serif', type: 'serif' },
  { name: 'Elephant', type: 'serif' },
  { name: 'Emerson', type: 'serif' },
  { name: 'Excelsior', type: 'serif' },
  { name: 'News 702', type: 'serif' },
  { name: 'Fairfield', type: 'serif' },
  { name: 'FF Scala', type: 'serif' },
  { name: 'Footlight', type: 'serif' },
  { name: 'FreeSerif', type: 'serif' },
  { name: 'Friz Quadrata', type: 'serif' },
  { name: 'Garamond', type: 'serif' },
  { name: 'Gentium', type: 'serif' },
  { name: 'Georgia', type: 'serif' },
  { name: 'Gloucester', type: 'serif' },
  { name: 'Goudy', type: 'serif' },
  { name: 'Granjon', type: 'serif' },
  { name: 'High Tower Text', type: 'serif' },
  { name: 'Hoefler Text', type: 'serif' },
  { name: 'Imprint', type: 'serif' },
  { name: 'Ionic No. 5', type: 'serif' },
  { name: 'News 701', type: 'serif' },
  { name: 'ITC Benguiat', type: 'serif' },
  { name: 'Janson', type: 'serif' },
  { name: 'Jokerman', type: 'serif' },
  { name: 'Joanna', type: 'serif' },
  { name: 'Korinna', type: 'serif' },
  { name: 'Lexicon', type: 'serif' },
  { name: 'Liberation Serif', type: 'serif' },
  { name: 'Linux Libertine', type: 'serif' },
  { name: 'Literaturnaya', type: 'serif' },
  { name: 'Lucida Bright', type: 'serif' },
  { name: 'Melior', type: 'serif' },
  { name: 'Memphis', type: 'serif' },
  { name: 'Miller', type: 'serif' },
  { name: 'Minion', type: 'serif' },
  { name: 'Modern', type: 'serif' },
  { name: 'Mona Lisa', type: 'serif' },
  { name: 'Mrs Eaves', type: 'serif' },
  { name: 'MS Serif', type: 'serif' },
  { name: 'New York', type: 'serif' },
  { name: 'Nimbus Roman', type: 'serif' },
  { name: 'NPS Rawlinson Roadway', type: 'serif' },
  { name: 'OCR A Extended', type: 'serif' },
  { name: 'Palatino', type: 'serif' },
  { name: 'Book Antiqua', type: 'serif' },
  { name: 'Perpetua', type: 'serif' },
  { name: 'Plantin', type: 'serif' },
  { name: 'Playbill', type: 'serif' },
  { name: 'Primer', type: 'serif' },
  { name: 'Renault', type: 'serif' },
  { name: 'Requiem', type: 'serif' },
  { name: 'Rotis Serif', type: 'serif' },
  { name: 'Sabon', type: 'serif' },
  { name: 'Sistina', type: 'serif' },
  { name: 'Souvenir', type: 'serif' },
  { name: 'XITS', type: 'serif' },
  { name: 'Sylfaen', type: 'serif' },
  { name: 'Times New Roman', type: 'serif' },
  { name: 'Times', type: 'serif' },
  { name: 'Torino', type: 'serif' },
  { name: 'Trajan', type: 'serif' },
  { name: 'Trinité', type: 'serif' },
  { name: 'Trump Mediaeval', type: 'serif' },
  { name: 'Utopia', type: 'serif' },
  { name: 'Vera Serif', type: 'serif' },
  { name: 'Wide Latin', type: 'serif' },
  { name: 'Windsor', type: 'serif' },
  { name: 'XITS', type: 'serif' },

  { name: 'Playfair Display', type: 'serif', isGoogleFont: true },
  { name: 'Cormorant', type: 'serif', isGoogleFont: true },
  { name: 'Eczar', type: 'serif', isGoogleFont: true },
  { name: 'Alegreya', type: 'serif', isGoogleFont: true },
  { name: 'Lora', type: 'serif', isGoogleFont: true },
  { name: 'Source Serif Pro', type: 'serif', isGoogleFont: true },
  { name: 'Roboto Slab', type: 'serif', isGoogleFont: true },
  { name: 'BioRhyme', type: 'serif', isGoogleFont: true },
  { name: 'Libre Baskerville', type: 'serif', isGoogleFont: true },
  { name: 'Crimson Text', type: 'serif', isGoogleFont: true },
  { name: 'Old Standard TT', type: 'serif', isGoogleFont: true },
  { name: 'Domine', type: 'serif', isGoogleFont: true },
  { name: 'Bitter', type: 'serif', isGoogleFont: true },
  { name: 'Gentium Basic', type: 'serif', isGoogleFont: true },
  { name: 'PT Serif', type: 'serif', isGoogleFont: true },
  { name: 'Cardo', type: 'serif', isGoogleFont: true },
  { name: 'Neuton', type: 'serif', isGoogleFont: true },
  { name: 'Arvo', type: 'serif', isGoogleFont: true },
  { name: 'Merriweather', type: 'serif', isGoogleFont: true },

  // slab serif
  { name: 'Alexandria', type: 'slab serif' },
  { name: 'American Typewriter', type: 'slab serif' },
  { name: 'Archer', type: 'slab serif' },
  { name: 'Athens', type: 'slab serif' },
  { name: 'Candida', type: 'slab serif' },
  { name: 'Cholla Slab', type: 'slab serif' },
  { name: 'City', type: 'slab serif' },
  { name: 'Clarendon', type: 'slab serif' },
  { name: 'Concrete Roman', type: 'slab serif' },
  { name: 'Courier', type: 'slab serif' },
  { name: 'Egyptienne', type: 'slab serif' },
  { name: 'Guardian Egyptian', type: 'slab serif' },
  { name: 'Ionic No. 5', type: 'slab serif' },
  { name: 'Lexia', type: 'slab serif' },
  { name: 'Memphis', type: 'slab serif' },
  { name: 'Nilland', type: 'slab serif' },
  { name: 'Roboto Slab', type: 'slab serif' },
  { name: 'Rockwell', type: 'slab serif' },
  { name: 'Schadow', type: 'slab serif' },
  { name: 'Serifa', type: 'slab serif' },
  { name: 'Skeleton Antique', type: 'slab serif' },
  { name: 'Sreda', type: 'slab serif' },
  { name: 'Swift', type: 'slab serif' },
  { name: 'Tower', type: 'slab serif' },

  { name: 'Agency FB', type: 'sans-serif' },
  { name: 'Akzidenz-Grotesk', type: 'sans-serif' },
  { name: 'Andalé Sans', type: 'sans-serif' },
  { name: 'Antique Olive', type: 'sans-serif' },
  { name: 'Arial', type: 'sans-serif' },
  { name: 'Arial Unicode MS', type: 'sans-serif' },
  { name: 'Avant Garde Gothic', type: 'sans-serif' },
  { name: 'Avenir', type: 'sans-serif' },
  { name: 'Bank Gothic', type: 'sans-serif' },
  { name: 'Bauhaus', type: 'sans-serif' },
  { name: 'Bell Centennial', type: 'sans-serif' },
  { name: 'Bell Gothic', type: 'sans-serif' },
  { name: 'Benguiat Gothic', type: 'sans-serif' },
  { name: 'Berlin Sans', type: 'sans-serif' },
  { name: 'Brandon Grotesque', type: 'sans-serif' },
  { name: 'Calibri', type: 'sans-serif' },
  { name: 'Casey', type: 'sans-serif' },
  { name: 'Century Gothic', type: 'sans-serif' },
  { name: 'Charcoal', type: 'sans-serif' },
  { name: 'Chicago', type: 'sans-serif' },
  { name: 'Clearview', type: 'sans-serif' },
  { name: 'Comic Sans', type: 'sans-serif' },
  { name: 'Compacta', type: 'sans-serif' },
  { name: 'Corbel', type: 'sans-serif' },
  { name: 'DejaVu Sans', type: 'sans-serif' },
  { name: 'DIN', type: 'sans-serif' },
  { name: 'Dotum', type: 'sans-serif' },
  { name: 'Droid Sans', type: 'sans-serif' },
  { name: 'Dyslexie', type: 'sans-serif' },
  { name: 'Ecofont', type: 'sans-serif' },
  { name: 'Eras', type: 'sans-serif' },
  { name: 'Esseltub', type: 'sans-serif' },
  { name: 'Espy Sans', type: 'sans-serif' },
  { name: 'Eurocrat', type: 'sans-serif' },
  { name: 'Eurostile', type: 'sans-serif' },
  { name: 'Square 721', type: 'sans-serif' },
  { name: 'FF Dax', type: 'sans-serif' },
  { name: 'FF Meta', type: 'sans-serif' },
  { name: 'FF Scala Sans', type: 'sans-serif' },
  { name: 'Fira Sans', type: 'sans-serif' },
  { name: 'Folio', type: 'sans-serif' },
  { name: 'Franklin Gothic', type: 'sans-serif' },
  { name: 'FreeSans', type: 'sans-serif' },
  { name: 'Frutiger', type: 'sans-serif' },
  { name: 'Futura', type: 'sans-serif' },
  { name: 'Geneva', type: 'sans-serif' },
  { name: 'Gill Sans', type: 'sans-serif' },
  { name: 'Gill Sans Schoolbook', type: 'sans-serif' },
  { name: 'Gotham', type: 'sans-serif' },
  { name: 'Haettenschweiler', type: 'sans-serif' },
  { name: 'Handel Gothic', type: 'sans-serif' },
  { name: 'Hei', type: 'sans-serif' },
  { name: 'Helvetica', type: 'sans-serif' },
  { name: 'Helvetica Neue', type: 'sans-serif' },
  { name: 'Swiss 721', type: 'sans-serif' },
  { name: 'Highway Gothic', type: 'sans-serif' },
  { name: 'Hobo', type: 'sans-serif' },
  { name: 'Impact', type: 'sans-serif' },
  { name: 'Industria', type: 'sans-serif' },
  { name: 'Interstate', type: 'sans-serif' },
  { name: 'Johnston/New Johnston', type: 'sans-serif' },
  { name: 'Kabel', type: 'sans-serif' },
  { name: 'Klavika', type: 'sans-serif' },
  { name: 'Lexia Readable', type: 'sans-serif' },
  { name: 'Liberation Sans', type: 'sans-serif' },
  { name: 'Linux Biolinum', type: 'sans-serif' },
  { name: 'Lucida Sans', type: 'sans-serif' },
  { name: 'Lucida Grande', type: 'sans-serif' },
  { name: 'Lucida Sans Unicode', type: 'sans-serif' },
  { name: 'Lydian', type: 'sans-serif' },
  { name: 'Meiryo', type: 'sans-serif' },
  { name: 'Meta', type: 'sans-serif' },
  { name: 'Microgramma', type: 'sans-serif' },
  { name: 'Modern', type: 'sans-serif' },
  { name: 'Motorway', type: 'sans-serif' },
  { name: 'Arial', type: 'sans-serif' },
  { name: 'Myriad', type: 'sans-serif' },
  { name: 'Neutraface', type: 'sans-serif' },
  { name: 'Neuzeit S', type: 'sans-serif' },
  { name: 'News Gothic', type: 'sans-serif' },
  { name: 'Nimbus Sans L', type: 'sans-serif' },
  { name: 'Open Sans', type: 'sans-serif' },
  { name: 'Optima', type: 'sans-serif' },
  { name: 'Paris', type: 'sans-serif' },
  { name: 'Product Sans', type: 'sans-serif' },
  { name: 'Proxima Nova', type: 'sans-serif' },
  { name: 'Russian Federation', type: 'sans-serif' },
  { name: 'Rail Alphabet', type: 'sans-serif' },
  { name: 'Roboto', type: 'sans-serif' },
  { name: 'Rotis Sans', type: 'sans-serif' },
  { name: 'Segoe UI', type: 'sans-serif' },
  { name: 'Skia', type: 'sans-serif' },
  { name: 'Source Sans Pro', type: 'sans-serif' },
  { name: 'Sweden Sans', type: 'sans-serif' },
  { name: 'Syntax', type: 'sans-serif' },
  { name: 'Tahoma', type: 'sans-serif' },
  { name: 'Template Gothic', type: 'sans-serif' },
  { name: 'Thesis Sans', type: 'sans-serif' },
  { name: 'Tiresias', type: 'sans-serif' },
  { name: 'Trade Gothic', type: 'sans-serif' },
  { name: 'Transport', type: 'sans-serif' },
  { name: 'Trebuchet MS', type: 'sans-serif' },
  { name: 'Twentieth Century (Tw Cen MT)', type: 'sans-serif' },
  { name: 'Ubuntu', type: 'sans-serif' },
  { name: 'Univers', type: 'sans-serif' },
  { name: 'Zurich', type: 'sans-serif' },
  { name: 'Vera Sans', type: 'sans-serif' },
  { name: 'Verdana', type: 'sans-serif' },

  { name: 'Work Sans', type: 'sans-serif', isGoogleFont: true },
  { name: 'Rubik', type: 'sans-serif', isGoogleFont: true },
  { name: 'Libre Franklin', type: 'sans-serif', isGoogleFont: true },
  { name: 'Fira Sans', type: 'sans-serif', isGoogleFont: true },
  { name: 'Alegreya Sans', type: 'sans-serif', isGoogleFont: true },
  { name: 'Chivo', type: 'sans-serif', isGoogleFont: true },
  { name: 'Source Sans Pro', type: 'sans-serif', isGoogleFont: true },
  { name: 'Roboto', type: 'sans-serif', isGoogleFont: true },
  { name: 'Poppins', type: 'sans-serif', isGoogleFont: true },
  { name: 'Archivo Narrow', type: 'sans-serif', isGoogleFont: true },
  { name: 'Karla', type: 'sans-serif', isGoogleFont: true },
  { name: 'Montserrat', type: 'sans-serif', isGoogleFont: true },
  { name: 'Rajdhani', type: 'sans-serif', isGoogleFont: true },
  { name: 'PT Sans', type: 'sans-serif', isGoogleFont: true },
  { name: 'Lato', type: 'sans-serif', isGoogleFont: true },
  { name: 'Open Sans', type: 'sans-serif', isGoogleFont: true },
  { name: 'Cabin', type: 'sans-serif', isGoogleFont: true },
  { name: 'Raleway', type: 'sans-serif', isGoogleFont: true },

  { name: 'Nyala', type: 'semi-serif' },
  { name: 'Rotis Semi Serif', type: 'semi-serif' },
  { name: 'Easyreading', type: 'semi-serif' },

  { name: 'Andalé Mono', type: 'monospace' },
  { name: 'Arial', type: 'monospace' },
  { name: 'Bitstream Vera (Vera Sans Mono)', type: 'monospace' },
  { name: 'Consolas', type: 'monospace' },
  { name: 'Courier', type: 'monospace' },
  { name: 'Courier New', type: 'monospace' },
  { name: 'DejaVu Sans Mono', type: 'monospace' },
  { name: 'Droid Sans Mono', type: 'monospace' },
  { name: 'Everson Mono', type: 'monospace' },
  { name: 'Fixed', type: 'monospace' },
  { name: 'Fixedsys', type: 'monospace' },
  { name: 'Fixedsys Excelsior', type: 'monospace' },
  { name: 'HyperFont', type: 'monospace' },
  { name: 'Inconsolata', type: 'monospace' },
  { name: 'Letter Gothic', type: 'monospace' },
  { name: 'Liberation Mono', type: 'monospace' },
  { name: 'Lucida Console', type: 'monospace' },
  { name: 'Lucida Sans Typewriter', type: 'monospace' },
  { name: 'Lucida Typewriter', type: 'monospace' },
  { name: 'Menlo', type: 'monospace' },
  { name: 'MICR', type: 'monospace' },
  { name: 'Monaco', type: 'monospace' },
  { name: 'Monospace', type: 'monospace' },
  { name: 'MS Gothic', type: 'monospace' },
  { name: 'MS Mincho', type: 'monospace' },
  { name: 'Nimbus Mono L', type: 'monospace' },
  { name: 'OCR-A', type: 'monospace' },
  { name: 'OCR-B', type: 'monospace' },
  { name: 'PragmataPro', type: 'monospace' },
  { name: 'Prestige Elite', type: 'monospace' },
  { name: 'ProFont', type: 'monospace' },
  { name: 'Proggy programming fonts', type: 'monospace' },
  { name: 'SimHei', type: 'monospace' },
  { name: 'SimSun', type: 'monospace' },
  { name: 'Source Code Pro', type: 'monospace' },
  { name: 'Terminal', type: 'monospace' },
  { name: 'Trixie', type: 'monospace' },
  { name: 'Ubuntu Mono', type: 'monospace' },
  { name: 'Vera Sans Mono (Bitstream Vera)', type: 'monospace' },

  { name: 'Space Mono', type: 'monospace', isGoogleFont: true },
  { name: 'Inconsolata', type: 'monospace', isGoogleFont: true },
  { name: 'Anonymous Pro', type: 'monospace', isGoogleFont: true },

  { name: 'Balloon', type: 'script' },
  { name: 'Brush Script', type: 'script' },
  { name: 'Choc', type: 'script' },
  { name: 'Dom Casual', type: 'script' },
  { name: 'Mistral', type: 'script' },
  { name: 'Papyrus', type: 'script' },
  { name: 'Segoe Script', type: 'script' },
  { name: 'Utopia', type: 'script' },
  { name: 'Coronet', type: 'script' },
  { name: 'Curlz', type: 'script' },
  { name: 'Gravura', type: 'script' },
  { name: 'Script', type: 'script' },
  { name: 'Wiesbaden Swing', type: 'script' },

  { name: 'American Scribe', type: 'script' },
  { name: 'AMS Euler', type: 'script' },
  { name: 'Apple Chancery', type: 'script' },
  { name: 'Forte', type: 'script' },
  { name: 'French Script', type: 'script' },
  { name: 'ITC Zapf Chancery', type: 'script' },
  { name: 'Kuenstler Script', type: 'script' },
  { name: 'Monotype Corsiva', type: 'script' },
  { name: 'Old English Text MT', type: 'script' },
  { name: 'Zapfino', type: 'script' },

  { name: 'Andy', type: 'handwriting' },
  { name: 'Ashley Script', type: 'handwriting' },
  { name: 'Cézanne', type: 'handwriting' },
  { name: 'Chalkboard', type: 'handwriting' },
  { name: 'Comic Sans MS', type: 'handwriting' },
  { name: 'Dom Casual', type: 'handwriting' },
  { name: 'Kristen', type: 'handwriting' },
  { name: 'Lucida Handwriting', type: 'handwriting' },

  { name: 'Bastard', type: 'blackletter' },
  { name: 'Breitkopf Fraktur', type: 'blackletter' },
  { name: 'Cloister Black', type: 'blackletter' },
  { name: 'Fette Fraktur', type: 'blackletter' },
  { name: 'Fletcher', type: 'blackletter' },
  { name: 'Fraktur', type: 'blackletter' },
  { name: 'Lucida Blackletter', type: 'blackletter' },
  { name: 'Old English Text', type: 'blackletter' },
  { name: 'Schwabacher', type: 'blackletter' },

  { name: 'Aharoni', type: 'non-latin' },
  { name: 'Aparajita', type: 'non-latin' },
  { name: 'Arial', type: 'non-latin' },
  { name: 'Calibri', type: 'non-latin' },
  { name: 'Chandas', type: 'non-latin' },
  { name: 'Gadugi', type: 'non-latin' },
  { name: 'Grecs du roi', type: 'non-latin' },
  { name: 'Javanese script', type: 'non-latin' },
  { name: 'Japanese Gothic', type: 'non-latin' },
  { name: 'Jomolhari', type: 'non-latin' },
  { name: 'Kiran', type: 'non-latin' },
  { name: 'Kochi', type: 'non-latin' },
  { name: 'Koren', type: 'non-latin' },
  { name: 'Kruti Dev', type: 'non-latin' },
  { name: 'Malgun Gothic', type: 'non-latin' },
  { name: 'Meiryo', type: 'non-latin' },
  { name: 'Microsoft JhengHei', type: 'non-latin' },
  { name: 'Microsoft YaHei', type: 'non-latin' },
  { name: 'Minchō', type: 'non-latin' },
  { name: 'Ming', type: 'non-latin' },
  { name: 'Mona', type: 'non-latin' },
  { name: 'MS Gothic', type: 'non-latin' },
  { name: 'Nastaliq Navees', type: 'non-latin' },
  { name: 'Porson', type: 'non-latin' },
  { name: 'Segoe UI Symbol', type: 'non-latin' },
  { name: 'Shruti', type: 'non-latin' },
  { name: 'SimSun', type: 'non-latin' },
  { name: 'Sylfaen', type: 'non-latin' },
  { name: 'Tahoma', type: 'non-latin' },
  { name: 'Tengwar', type: 'non-latin' },
  { name: 'Tibetan Machine Uni', type: 'non-latin' },
  { name: 'Wilson Greek', type: 'non-latin' },

  { name: 'SMP', type: 'unicode' },
  { name: 'Microsoft Office', type: 'unicode' },
  { name: 'Bitstream Cyberbit', type: 'unicode' },
  { name: 'DejaVu fonts', type: 'unicode' },
  { name: 'Charis SIL', type: 'unicode' },
  { name: 'BMP', type: 'unicode' },
  { name: 'SMP', type: 'unicode' },
  { name: 'Code2002', type: 'unicode' },
  { name: 'DejaVu fonts', type: 'unicode' },
  { name: 'IPA', type: 'unicode' },
  { name: 'Everson Mono', type: 'unicode' },
  { name: 'Windows', type: 'unicode' },
  { name: 'Fixedsys Excelsior', type: 'unicode' },
  { name: 'FreeFont', type: 'unicode' },
  { name: 'Gentium', type: 'unicode' },
  { name: 'GNU Unifont', type: 'unicode' },
  { name: 'Georgia Ref', type: 'unicode' },
  { name: 'Microsoft Office', type: 'unicode' },
  { name: 'Junicode', type: 'unicode' },
  { name: 'Mac OS 8.5', type: 'unicode' },
  { name: 'macOS', type: 'unicode' },
  { name: 'ISO 8859-x', type: 'unicode' },
  { name: 'MS Gothic', type: 'unicode' },
  { name: 'MS Mincho', type: 'unicode' },
  { name: 'Nimbus Sans Global', type: 'unicode' },
  { name: 'Noto', type: 'unicode' },
  { name: 'Fabrizio Schiavi', type: 'unicode' },
  { name: 'Squarish Sans CT', type: 'unicode' },
  { name: 'XITS', type: 'unicode' },
  { name: 'Titus Cyberbit Basic', type: 'unicode' },
  { name: 'Verdana Ref', type: 'unicode' },
  { name: 'XITS', type: 'unicode' },

  { name: 'Apple Symbols', type: 'symbol' },
  { name: 'Asana-Math', type: 'symbol' },
  { name: 'Blackboard bold', type: 'symbol' },
  { name: 'Bookshelf Symbol 7', type: 'symbol' },
  { name: 'Cambria Math', type: 'symbol' },
  { name: 'Computer Modern', type: 'symbol' },
  { name: 'Lucida Math', type: 'symbol' },
  { name: 'Marlett', type: 'symbol' },
  { name: 'Symbol', type: 'symbol' },
  { name: 'Webdings', type: 'symbol' },
  { name: 'Wingdings', type: 'symbol' },
  { name: 'Wingdings 2', type: 'symbol' },
  { name: 'Wingdings 3', type: 'symbol' },
  { name: 'Zapf Dingbats', type: 'symbol' },

  { name: 'Ad Lib', type: 'decorative' },
  { name: 'Allegro', type: 'decorative' },
  { name: 'Andreas', type: 'decorative' },
  { name: 'Arnold Böcklin', type: 'decorative' },
  { name: 'Astur', type: 'decorative' },
  { name: 'Banco', type: 'decorative' },
  { name: 'Bauhaus', type: 'decorative' },
  { name: 'Braggadocio', type: 'decorative' },
  { name: 'Broadway', type: 'decorative' },
  { name: 'Caslon Antique', type: 'decorative' },
  { name: 'Cooper Black', type: 'decorative' },
  { name: 'Curlz', type: 'decorative' },
  { name: 'Ellington', type: 'decorative' },
  { name: 'Exocet', type: 'decorative' },
  { name: 'FIG Script', type: 'decorative' },
  { name: 'Forte', type: 'decorative' },
  { name: 'Gabriola', type: 'decorative' },
  { name: 'Horizon', type: 'decorative' },
  { name: 'Jim Crow', type: 'decorative' },
  { name: 'Lo-Type', type: 'decorative' },
  { name: 'Neuland', type: 'decorative' },
  { name: 'Peignot', type: 'decorative' },
  { name: 'San Francisco', type: 'decorative' },
  { name: 'Stencil', type: 'decorative' },
  { name: 'Umbra', type: 'decorative' },
  { name: 'Westminster', type: 'decorative' },
  { name: 'Willow', type: 'decorative' },
  { name: 'Windsor', type: 'decorative' },

  // Mimicry
  { name: 'Lithos', type: 'mimicry' },
  { name: 'Skia', type: 'mimicry' },

  { name: '3x3', type: 'misc' },
  { name: 'Compatil', type: 'misc' },
  { name: 'Generis', type: 'misc' },
  { name: 'Grasset', type: 'misc' },
  { name: 'LED', type: 'misc' },
  { name: 'Luxi', type: 'misc' },
  { name: 'System', type: 'misc' }
];
