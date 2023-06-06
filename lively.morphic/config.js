/* global System, process */
import { Rectangle, Color } from 'lively.graphics';
import { joinPath } from 'lively.lang/string.js';

// fixme: we are now using baseURL for 2 different purposes.
// 1.) Endpoint for loading a currently frozen part from
// 2.) Endpoint to fetch modules from aka where the lively server sits at
// This needs to be pulled apart.
const baseURL = typeof window !== 'undefined' && window.SERVER_URL ||
                typeof System !== 'undefined' && System.baseURL ||
                typeof document !== 'undefined' && document.location.origin ||
                typeof process !== 'undefined' && 'file://' + process.env.lv_next_dir;

if (typeof $world !== 'undefined') {
  $world.withAllSubmorphsDo(ea =>
    ea.hasOwnProperty('_cachedKeyhandlers') && (ea._cachedKeyhandlers = null));
}

function parseURLQuery () {
  if (typeof document === 'undefined' || !document.location) return {};
  const search = (document.location.hash || document.location.search).slice(1);
  const args = search && search.split('&');
  const options = {};
  if (args) {
    for (let i = 0; i < args.length; i++) {
      const keyAndVal = args[i].split('=');
      const key = keyAndVal[0];
      let val = true;
      if (keyAndVal.length > 1) {
        val = decodeURIComponent(keyAndVal.slice(1).join('='));
        if (val.match(/^(true|false|null|[0-9"[{].*)$/)) {
          try { val = JSON.parse(val); } catch (e) {
            if (val[0] === '[') val = val.slice(1, -1).split(','); // handle string arrays
            // if not JSON use string itself
          }
        }
      }
      options[key] = val;
    }
  }
  return options;
}

const config = {

  onloadURLQuery: parseURLQuery(),

  /* browser support 2 ways to render shadows:

  1. via boxShadows == fastShadows: true : these are fast since they just take into account the
     bounds of a certain html tag (as the name implies). Does not work nicely for
     images, polygon or composite morphs.
  2. via filter == fastShadows: false : these are accurate shadows applied precisely to the silhouette of
     a html tag composition. Also take into account svg shapes and transparency in
     images. To date (25.7.17) this options still seems to be burdensome for browsers.
     Only reccomended for demos and presentations, not productive use.
  */
  defaultShadow: { fast: true, distance: 18, blur: 30, color: Color.black.withA(0.2), spread: 0 },
  undoLevels: 20,
  halosEnabled: true,
  altClickDefinesThat: true,
  verboseLogging: true,
  maxStatusMessages: 5,
  repeatClickInterval: 250, // max time between clicks for double-, triple-click
  longClick: { minDur: 500, maxDur: 1000, maxDist: 2 }, // time and distance for long-click
  showTooltipsAfter: 0.8,

  users: {
    authServerURL: typeof window !== 'undefined' && window.AUTH_SERVER_URL || 'https://auth.lively-next.org',
    autoLoginAsGuest: false
  },

  ide: {

    workerEnabled: false,

    studio: {
      canvasModeEnabled: true,
      zoom: { step: 0.07, min: 0.02 },
      defaultMode: 'Halo', // can either be 'Halo' or 'Hand'
      worldMenuInTopBar: false
    },

    js: {
      ignoredPackages: [
        'lively.web', 'no group',
        url => url.includes('lively.morphic/objectdb') ||
               url.includes('lively.next-node_modules') ||
               url.includes('node_modules') ||
               url.includes('custom-npm-modules') ||
               url.includes('mocha-es6') ||
               url.includes('test-resources/es6')
      ],
      defaultInspectorImports: {
        'lively.graphics': ['pt', 'Color']
      }
    },

    modes: {
      aliases: {
        text: 'text',
        sh: 'shell',
        markdown: 'md',
        javascript: 'js',
        htmlmixed: 'html',
        haskell: 'hs',
        python: 'py',
        less: 'css/less'
      }
    }
  },

  globalKeyBindings: [

    { keys: { mac: 'Meta-Z', win: 'Ctrl-Z' }, command: 'undo' },
    { keys: { mac: 'Meta-Shift-Z', win: 'Ctrl-Shift-Z' }, command: 'redo' },
    { keys: 'Alt-X', command: 'run command' },
    { keys: { mac: 'Meta-S', win: 'Ctrl-S' }, command: 'save world' },
    { keys: 'Meta-Shift-L s a v e', command: 'save this world' },

    { keys: 'Meta-H', command: 'show halo for focused morph' },
    { keys: 'Meta-Shift-L C O P Y', command: 'copy morph' },
    { keys: 'Alt-M', command: 'select morph' },
    { keys: 'Escape', command: 'escape' },
    { keys: { win: 'Ctrl-Escape', mac: 'Meta-Escape' }, command: 'close active window or morph' },
    { keys: 'Alt-Shift-C', command: 'toggle minimize active window' },
    { keys: { mac: 'Meta-Shift-L W S', win: 'Ctrl-Shift-L W S' }, command: 'search workspaces' },
    { keys: { mac: 'Meta-O', win: 'Ctrl-O' }, command: 'open status message of focused morph' },

    { keys: { win: 'Ctrl-K', mac: 'Meta-K' }, command: { command: 'open javascript workspace', onlyWhenFocused: false } },
    { keys: 'Alt-Shift-1', command: { command: 'open shell terminal', onlyWhenFocused: false } },
    { keys: { win: 'Ctrl-B', mac: 'Meta-B' }, command: { command: 'open browser', onlyWhenFocused: false } },
    { keys: 'Alt-T', command: { command: 'choose and browse module', onlyWhenFocused: false } },
    { keys: 'Alt-Shift-T', command: { command: 'choose and browse package resources', onlyWhenFocused: false } },
    { keys: { mac: 'Ctrl-X D' }, command: 'open file browser' },
    { keys: { mac: 'Ctrl-X Ctrl-F' }, command: 'open file' },

    { keys: { win: 'Ctrl-Shift-F', mac: 'Meta-Shift-F' }, command: { command: 'open code search', onlyWhenFocused: false } },

    { keys: 'Left', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'left', offset: 1 } } },
    { keys: 'Right', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'right', offset: 1 } } },
    { keys: 'Up', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'up', offset: 1 } } },
    { keys: 'Down', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'down', offset: 1 } } },
    { keys: 'Meta-Left', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'left', offset: 10 } } },
    { keys: 'Meta-Right', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'right', offset: 10 } } },
    { keys: 'Meta-Up', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'up', offset: 10 } } },
    { keys: 'Meta-Down', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'down', offset: 10 } } },
    { keys: 'Alt-Left', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'left', offset: 100 } } },
    { keys: 'Alt-Right', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'right', offset: 100 } } },
    { keys: 'Alt-Up', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'up', offset: 100 } } },
    { keys: 'Alt-Down', command: { command: 'move or resize halo target', args: { what: 'move', direction: 'down', offset: 100 } } },

    { keys: 'Shift-Left', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'left', offset: 1 } } },
    { keys: 'Shift-Right', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'right', offset: 1 } } },
    { keys: 'Shift-Up', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'up', offset: 1 } } },
    { keys: 'Shift-Down', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'down', offset: 1 } } },
    { keys: 'Meta-Shift-Left', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'left', offset: 10 } } },
    { keys: 'Meta-Shift-Right', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'right', offset: 10 } } },
    { keys: 'Meta-Shift-Up', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'up', offset: 10 } } },
    { keys: 'Meta-Shift-Down', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'down', offset: 10 } } },
    { keys: 'Alt-Shift-Left', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'left', offset: 100 } } },
    { keys: 'Alt-Shift-Right', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'right', offset: 100 } } },
    { keys: 'Alt-Shift-Up', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'up', offset: 100 } } },
    { keys: 'Alt-Shift-Down', command: { command: 'move or resize halo target', args: { what: 'resize', direction: 'down', offset: 100 } } },

    { keys: { win: 'Delete', mac: 'Delete|Ctrl-D' }, command: 'close halo target' },

    { keys: { win: 'Ctrl-`|Alt-`', mac: 'Meta-1' }, command: 'window switcher' },

    { keys: { mac: 'Meta-Shift-L R E S 1', win: 'Ctrl-Shift-L R E S 1' }, command: { command: 'resize active window', args: { how: 'col1' } } },
    { keys: { mac: 'Meta-Shift-L R E S 2', win: 'Ctrl-Shift-L R E S 2' }, command: { command: 'resize active window', args: { how: 'col2' } } },
    { keys: { mac: 'Meta-Shift-L R E S 3', win: 'Ctrl-Shift-L R E S 3' }, command: { command: 'resize active window', args: { how: 'col3' } } },
    { keys: { mac: 'Meta-Shift-L R E S C', win: 'Ctrl-Shift-L R E S C' }, command: { command: 'resize active window', args: { how: 'center' } } },
    { keys: { mac: 'Meta-Shift-L R E S L', win: 'Ctrl-Shift-L R E S L' }, command: { command: 'resize active window', args: { how: 'left' } } },
    { keys: { mac: 'Meta-Shift-L R E S R', win: 'Ctrl-Shift-L R E S R' }, command: { command: 'resize active window', args: { how: 'right' } } },
    { keys: { mac: 'Meta-Shift-L R E S F', win: 'Ctrl-Shift-L R E S F' }, command: { command: 'resize active window', args: { how: 'full' } } },
    { keys: { mac: 'Meta-Shift-L R E S T', win: 'Ctrl-Shift-L R E S T' }, command: { command: 'resize active window', args: { how: 'top' } } },
    { keys: { mac: 'Meta-Shift-L R E S B', win: 'Ctrl-Shift-L R E S B' }, command: { command: 'resize active window', args: { how: 'bottom' } } },
    { keys: { mac: 'Meta-Shift-L R E S Escape', win: 'Ctrl-Shift-L R E S Escape' }, command: { command: 'resize active window', args: { how: 'reset' } } }
  ],

  text: {
    basicFontItems: [
      'Sans-serif',
      'serif',
      'Monospace',
      'Arial Black',
      'Arial Narrow',
      'Comic Sans MS',
      'Garamond',
      'Tahoma',
      'Trebuchet MS',
      'Verdana',
      'custom...'
    ],
    cursorBlinkPeriod: 0.5,
    useSoftTabs: true,
    tabWidth: 2,
    markStackSize: 16,
    undoLevels: 50,
    clipboardBufferLength: 100,
    useMultiSelect: true,
    undoGroupDelay: 600/* ms, idle time after typing that groups the previous ungrouped edits into one */,

    defaultKeyBindings: [
      { keys: { win: 'Ctrl-C', mac: 'Meta-C' }, command: { command: 'clipboard copy', passEvent: true } },
      { keys: 'Ctrl-W', command: { command: 'manual clipboard copy', args: { delete: true } } },
      { keys: 'Alt-W', command: 'manual clipboard copy' },
      { keys: 'Ctrl-Y', command: 'manual clipboard paste' },
      { keys: 'Alt-Y', command: { command: 'manual clipboard paste', args: { killRingCycleBack: true } } },
      { keys: { win: 'Ctrl-X', mac: 'Meta-X' }, command: { command: 'clipboard cut', passEvent: true } },
      { keys: { win: 'Ctrl-V', mac: 'Meta-V' }, command: { command: 'clipboard paste', passEvent: true } },

      { keys: { win: 'Ctrl-Z|Ctrl-Shift--', mac: 'Meta-Z|Ctrl-Shift--|Ctrl-x u' }, command: 'text undo' },
      { keys: { win: 'Ctrl-Shift-Z', mac: 'Meta-Shift-Z' }, command: 'text redo' },

      { keys: { win: 'Ctrl-A|Ctrl-X H', mac: 'Meta-A|Ctrl-X H' }, command: 'select all' },
      { keys: { win: 'Alt-Enter', mac: 'Meta-D|Alt-Enter' }, command: 'doit' },
      { keys: { mac: 'Meta-Shift-L X B' }, command: 'eval all' },
      { keys: { win: 'Alt-Ctrl-Enter', mac: 'Meta-P' }, command: 'printit' },
      { keys: { win: 'Alt-Ctrl-Shift-Enter', mac: 'Meta-I' }, command: 'print inspectit' },
      { keys: { win: 'Ctrl-Shift-I', mac: 'Meta-Shift-I' }, command: 'inspectit' },
      { keys: { win: 'Ctrl-Shift-E', mac: 'Meta-Shift-E' }, command: 'editit' },
      { keys: { win: 'Ctrl-Shift-U', mac: 'Meta-Shift-U' }, command: 'undefine variable' },
      { keys: { win: 'Alt-B', mac: 'Alt-B' }, command: 'blame line' },
      { keys: { win: 'Shift-Ctrl-B', mac: 'Shift-Ctrl-B' }, command: 'blame selection' },

      { keys: 'Backspace', command: 'delete backwards' },
      { keys: 'Shift-Backspace', command: 'delete backwards' },
      { keys: { win: 'Delete', mac: 'Delete|Ctrl-D' }, command: 'delete' },

      { keys: { win: 'Left|Ctrl-B', mac: 'Left|Ctrl-B' }, command: 'go left' },
      { keys: { win: 'Right|Ctrl-F', mac: 'Right|Ctrl-F' }, command: 'go right' },
      { keys: { win: 'Up|Ctrl-P', mac: 'Up|Ctrl-P' }, command: 'go up' },
      { keys: { win: 'Down|Ctrl-N', mac: 'Down|Ctrl-N' }, command: 'go down' },

      { keys: 'Shift-Left', command: 'select left' },
      { keys: 'Shift-Right', command: 'select right' },
      { keys: 'Shift-Up', command: 'select up' },
      { keys: 'Shift-Down', command: 'select down' },

      { keys: { win: 'Ctrl-Right', mac: 'Alt-Right|Alt-F' }, command: 'goto word right' },
      { keys: { win: 'Ctrl-Left', mac: 'Alt-Left|Alt-B' }, command: 'goto word left' },
      { keys: { win: 'Ctrl-Shift-Right', mac: 'Alt-Shift-Right|Alt-Shift-F' }, command: { command: 'goto word right', args: { select: true } } },
      { keys: { win: 'Ctrl-Shift-Left', mac: 'Alt-Shift-Left|Alt-Shift-B' }, command: { command: 'goto word left', args: { select: true } } },
      { keys: { win: 'Ctrl-Backspace', mac: 'Alt-Backspace' }, command: 'delete word left' },
      { keys: 'Alt-D', command: 'delete word right' },
      { keys: { win: 'Alt-Ctrl-K', mac: 'Alt-Ctrl-K' }, command: 'delete word right'/* actualle delete sexp! */ },
      { keys: 'Alt-Shift-2', command: 'select word right' },

      { keys: 'Ctrl-X Ctrl-X', command: 'reverse selection' },
      { keys: { win: 'Ctrl-Shift-L', mac: 'Meta-L' }, command: 'select line' },
      { keys: { win: 'Shift-Home', mac: 'Shift-Home|Ctrl-Shift-A' }, command: { command: 'goto line start', args: { select: true } } },
      { keys: { win: 'Home', mac: 'Home|Ctrl-A' }, command: { command: 'goto line start', args: { select: false } } },
      { keys: { win: 'Shift-End', mac: 'Shift-End|Ctrl-Shift-E' }, command: { command: 'goto line end', args: { select: true } } },
      { keys: { win: 'End', mac: 'End|Ctrl-E' }, command: { command: 'goto line end', args: { select: false } } },

      { keys: 'Ctrl-C J', command: { command: 'join line', args: { withLine: 'before' } } },
      { keys: 'Ctrl-C Shift-J', command: { command: 'join line', args: { withLine: 'after' } } },
      { keys: { win: 'Ctrl-Shift-D', mac: 'Meta-Shift-D|Ctrl-C P' }, command: 'duplicate line or selection' },
      { keys: { win: 'Ctrl-Shift-Backspace', mac: 'Meta-Backspace' }, command: 'delete left until beginning of line' },
      { keys: 'Ctrl-K', command: 'delete emtpy line or until end of line' },

      { keys: { win: 'Ctrl-Alt-Up|Ctrl-Alt-P', mac: 'Ctrl-Meta-Up|Ctrl-Meta-P' }, command: 'move lines up' },
      { keys: { win: 'Ctrl-Alt-Down|Ctrl-Alt-N', mac: 'Ctrl-Meta-Down|Ctrl-Meta-N' }, command: 'move lines down' },

      { keys: { win: 'PageDown', mac: 'PageDown|Ctrl-V' }, command: 'goto page down' },
      { keys: { win: 'PageUp', mac: 'PageUp|Alt-V' }, command: 'goto page up' },
      { keys: { win: 'Shift-PageDown', mac: 'Shift-PageDown' }, command: 'goto page down and select' },
      { keys: { win: 'Shift-PageUp', mac: 'Shift-PageUp' }, command: 'goto page up and select' },
      { keys: 'Alt-Ctrl-,'/* Alt-Ctrl-< */, command: 'move cursor to screen top in 1/3 steps' },
      { keys: 'Alt-Ctrl-.'/* Alt-Ctrl-< */, command: 'move cursor to screen bottom in 1/3 steps' },

      { keys: { win: 'Alt-Left', mac: 'Meta-Left' }, command: 'goto matching left' },
      { keys: { win: 'Alt-Shift-Left', mac: 'Meta-Shift-Left' }, command: { command: 'goto matching left', args: { select: true } } },
      { keys: { win: 'Alt-Right', mac: 'Meta-Right' }, command: 'goto matching right' },
      { keys: { win: 'Alt-Shift-Right', mac: 'Meta-Shift-Right' }, command: { command: 'goto matching right', args: { select: true } } },

      // FIXME this is actually fwd/bwd sexp
      { keys: 'Alt-Ctrl-B', command: 'goto matching left' },
      { keys: 'Alt-Ctrl-F', command: 'goto matching right' },

      { keys: 'Ctrl-Up', command: 'goto paragraph above' },
      { keys: 'Ctrl-Down', command: 'goto paragraph below' },

      { keys: { win: 'Ctrl-Shift-Home', mac: 'Meta-Shift-Up' }, command: { command: 'goto start', args: { select: true } } },
      { keys: { win: 'Ctrl-Shift-End', mac: 'Meta-Shift-Down' }, command: { command: 'goto end', args: { select: true } } },
      { keys: { win: 'Ctrl-Home', mac: 'Meta-Up|Meta-Home|Alt-Shift-,' }, command: 'goto start' },
      { keys: { win: 'Ctrl-End', mac: 'Meta-Down|Meta-End|Alt-Shift-.' }, command: 'goto end' },

      { keys: 'Ctrl-L', command: 'realign top-bottom-center' },
      { keys: { win: 'Ctrl-Shift-L', mac: 'Ctrl-Shift-L|Alt-G G' }, command: 'goto line' },

      { keys: 'Enter', command: 'newline' },
      { keys: 'Space', command: { command: 'insertstring', args: { string: ' ', undoGroup: true } } },
      { keys: 'Tab', command: { command: 'tab - snippet expand or indent' } },

      { keys: { win: 'Ctrl-]', mac: 'Meta-]' }, command: 'indent' },
      { keys: { win: 'Ctrl-[', mac: 'Meta-[' }, command: 'outdent' },

      { keys: { win: 'Ctrl-Enter', mac: 'Meta-Enter' }, command: { command: 'insert line', args: { where: 'below' } } },
      { keys: 'Shift-Enter', command: { command: 'insert line', args: { where: 'above' } } },
      { keys: 'Ctrl-O', command: 'split line' },

      { keys: { mac: 'Ctrl-X Ctrl-T' }, command: 'transpose chars' },
      { keys: { mac: 'Ctrl-C Ctrl-U' }, command: 'uppercase' },
      { keys: { mac: 'Ctrl-C Ctrl-L' }, command: 'lowercase' },
      { keys: { mac: 'Meta-Shift-L W t' }, command: 'remove trailing whitespace' },

      { keys: { mac: 'Ctrl-Space' }, command: 'toggle active mark' },

      { keys: { mac: 'Meta-Shift-L M O D E' }, command: 'change editor mode' },
      { keys: { mac: 'Meta-Shift-L L T' }, command: 'toggle line wrapping' },

      { keys: 'Esc|Ctrl-G', command: 'cancel input' },

      { keys: { win: 'Ctrl-/', mac: 'Meta-/' }, command: 'toggle comment' },
      { keys: { win: 'Alt-Ctrl-/', mac: 'Alt-Meta-/|Alt-Meta-÷'/* FIXME */ }, command: 'toggle block comment' },
      { keys: 'Meta-Shift-L /  D', command: 'comment box' },

      { keys: { win: 'Ctrl-.', mac: 'Meta-.' }, command: '[IyGotoChar] activate' },
      { keys: { win: 'Ctrl-,', mac: 'Meta-,' }, command: { command: '[IyGotoChar] activate', args: { backwards: true } } },

      { keys: { win: 'Ctrl-Space|Ctrl-Shift-P', mac: 'Alt-Shift-Space|Alt-Space|Meta-Shift-P' }, command: 'text completion' },
      { keys: '÷|Alt-/', command: 'text completion first match' },

      { keys: 'Alt-Q', command: 'fit text to column' },

      { keys: { win: 'Ctrl-F|Ctrl-G|F3', mac: 'Meta-F|Meta-G|Ctrl-S' }, command: 'search in text' },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // multi select bindings
      { keys: 'Ctrl-Shift-/|Ctrl-C Ctrl-Shift-,', command: '[multi select] all like this' },
      { keys: 'Alt-Ctrl-P', command: '[multi select] add cursor above' },
      { keys: 'Alt-Ctrl-N', command: '[multi select] add cursor below' },
      { keys: 'Ctrl-Shift-,', command: '[multi select] more like this backward' },
      { keys: 'Ctrl-Shift-.', command: '[multi select] more like this forward' },
      { keys: { mac: 'Meta-Shift-,' }, command: '[multi select] goto previous focused cursor' },
      { keys: { mac: 'Meta-Shift-.' }, command: '[multi select] goto next focused cursor' },
      { keys: 'Ctrl-Shift-;', command: '[multi select] remove focused cursor' },
      { keys: 'Alt-Ctrl-A', command: '[multi select] align cursors' },
      { keys: 'Ctrl-X R', command: '[multi select] create rectangular selection' },

      { keys: { win: 'Shift-Ctrl-S|Ctrl-Alt-Space', mac: 'Ctrl-Command-space|Ctrl-Alt-Space' }, command: 'contractRegion' },
      { keys: { win: 'Shift-Ctrl-E|Ctrl-Shift-Space', mac: 'Shift-Command-Space|Ctrl-Shift-Space' }, command: 'expandRegion' },
      { keys: 'Ctrl-Alt-h', command: 'markDefun' },
      { keys: 'Ctrl-Alt-d|Ctrl-Alt-Down', command: 'forwardDownSexp' },
      { keys: 'Ctrl-Alt-u|Ctrl-Alt-Up', command: 'backwardUpSexp' },
      { keys: 'Ctrl-Alt-b|Ctrl-Alt-Left', command: 'backwardSexp' },
      { keys: 'Ctrl-Alt-f|Ctrl-Alt-Right', command: 'forwardSexp' },
      { keys: 'Alt-.', command: 'selectDefinition' },
      { keys: "Ctrl-Shift-'", command: 'selectSymbolReferenceOrDeclaration' },
      { keys: 'Ctrl-Shift-[', command: 'selectSymbolReferenceOrDeclarationPrev' },
      { keys: 'Ctrl-Shift-]', command: 'selectSymbolReferenceOrDeclarationNext' },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // rich text
      { keys: { win: 'Ctrl-=', mac: 'Meta-=' }, command: 'increase font size' },
      { keys: { win: 'Ctrl--', mac: 'Meta--' }, command: 'decrease font size' },
      { keys: 'Alt-K', command: 'set link of selection' },
      { keys: 'Alt-O', command: 'set doit of selection' },
      { keys: { win: 'Ctrl-\\', mac: 'Meta-\\' }, command: 'reset text style' },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // helpful stuff
      { keys: { win: 'Ctrl-Shift-L T D', mac: 'Meta-Shift-L T D' }, command: '[todo] toggle todo marker' },
      { keys: { win: 'Ctrl-Shift-L D A T E', mac: 'Meta-Shift-L D A T E' }, command: 'insert date' },
      { keys: 'Ctrl-C Ctrl-I', command: 'change string inflection' },
      { keys: 'Alt-Shift-4'/* Alt-Shift-$ */, command: 'spell check word' },
      { keys: 'Alt-Shift-\\'/* Alt-Shift-| */, command: '[shell] run shell command on region' },
      { keys: 'Alt-Shift-;', command: 'run code on text morph' },
      { keys: { win: 'Ctrl-Shift-L O P E N', mac: 'Meta-Shift-L O P E N' }, command: 'open file at cursor' },
      { keys: 'Meta-F1', command: 'report token at cursor' }
    ]

  },

  codeEditor: {
    defaultTheme: 'default',
    collapseSelection: false,
    search: {
      maxCharsPerLine: 10e3,
      fastHighlightLineCount: 4e3,
      showTextMap: true
    },
    defaultStyle: {
      fontFamily: 'IBM Plex Mono',
      padding: Rectangle.inset(4, 2, 4, 2),
      fontSize: 12,
      clipMode: 'auto'
    },

    modes: {
      text: { style: {} }
    }
  },

  systemBrowser: {
    fixUndeclaredVarsOnSave: true
  },

  objectEditor: {
    fixUndeclaredVarsOnSave: true
  },

  remotes: {
    server: typeof System !== 'undefined' && System.get('@system-env').browser ? `${document.location.origin}/eval` : null
  },

  css: {
    ibmPlex: joinPath(baseURL, 'lively.morphic/assets/ibm-plex/css/ibm-plex.css'),
    fontAwesome: joinPath(baseURL, '/lively.morphic/assets/fontawesome-free-6.1.1-web/css/all.css'),
    inconsolata: joinPath(baseURL, '/lively.morphic/assets/inconsolata/inconsolata.css'),
    tablerIcons: joinPath(baseURL, '/lively.morphic/assets/tabler-icons/all.css'),
    materialIcons: joinPath(baseURL, '/lively.morphic/assets/material-icons/stylesheet.css')
  },

  defaultImage: 'data:image/png;base64,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'

};

export default config;
