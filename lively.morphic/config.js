/* global System */
import { Rectangle, Color } from 'lively.graphics';
import bowser from 'bowser';

const isMac = !!bowser.mac;

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
    authServerURL: 'https://auth.lively-next.org',
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
      ]
    },

    modes: {
      aliases: {
        text: 'text',
        sh: 'shell',
        markdown: 'md',
        javascript: 'js',
        htmlmixed: 'html',
        haskell: 'hs',
        python: 'py'
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
    { keys: { win: 'Ctrl-P', mac: 'Meta-P' }, command: { command: 'open PartsBin', onlyWhenFocused: true } },
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
    { keys: { mac: 'Meta-Shift-L R E S 4', win: 'Ctrl-Shift-L R E S 4' }, command: { command: 'resize active window', args: { how: 'col4' } } },
    { keys: { mac: 'Meta-Shift-L R E S 5', win: 'Ctrl-Shift-L R E S 5' }, command: { command: 'resize active window', args: { how: 'col5' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-1', win: 'Ctrl-Shift-L R E S Alt-1' }, command: { command: 'resize active window', args: { how: 'quadrant1' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-2', win: 'Ctrl-Shift-L R E S Alt-2' }, command: { command: 'resize active window', args: { how: 'quadrant2' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-3', win: 'Ctrl-Shift-L R E S Alt-3' }, command: { command: 'resize active window', args: { how: 'quadrant3' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-4', win: 'Ctrl-Shift-L R E S Alt-4' }, command: { command: 'resize active window', args: { how: 'quadrant4' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-5', win: 'Ctrl-Shift-L R E S Alt-5' }, command: { command: 'resize active window', args: { how: 'quadrant5' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-6', win: 'Ctrl-Shift-L R E S Alt-6' }, command: { command: 'resize active window', args: { how: 'quadrant6' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-7', win: 'Ctrl-Shift-L R E S Alt-7' }, command: { command: 'resize active window', args: { how: 'quadrant7' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-8', win: 'Ctrl-Shift-L R E S Alt-8' }, command: { command: 'resize active window', args: { how: 'quadrant8' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-9', win: 'Ctrl-Shift-L R E S Alt-9' }, command: { command: 'resize active window', args: { how: 'quadrant9' } } },
    { keys: { mac: 'Meta-Shift-L R E S Alt-0', win: 'Ctrl-Shift-L R E S Alt-0' }, command: { command: 'resize active window', args: { how: 'quadrant0' } } },
    { keys: { mac: 'Meta-Shift-L R E S C', win: 'Ctrl-Shift-L R E S C' }, command: { command: 'resize active window', args: { how: 'center' } } },
    { keys: { mac: 'Meta-Shift-L R E S L', win: 'Ctrl-Shift-L R E S L' }, command: { command: 'resize active window', args: { how: 'left' } } },
    { keys: { mac: 'Meta-Shift-L R E S R', win: 'Ctrl-Shift-L R E S R' }, command: { command: 'resize active window', args: { how: 'right' } } },
    { keys: { mac: 'Meta-Shift-L R E S F', win: 'Ctrl-Shift-L R E S F' }, command: { command: 'resize active window', args: { how: 'full' } } },
    { keys: { mac: 'Meta-Shift-L R E S T', win: 'Ctrl-Shift-L R E S T' }, command: { command: 'resize active window', args: { how: 'top' } } },
    { keys: { mac: 'Meta-Shift-L R E S H T', win: 'Ctrl-Shift-L R E S H T' }, command: { command: 'resize active window', args: { how: 'halftop' } } },
    { keys: { mac: 'Meta-Shift-L R E S B', win: 'Ctrl-Shift-L R E S B' }, command: { command: 'resize active window', args: { how: 'bottom' } } },
    { keys: { mac: 'Meta-Shift-L R E S H B', win: 'Ctrl-Shift-L R E S H B' }, command: { command: 'resize active window', args: { how: 'halfbottom' } } },
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

      { keys: 'Backspace', command: 'delete backwards' },
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
    server: System.get('@system-env').browser ? `${document.location.origin}/eval` : null
  },

  css: {
    ibmPlex: '/lively.morphic/assets/ibm-plex/css/ibm-plex.css',
    fontAwesome: '/lively.morphic/assets/fontawesome-free-5.12.1/css/all.css',
    inconsolata: '/lively.morphic/assets/inconsolata/inconsolata.css'
  }

};

export default config;
