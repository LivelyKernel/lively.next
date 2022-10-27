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
      { keys: { win: 'Ctrl-Shift-F|Ctrl-Shift-G', mac: 'Meta-Shift-F|Meta-Shift-G|Ctrl-R' }, command: { command: 'search in text', args: { backwards: true } } },

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
      { keys: { win: 'Ctrl-Shift-L T U I', mac: 'Meta-Shift-L T U I' }, command: 'open text attribute controls' },

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
    inconsolata: joinPath(baseURL, '/lively.morphic/assets/inconsolata/inconsolata.css')
  },

  defaultImage: 'data:image/svg+xml;base64,PCEtLT94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8tLT4KPHN2ZyB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHY9IiIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSI+CiAgPHRpdGxlPkxpdmVseSBXZWIgTG9nbzwvdGl0bGU+CiAgPGRlc2NyaXB0aW9uPmh0dHBzOi8vbGl2ZWx5LW5leHQub3JnPC9kZXNjcmlwdGlvbj4KICA8ZGVmcz48L2RlZnM+CiAgPGcgaWQ9ImxvZ28iIHRyYW5zZm9ybT0ic2NhbGUoMikiPgogICAgPHBhdGggZD0iTTU3LjExMzEwNzksMTQuNzA3IEM1Ni4zMDUxMDc5LDE3LjAxNyA1NS42MDcxMDc5LDE5LjM2MiA1NC43OTkxMDc5LDIxLjY3MSBDNTQuMzYxMTA3OSwyMi45MjYgNTMuODk0MTA3OSwyMy41MTggNTMuMjAxMTA3OSwyMy41MTggQzUyLjc0MzEwNzksMjMuNTE4IDUyLjE4NTEwNzksMjMuMjYgNTEuNDc0MTA3OSwyMi43NjcgQzQ5LjQwMTEwNzksMjEuMzIgNDcuNDAzMTA3OSwxOS43NjUgNDUuMzE4MTA3OSwxOC4zMjggQzQ0LjIyNzEwNzksMTcuNTczIDQzLjE4NTEwNzksMTcuMTk2IDQyLjIwMTEwNzksMTcuMTk2IEM0MC44NDcxMDc5LDE3LjE5NiAzOS41OTgxMDc5LDE3LjkwNCAzOC40NTUxMDc5LDE5LjMyNCBDMzcuMzE2MTA3OSwyMC43MzcgMzYuMjY5MTA3OSwyMi4yMzEgMzUuMjMyMTA3OSwyMy43MjUgQzMzLjI3NjEwNzksMjYuNTI1IDMzLjY0NDEwNzksMjguODUgMzYuMzcxMTA3OSwzMC45MDMgQzM4LjMzMTEwNzksMzIuMzc3IDQwLjM1MTEwNzksMzMuNzY4IDQyLjMwOTEwNzksMzUuMjQ0IEM0NC4xNTExMDc5LDM2LjYyOSA0NC4xMjgxMDc5LDM3LjQ2NyA0Mi4yMzcxMDc5LDM4Ljg3IEM0MC4yMDYxMDc5LDQwLjM4MiAzOC4xMDUxMDc5LDQxLjggMzYuMTEyMTA3OSw0My4zNTMgQzMzLjczNDEwNzksNDUuMjAzIDMzLjM1OTEwNzksNDcuNTMzIDM1LjAxNjEwNzksNTAuMDE0IEMzNi4xMTIxMDc5LDUxLjY1NyAzNy4yNjQxMDc5LDUzLjI3MSAzOC41MTkxMDc5LDU0Ljc5NyBDMzkuNjY1MTA3OSw1Ni4xOTggNDAuODcyMTA3OSw1Ni44ODcgNDIuMTgyMTA3OSw1Ni44ODcgQzQzLjE4MDEwNzksNTYuODg3IDQ0LjIzNjEwNzksNTYuNDg4IDQ1LjM4MDEwNzksNTUuNjk1IEM0Ny4zMzAxMDc5LDU0LjM0NCA0OS4yMTcxMDc5LDUyLjkwMSA1MS4xNDIxMDc5LDUxLjUxOSBDNTIuMDg3MTA3OSw1MC44MzggNTIuNzQ0MTA3OSw1MC40NzcgNTMuMjUzMTA3OSw1MC40NzcgQzUzLjk0NzEwNzksNTAuNDc3IDU0LjM2NDEwNzksNTEuMTYgNTQuODcwMTA3OSw1Mi42MzggQzU1LjY3OTEwNzksNTUuMDI4IDU2LjM4NTEwNzksNTcuNDU4IDU3LjI1NTEwNzksNTkuODI1IEM1OC4wNTExMDc5LDYxLjk5NSA1OS41MDUxMDc5LDYzLjA5NCA2MS40NDAxMDc5LDYzLjA5NCBDNjIuMDE4MTA3OSw2My4wOTQgNjIuNjM5MTA3OSw2Mi45OTYgNjMuMzAxMTA3OSw2Mi44IEM2NC45NjQxMDc5LDYyLjMwNyA2Ni42MjAxMDc5LDYxLjc4IDY4LjI2MTEwNzksNjEuMjE2IEM3MS43MjExMDc5LDYwLjAzMSA3Mi44MDQxMDc5LDU3Ljk0NCA3MS43MzYxMDc5LDU0LjQwNyBDNzEuMDI4MTA3OSw1Mi4wNjYgNzAuMjMxMTA3OSw0OS43NTEgNjkuNDQ1MTA3OSw0Ny40MzcgQzY4LjgwNDEwNzksNDUuNTUgNjkuNTU2MTA3OSw0NC43MzcgNzEuNDM4MTA3OSw0NC43MzQgQzcxLjU5NzEwNzksNDQuNzM0IDcxLjc2MDEwNzksNDQuNzMyIDcxLjkyMjEwNzksNDQuNzMyIEM3My4xOTcxMDc5LDQ0LjczMiA3NC40NzMxMDc5LDQ0Ljc0MyA3NS43NTExMDc5LDQ0Ljc0MyBDNzYuOTI0MTA3OSw0NC43NDMgNzguMDk2MTA3OSw0NC43MzQgNzkuMjcwMTA3OSw0NC42OTggQzgyLjM5NDEwNzksNDQuNiA4NC4wNDMxMDc5LDQyLjkwOSA4NC4xNDQxMDc5LDM5Ljc4MSBDODQuMTk1MTA3OSwzOC4xMTkgODQuMTY2MTA3OSwzNi40NTcgODQuMTUzMTA3OSwzNC43OTUgQzg0LjEyMTEwNzksMzEuMTY0IDgyLjQ2NDEwNzksMjkuMzkxIDc4Ljg0NzEwNzksMjkuMjUgQzc4LjAxODEwNzksMjkuMjE5IDc3LjE4ODEwNzksMjkuMjEgNzYuMzU5MTA3OSwyOS4yMSBDNzUuMTMwMTA3OSwyOS4yMSA3My44OTkxMDc5LDI5LjIzIDcyLjY2OTEwNzksMjkuMjMgTDcyLjIwMTEwNzksMjkuMjMgQzY5LjAwODEwNzksMjkuMjE0IDY4Ljc2MzEwNzksMjguODM4IDY5Ljc1NDEwNzksMjUuNzQyIEM3MC42NDMxMDc5LDIyLjk2OSA3MS40OTIxMDc5LDIwLjE4MiA3Mi4xNjExMDc5LDE4LjAzMiBDNzIuMDk2MTA3OSwxNS4zNTQgNzEuMDI4MTA3OSwxMy44NDQgNjguOTQ2MTA3OSwxMy4wNzUgQzY3LjE3MjEwNzksMTIuNDIyIDY1LjM1NzEwNzksMTEuODY1IDYzLjUzODEwNzksMTEuMzM0IEM2Mi43NzcxMDc5LDExLjExMSA2Mi4wODIxMDc5LDExIDYxLjQ1MTEwNzksMTEgQzU5LjM4MjEwNzksMTEgNTcuOTg3MTA3OSwxMi4yMDcgNTcuMTEzMTA3OSwxNC43MDcgWiBNNjIuMTA3MjE5OCwxNS4zMjQ0ODc0IEM2My42NjI2MzIsMTUuNzc5NTA4MSA2NS40OTQ1ODQxLDE2LjMzMTUzMzIgNjcuMjQyNjc1OCwxNi45NzY1NjI1IEM2Ny40OTcyNTIyLDE3LjA3MDU2NjggNjcuNjEyMDYxMiwxNy4xNTM1NzA1IDY3LjYzMTAyOTcsMTcuMTczNTcxNSBDNjcuNjMxMDI5NywxNy4xNzU1NzE1IDY3LjcxMjg5MzUsMTcuMjk3NTc3MSA2Ny43NjU4MDU0LDE3LjY2MDU5MzYgTDY3LjM0MjUwOTcsMTkuMDI4NjU1OCBDNjYuODEyMzkxNywyMC43NDc3MzM5IDY2LjQxNDcyNTYsMjIuNTMyMzQyNCA2NS43OTg3NTA0LDI0LjQ1NzQyOTkgQzY1LjI0ODY2NTYsMjYuMTY4NTA3NyA2NC40MjQwMzc1LDI4Ljc1MzYyNTIgNjYuMDM5MzUwMSwzMC45ODM3MjY1IEM2Ny42NTE2Njc2LDMzLjIxMDgyNzggNzAuMzEwMjQ0NSwzMy4yMjI4MjgzIDcyLjA2OTMxNzksMzMuMjI4ODI4NiBMNzIuNTU2NTA3MywzMy4yMzE4Mjg3IEM3My4xODE0Njc1LDMzLjIzMTgyODcgNzMuODA2NDI3OCwzMy4yMjQ4Mjg0IDc0LjQzMjM4NjQsMzMuMjIwODI4MiBDNzUuMDM0Mzg0OCwzMy4yMTY4MjggNzQuNzE5NjA1NywzMy4xNzc3MzI1IDc1LjMyMTYwNDEsMzMuMTc3NzMyNSBDNzYuMjI5MDk0MywzMy4xNzc3MzI1IDc0LjgzMjY2NTksMzMuMTcwOTkyNCA3NS41MTE1MzY0LDMzLjE5Njk5MzUgQzc2LjM2NjExNDYsMzMuMjI4OTk1IDc2LjY5MDU3NDgsMzMuMzkxMDAyNCA3Ni43MTU1MzMzLDMzLjM5MTAwMjQgQzc2Ljc0MDQ5MTgsMzMuNDM0MDA0MyA3Ni45MTMyMDQ0LDMzLjc3ODAyIDc2LjkyMDE5MjgsMzQuNzMyMDYzMyBMNzYuOTI5MTc3OCwzNS41NTAxMDA1IEM3Ni45NDMxNTQ2LDM2LjkzOTE2MzYgNzYuOTU3MTMxMywzOC4yNDkyMjMyIDc2LjkxNDIwMjgsMzkuNTUxMjgyNCBDNzYuOTAwMjI2LDQwLjA0MDMwNDYgNzYuODIwMzU4OSw0MC4zMTczMTcyIDc2Ljc3MzQzNyw0MC40MjQzMjIxIEM3Ni42NzI2MDQ3LDQwLjQ2NTMyMzkgNzYuNDE1MDMzMiw0MC41MzgzMjcyIDc1Ljk2Mzc4NCw0MC41NTMzMjc5IEM3NC45ODQ0MTM0LDQwLjU4MzMyOTMgNzYuMDc5MzQzNCw0MC42MTYwNzA2IDc0LjcxNDYxNCw0MC42MTYwNzA2IEM3NC4wODE2NjcsNDAuNjE2MDcwNiA3NC4zNzA0ODkzLDQwLjY0NjE2NTcgNzMuNzM5NTM5MSw0MC42NDQxNjU2IEM3My4wOTc2MDcxLDQwLjY0MDE2NTUgNzIuNDUwNjgzNCw0MC42MzYxNjUzIDcxLjgxMDc0ODEsNDAuNjM2MTY1MyBMNzEuMzE2NTcwMiw0MC42MzkxNjU0IEM2OC4zNzk0NTY4LDQwLjY0NDE2NTYgNjYuODQyMDE0Nyw0MS45MzUyMjQzIDY2LjA2ODMwMTksNDMuMDE3MjczNSBDNjUuMzAxNTc3Niw0NC4wOTUzMjI1IDY0LjU4MDc3NjgsNDUuOTU0NDA3IDY1LjUxMDIzMDQsNDguNjkzNTMxNSBMNjUuNzUwODMwMSw0OS4zOTE1NjMzIEM2Ni40MzE2OTczLDUxLjQwNjY1NDggNjUuNTE2MTIzNiw0OC4zMDA1NDIzIDY2LjEyNzEwNzEsNTAuMzM4NjM0OSBDNjYuMzUxNzMzMyw1MS4wODA2Njg2IDY2LjM1NzcyMzQsNTEuNDYxNjg1OSA2Ni4zNDY3NDE3LDUxLjYwMTY5MjMgQzY2LjI0MDkxNzcsNTEuNjkwNjk2NCA2NS45MzU0MjYsNTEuOTAzNzA2IDY1LjIxOTYxNjksNTIuMTQ4NzE3MiBDNjMuNjM3MjQ5NSw1Mi42OTE3NDE5IDYyLjAyNzkyNyw1My4yMDU3NjUyIDYwLjQyNzU4OTUsNTMuNjgwNzg2OCBDNjAuMDU4MjA0MSw1My43ODk3OTE4IDU5LjgyNjU4OTQsNTMuODA2NzkyNSA1OS43MjA3NjU1LDUzLjgwNjc5MjUgQzU5LjU4Nzk4NjQsNTMuNzI5Nzg5IDU5LjQ2MzE5NCw1My41Mzc3ODAzIDU5LjMzNDQwODMsNTMuMTg3NzY0NCBDNTguODM2MjM3MSw1MS44Mjc3MDI2IDU5LjEzNjE0ODcsNTIuOTQzNjQxMSA1OC42Njg5MjYsNTEuNDgyNTc0NiBDNTguMzYwNDM5Myw1MC41MTc1MzA4IDU4LjkzNzE2NjIsNTIuMjQ3NjkzMSA1OC42MTA3MDkzLDUxLjI4NzY0OTQgQzU4LjE5OTM5MzcsNTAuMDc0NTk0MyA1Ni45NDc0NzY1LDQ2LjM4MjQyNjUgNTMuMTcyNzU2Niw0Ni4zODI0MjY1IEM1MS4zNjQ3NjQ2LDQ2LjM4MjQyNjUgNDkuOTIwMTY4MSw0Ny4zMTI0Njg3IDQ4LjcwNzE4NjEsNDguMTgzNTA4MyBDNDcuOTM5NDYzNCw0OC43Mzc1MzM1IDQ5LjM0OTQxNCw0Ny43MjEwNDU4IDQ4LjU4NjY4Myw0OC4yODMwNzE0IEM0Ny40MTc2MjgsNDkuMTQ2MTEwNiA0OC44NTIwMzYxLDQ4LjA1MjEyNzcgNDcuNzE3OTIzLDQ4Ljg0MDE2MzUgQzQ3LjI3OTY1MjIsNDkuMTQ0MTc3MyA0Ny4wMTAxMDA2LDQ5LjI1MzE4MjMgNDYuODk1MjkxNiw0OS4yOTIxODQxIEM0Ni43OTY0NTYxLDQ5LjIyNDE4MSA0Ni41ODg4MDE1LDQ5LjA1NzE3MzQgNDYuMjk4Mjg0OSw0OC43MDIxNTcyIEM0NS4yNjc5OTksNDcuNDQyMSA0NC4yMDE3NzI5LDQ1Ljk4NDAzMzcgNDMuMDM2NzExMyw0NC4yMzU5NTQyIEM0Mi43OTQxMTQ5LDQzLjg3MTkzNzcgNDIuNzI3MjI2Miw0My42NTE5Mjc3IDQyLjcwOTI1NjEsNDMuNTY4OTIzOSBDNDIuNzUyMTg0Niw0My40OTQ5MjA1IDQyLjg4OTk1NTQsNDMuMzAxOTExOCA0My4yNDkzNTc1LDQzLjAxNzg5ODkgQzQ0LjM3MzQ4NzIsNDIuMTQyODU5MSA0Mi45ODk5OTQ0LDQzLjIyMjg0MTQgNDQuMjE1OTU0Nyw0Mi4zNDU4MDE1IEM0NS4wNjY1Mzk2LDQxLjczNDc3MzcgNDMuNzQ3NDM3OCw0Mi42OTkyNTkxIDQ0LjU4NzA0MDksNDIuMDczMjMwNiBDNDUuNDIyNjUwNyw0MS40NTEyMDIzIDQ3LjY0Mjk1NjcsMzkuNzk5MTI3MiA0Ny42NDg5NDY4LDM2Ljk5Njk5OTkgQzQ3LjY1OTkyODUsMzQuMjA4ODczMSA0NS40OTM1MzI4LDMyLjU3Njc5ODkgNDQuNjc4ODg4MSwzMS45NjA3NzA5IEM0My42Nzk1NTA4LDMxLjIwOTczNjggNDIuNjY0MjQsMzAuNDczNzAzNCA0MS42NDQ5MzU4LDI5Ljc0MTY3MDEgQzQwLjY3NTU0ODYsMjkuMDQzNjM4MyA0Mi42MzkxNTI0LDMwLjU5NTkyOTEgNDEuNjg1NzM4NiwyOS44NzY4OTY0IEM0MS4yMDU1Mzc2LDI5LjUxMzg3OTkgNDEuMDEwODYxNCwyOS4yNjY4Njg3IDQwLjk0MTk3NjEsMjkuMTU5ODYzOCBDNDAuOTc1OTE5NiwyOS4wMzY4NTgyIDQxLjA4NTczNjksMjguNzM4ODQ0NyA0MS40MjcxNjg4LDI4LjI0MzgyMjIgQzQyLjQwNjUzOTQsMjYuODQxNzU4NSA0My40MTI4NjUyLDI1LjM5MjY5MjYgNDQuNDc5MDkxMywyNC4wNjk2MzI1IEM0NC43ODA1ODk2LDIzLjY5MjYxNTMgNDUuMDA3MjEyNiwyMy41MTc2MDc0IDQ1LjExMDA0MTUsMjMuNDU5NjA0NyBDNDUuMjI3ODQ1NSwyMy40ODY2MDYgNDUuNDk0NDAyLDIzLjU4OTYxMDYgNDUuODkyNzM5MywyMy44NjQ2MjMxIEM0Ni45MjMwMjUyLDI0LjU3NzY1NTUgNDQuOTk3MzU4MywyMy4wNjYzNjY3IDQ2LjA2MDU4OTQsMjMuODUxNDAyMyBDNDcuMDM5OTU5OSwyNC41NzM0MzUyIDQ4LjA1MjI3NTcsMjUuMzE1NDY4OSA0OS4wODc1NTMzLDI2LjAzOTUwMTggQzQ5Ljk5NjA0MTgsMjYuNjc1NTMwNyA1MS40MDM2OTk5LDI3LjUxODU2OSA1My4xMjA4NDMsMjcuNTE4NTY5IEM1NC44NjE5NDYzLDI3LjUxODU2OSA1Ny4yMTQwMzMsMjYuNzI2NTMzIDU4LjUyOTg0MzksMjIuOTU5MzYxOCBDNTguOTQ0MTU0NiwyMS43NjgzMDc3IDU5LjMzNDUwNTEsMjAuNTcwMjUzMiA1OS43MjM4NTc0LDE5LjM3MDE5ODYgQzYwLjA4NzI1MjgsMTguMjQyMTQ3NCA2MC4yNTMzMDQyLDE3LjI2NDU3NTYgNjAuNjQxNjU4MSwxNi4xNDU1MjQ3IEM2MC44NTQzMDQzLDE1LjU0MjQ5NzMgNjEuMDM3MDAwMywxNS4yNjA0ODQ1IDYxLjEyMzg1NTgsMTUuMTQ5NDc5NSBDNjEuMjkzNTczNSwxNS4xNDk0Nzk1IDYxLjU5NTA3MTksMTUuMTcxNDgwNSA2Mi4xMDcyMTk4LDE1LjMyNDQ4NzQgWiIgaWQ9ImVuZ2luZSIgZmlsbD0iI2ZmNzcwMCI+PC9wYXRoPgogIDwvZz4KPC9zdmc+Cg=='

};

export default config;
