import { obj } from 'lively.lang';
export const DEFAULT_FONTS = [
  {
    name: 'Alegreya',
    supportedWeights: []
  },
  {
    name: 'Amatic SC',
    supportedWeights: []
  },
  {
    name: 'Arimo',
    supportedWeights: []
  },
  {
    name: 'Bree Serif',
    supportedWeights: []
  },
  {
    name: 'Cantarell',
    supportedWeights: []
  },
  {
    name: 'Caveat',
    supportedWeights: []
  },
  {
    name: 'Comfortaa',
    supportedWeights: []
  },
  {
    name: 'Courier Prime',
    supportedWeights: []
  },
  {
    name: 'EB Garamond',
    supportedWeights: []
  },
  {
    name: 'Font Awesome',
    supportedWeights: []
  },
  {
    name: 'Gideon Roman',
    supportedWeights: []
  },
  {
    name: 'IBM Plex Mono',
    supportedWeights: [100, 200, 300, 400, 500, 600]
  },
  {
    name: 'IBM Plex Sans',
    supportedWeights: [100, 200, 300, 400, 500, 600]
  },
  {
    name: 'IBM Plex Serif',
    supportedWeights: [100, 200, 300, 400, 500, 600]
  },
  {
    name: 'Inconsolata',
    supportedWeights: []
  },
  {
    name: 'Lexend',
    supportedWeights: []
  },
  {
    name: 'Lobster',
    supportedWeights: []
  },
  {
    name: 'Lora',
    supportedWeights: []
  },
  {
    name: 'Material Icons',
    supportedWeights: []
  },
  {
    name: 'Merriweather',
    supportedWeights: [300, 400, 700, 900]
  },
  {
    name: 'Montserrat',
    supportedWeights: [100, 200, 300, 400, 500, 600, 700, 800, 900]
  },
  {
    name: 'Noto Emoji',
    supportedWeights: [300, 400, 500, 600, 700]
  },
  {
    name: 'Nunito',
    supportedWeights: [200, 300, 400, 500, 600, 700, 800, 900]
  },
  {
    name: 'Open Sans',
    supportedWeights: []
  }, {
    name: 'Oranienbaum',
    supportedWeights: []
  },
  {
    name: 'Oswald',
    supportedWeights: []
  },
  {
    name: 'Pacifico',
    supportedWeights: []
  },
  {
    name: 'Permanent Marker',
    supportedWeights: []
  },
  {
    name: 'Pinyon Script',
    supportedWeights: []
  },
  {
    name: 'Playfair Display',
    supportedWeights: []
  },
  {
    name: 'Roboto',
    supportedWeights: [100, 300, 400, 500, 900]
  },
  {
    name: 'Roboto Mono',
    supportedWeights: []
  },
  {
    name: 'Roboto Serif',
    supportedWeights: []
  },
  {
    name: 'Spectral',
    supportedWeights: [200, 300, 400, 500, 600, 700]
  },
  {
    name: 'Tabler Icons',
    supportedWeights: []
  },
  {
    name: 'Titillium Web',
    supportedWeights: [200, 300, 400, 600, 700, 900]
  },
  {
    name: 'Ultra',
    supportedWeights: []
  },
  {
    name: 'Varela Round',
    supportedWeights: []
  }
];

export function availableFonts () {
  if (typeof lively !== 'undefined' && lively.FreezerRuntime?.availableFonts) return lively.FreezerRuntime.availableFonts;
  if (typeof $world === 'undefined' || !$world.openedProject) return DEFAULT_FONTS;
  return $world.openedProject.projectFonts.concat(DEFAULT_FONTS);
}

export function generateFontFaceString (customFontFaceObj) {
  let { fontName, fileName, fontWeight, fontStyle, unicodeRange } = customFontFaceObj;
  const fontfaceString = `@font-face {
  font-family: '${fontName}';
  src: url('./assets/${fileName}.woff2');FONT_WEIGHT_PLACEHOLDERfont-style: ${fontStyle};
  unicode-range: ${(unicodeRange === '' ? false : unicodeRange) || "''" };
  font-display: swap;
}

`;
  const hasExplicitFontWeight = fontWeight && !(obj.isArray(fontWeight) && fontWeight.length === 0);
  return fontfaceString.replace('FONT_WEIGHT_PLACEHOLDER', hasExplicitFontWeight ? `\n  font-weight: ${obj.isArray(fontWeight) ? fontWeight.join(' ') : fontWeight };\n  ` : '\n  ');
}
