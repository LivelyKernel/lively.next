var config = {
  undoLevels: 20,
  halosEnabled: true,
  altClickDefinesThat: true,
  verboseLogging: true,
  maxStatusMessages: 5,
  repeatClickInterval: 250, // max time between clicks for double-, triple-click
  showTooltipsAfter: 2,

  globalKeyBindings: [

    {keys: {mac: 'Meta-Z', win: 'Ctrl-Z'},             command: "undo"},
    {keys: {mac: 'Meta-Shift-Z', win: 'Ctrl-Shift-Z'}, command: "redo"},
    {keys: "Alt-X", command: "run command"},

    {keys: "Meta-H", command: "show halo for focused morph"},
    {keys: "Alt-M", command: "select morph"},
    {keys: "Escape", command: "escape"},
    {keys: {win: "Ctrl-Escape", mac: "Meta-Escape"}, command: "close active window"},
    {keys: "Alt-Shift-C", command: "toggle minimize active window"},

    {keys: {win: "Ctrl-K", mac: "Meta-K"}, command: {command: "open workspace", onlyWhenFocused: false}},
    {keys: {win: "Ctrl-B", mac: "Meta-B"}, command: {command: "open browser", onlyWhenFocused: false}},
    {keys: "Alt-T", command: {command: "choose and browse module", onlyWhenFocused: false}},
    {keys: "Alt-Shift-T", command: {command: "choose and browse package resources", onlyWhenFocused: false}},
    {keys: {win: "Ctrl-Shift-F", mac: "Meta-Shift-F"}, command: {command: "open code search", onlyWhenFocused: false}},

    {keys: "Left",       command: {command: "move or resize halo target", args: {what: "move", direction: "left",  offset: 1}}},
    {keys: "Right",      command: {command: "move or resize halo target", args: {what: "move", direction: "right", offset: 1}}},
    {keys: "Up",         command: {command: "move or resize halo target", args: {what: "move", direction: "up",    offset: 1}}},
    {keys: "Down",       command: {command: "move or resize halo target", args: {what: "move", direction: "down",  offset: 1}}},
    {keys: "Meta-Left",  command: {command: "move or resize halo target", args: {what: "move", direction: "left",  offset: 10}}},
    {keys: "Meta-Right", command: {command: "move or resize halo target", args: {what: "move", direction: "right", offset: 10}}},
    {keys: "Meta-Up",    command: {command: "move or resize halo target", args: {what: "move", direction: "up",    offset: 10}}},
    {keys: "Meta-Down",  command: {command: "move or resize halo target", args: {what: "move", direction: "down",  offset: 10}}},
    {keys: "Alt-Left",   command: {command: "move or resize halo target", args: {what: "move", direction: "left",  offset: 100}}},
    {keys: "Alt-Right",  command: {command: "move or resize halo target", args: {what: "move", direction: "right", offset: 100}}},
    {keys: "Alt-Up",     command: {command: "move or resize halo target", args: {what: "move", direction: "up",    offset: 100}}},
    {keys: "Alt-Down",   command: {command: "move or resize halo target", args: {what: "move", direction: "down",  offset: 100}}},

    {keys: "Shift-Left",       command: {command: "move or resize halo target", args: {what: "resize", direction: "left",  offset: 1}}},
    {keys: "Shift-Right",      command: {command: "move or resize halo target", args: {what: "resize", direction: "right", offset: 1}}},
    {keys: "Shift-Up",         command: {command: "move or resize halo target", args: {what: "resize", direction: "up",    offset: 1}}},
    {keys: "Shift-Down",       command: {command: "move or resize halo target", args: {what: "resize", direction: "down",  offset: 1}}},
    {keys: "Meta-Shift-Left",  command: {command: "move or resize halo target", args: {what: "resize", direction: "left",  offset: 10}}},
    {keys: "Meta-Shift-Right", command: {command: "move or resize halo target", args: {what: "resize", direction: "right", offset: 10}}},
    {keys: "Meta-Shift-Up",    command: {command: "move or resize halo target", args: {what: "resize", direction: "up",    offset: 10}}},
    {keys: "Meta-Shift-Down",  command: {command: "move or resize halo target", args: {what: "resize", direction: "down",  offset: 10}}},
    {keys: "Alt-Shift-Left",   command: {command: "move or resize halo target", args: {what: "resize", direction: "left",  offset: 100}}},
    {keys: "Alt-Shift-Right",  command: {command: "move or resize halo target", args: {what: "resize", direction: "right", offset: 100}}},
    {keys: "Alt-Shift-Up",     command: {command: "move or resize halo target", args: {what: "resize", direction: "up",    offset: 100}}},
    {keys: "Alt-Shift-Down",   command: {command: "move or resize halo target", args: {what: "resize", direction: "down",  offset: 100}}},

    {keys: {win: "Ctrl-1", mac: "Meta-1"}, command: "window switcher"},

    {keys: "Meta-Shift-L R E S 1", command: {command: "resize active window", args: {how: "col1"}}},
    {keys: "Meta-Shift-L R E S 2", command: {command: "resize active window", args: {how: "col2"}}},
    {keys: "Meta-Shift-L R E S 3", command: {command: "resize active window", args: {how: "col3"}}},
    {keys: "Meta-Shift-L R E S 4", command: {command: "resize active window", args: {how: "col4"}}},
    {keys: "Meta-Shift-L R E S 5", command: {command: "resize active window", args: {how: "col5"}}},
    {keys: "Meta-Shift-L R E S C", command: {command: "resize active window", args: {how: "center"}}},
    {keys: "Meta-Shift-L R E S L", command: {command: "resize active window", args: {how: "left"}}},
    {keys: "Meta-Shift-L R E S R", command: {command: "resize active window", args: {how: "right"}}},
    {keys: "Meta-Shift-L R E S F", command: {command: "resize active window", args: {how: "full"}}},
    {keys: "Meta-Shift-L R E S T", command: {command: "resize active window", args: {how: "top"}}},
    {keys: "Meta-Shift-L R E S H T", command: {command: "resize active window", args: {how: "halftop"}}},
    {keys: "Meta-Shift-L R E S B", command: {command: "resize active window", args: {how: "bottom"}}},
    {keys: "Meta-Shift-L R E S H B", command: {command: "resize active window", args: {how: "halfbottom"}}},
    {keys: "Meta-Shift-L R E S Escape", command: {command: "resize active window", args: {how: "reset"}}},
  ],

  text: {
    cursorBlinkPeriod: .5,
    useSoftTabs: true,
    tabWidth: 2,
    markStackSize: 16,
    undoLevels: 50,
    clipboardBufferLength: 15,
    useMultiSelect: true,
    undoGroupDelay: 600/*ms, idle time after typing that groups the previous ungrouped edits into one*/,

    defaultKeyBindings: [
      {keys: {mac: 'Meta-C', win: 'Ctrl-C'}, command: {command: "clipboard copy", passEvent: true}},
      {keys: "Ctrl-W",                       command: {command: "manual clipboard copy", args: {"delete": true}}},
      {keys: "Alt-W",                        command: "manual clipboard copy"},
      {keys: "Ctrl-Y",                       command: "manual clipboard paste"},
      {keys: "Alt-Y",                        command: {command: "manual clipboard paste", args: {killRingCycleBack: true}}},
      {keys: {mac: 'Meta-X', win: 'Ctrl-X'}, command: {command: "clipboard cut", passEvent: true}},
      {keys: {mac: 'Meta-V', win: 'Ctrl-V'}, command: {command: "clipboard paste", passEvent: true}},

      {keys: {mac: 'Meta-Z', win: 'Ctrl-Z'},             command: "text undo"},
      {keys: {mac: 'Meta-Shift-Z', win: 'Ctrl-Shift-Z'}, command: "text redo"},

      {keys: {mac: 'Meta-A|Ctrl-X H', win: 'Ctrl-A|Ctrl-X H'}, command: "select all"},
      {keys: {mac: 'Meta-D', win:  'Ctrl-D'}, command: "doit"},
      {keys: {mac: "Meta-Shift-L X B"},      command: "eval all"},
      {keys: {mac: 'Meta-P', win: 'Ctrl-P'}, command: "printit"},
      {keys: {mac: 'Meta-I', win: 'Ctrl-I'}, command: "inspectit"},
      {keys: {mac: 'Meta-S', win: 'Ctrl-S'}, command: "saveit"},

      {keys: 'Backspace',                           command: "delete backwards"},
      {keys: {win: 'Delete', mac: 'Delete|Ctrl-D'}, command: "delete"},

      {keys: {win: 'Left', mac: 'Left|Ctrl-B'},   command: "go left"},
      {keys: {win: 'Right', mac: 'Right|Ctrl-F'}, command: "go right"},
      {keys: {win: 'Up', mac: 'Up|Ctrl-P'},       command: "go up"},
      {keys: {win: 'Down', mac: 'Down|Ctrl-N'},   command: "go down"},

      {keys: 'Shift-Left',  command: "select left"},
      {keys: 'Shift-Right', command: "select right"},
      {keys: 'Shift-Up',    command: "select up"},
      {keys: 'Shift-Down',  command: "select down"},

      {keys: {win: 'Ctrl-Right', mac: 'Alt-Right|Alt-F'}, command: "goto word right"},
      {keys: {win: 'Ctrl-Left', mac: 'Alt-Left|Alt-B'}, command: "goto word left"},
      {keys: {win: 'Ctrl-Shift-Right', mac: 'Alt-Shift-Right|Alt-Shift-F'}, command: {command: "goto word right", args: {select: true}}},
      {keys: {win: 'Ctrl-Shift-Left', mac: 'Alt-Shift-Left|Alt-Shift-B'}, command: {command: "goto word left", args: {select: true}}},
      {keys: 'Alt-Backspace',                command: "delete word left"},
      {keys: 'Alt-D',                        command: "delete word right"},
      {keys: 'Alt-Ctrl-K',                   command: "delete word right"/*actualle delete sexp!*/},
      {keys: 'Alt-Shift-2',                  command: "select word right"},

      {keys: "Ctrl-X Ctrl-X",                                     command: "reverse selection"},
      {keys: {win: "Ctrl-Shift-L", mac: 'Meta-L'},                command: "select line"},
      {keys: {win: "Shift-Home", mac: "Shift-Home|Ctrl-Shift-A"}, command: {command: "goto line start", args: {select: true}}},
      {keys: {win: "Home", mac: "Home|Ctrl-A"},                   command: {command: "goto line start", args: {select: false}}},
      {keys: {win: "Shift-End", mac: "Shift-End|Ctrl-Shift-E"},   command: {command: "goto line end", args: {select: true}}},
      {keys: {win: "End", mac: "End|Ctrl-E"},                     command: {command: "goto line end", args: {select: false}}},

      {keys: "Ctrl-C J",                                     command: {command: "join line", args: {withLine: "before"}}},
      {keys: "Ctrl-C Shift-J",                               command: {command: "join line", args: {withLine: "after"}}},
      {keys: {win: "Ctrl-Shift-D", mac: "Meta-Shift-D|Ctrl-C P"},     command: "duplicate line or selection"},
      {keys: {win: "Ctrl-Backspace", mac: "Meta-Backspace"}, command: "delete left until beginning of line"},
      {keys: "Ctrl-K",                                       command: "delete emtpy line or until end of line"},

      {keys: {win: "Ctrl-Alt-Up|Ctrl-Alt-P", mac: "Ctrl-Meta-Up|Ctrl-Meta-P"}, command: "move lines up"},
      {keys: {win: "Ctrl-Alt-Down|Ctrl-Alt-N", mac: "Ctrl-Meta-Down|Ctrl-Meta-N"}, command: "move lines down"},

      {keys: {win: "PageDown", mac: "PageDown|Ctrl-V"},      command: "goto page down"},
      {keys: {win: "PageUp", mac: "PageUp|Alt-V"},           command: "goto page up"},
      {keys: {win: "Shift-PageDown", mac: "Shift-PageDown"}, command: "goto page down and select"},
      {keys: {win: "Shift-PageUp", mac: "Shift-PageUp"},     command: "goto page up and select"},
      {keys: 'Alt-Ctrl-,'/*Alt-Ctrl-<*/,                     command: 'move cursor to screen top in 1/3 steps'},
      {keys: 'Alt-Ctrl-.'/*Alt-Ctrl-<*/,                     command: 'move cursor to screen bottom in 1/3 steps'},

      {keys: {win: "Alt-Left", mac: "Meta-Left"},               command: "goto matching left"},
      {keys: {win: "Alt-Shift-Left", mac: "Meta-Shift-Left"},   command: {command: "goto matching left", args: {select: true}}},
      {keys: {win: "Alt-Right", mac: "Meta-Right"},             command: "goto matching right"},
      {keys: {win: "Alt-Shift-Right", mac: "Meta-Shift-Right"}, command: {command: "goto matching right", args: {select: true}}},

      // FIXME this is actually fwd/bwd sexp
      {keys: "Alt-Ctrl-B", command: "goto matching left"},
      {keys: "Alt-Ctrl-F", command: "goto matching right"},

      {keys: "Ctrl-Up", command: "goto paragraph above"},
      {keys: "Ctrl-Down", command: "goto paragraph below"},


      {keys: {win: "Ctrl-Shift-Home", mac: "Meta-Shift-Up"},           command: {command: "goto start", args: {select: true}}},
      {keys: {win: "Ctrl-Shift-End", mac: "Meta-Shift-Down"},          command: {command: "goto end", args: {select: true}}},
      {keys: {win: "Ctrl-Home", mac: "Meta-Up|Meta-Home|Alt-Shift-,"}, command: "goto start"},
      {keys: {win: "Ctrl-End", mac: "Meta-Down|Meta-End|Alt-Shift-."}, command: "goto end"},

      {keys: "Ctrl-L",                                           command: "realign top-bottom-center"},
      {keys: {win: "Ctrl-Shift-L", mac: "Ctrl-Shift-L|Alt-G G"}, command: "goto line"},

      {keys: 'Enter', command: "newline"},
      {keys: 'Space', command: {command: "insertstring", args: {string: " ", undoGroup: true}}},
      {keys: 'Tab',   command: {command: "insertstring", args: {string: "\t", undoGroup: true}}},

      {keys: {win: 'Ctrl-]', mac: 'Meta-]'}, command: "indent"},
      {keys: {win: 'Ctrl-[', mac: 'Meta-['}, command: "outdent"},

      {keys: {win: 'Ctrl-Enter', mac: 'Meta-Enter'}, command: {command: "insert line", args: {where: "below"}}},
      {keys: 'Shift-Enter',                          command: {command: "insert line", args: {where: "above"}}},
      {keys: 'Ctrl-O',                               command: "split line"},

      {keys: {mac: 'Ctrl-X Ctrl-T'}, command: "transpose chars"},
      {keys: {mac: 'Ctrl-C Ctrl-U'}, command: "uppercase"},
      {keys: {mac: 'Ctrl-C Ctrl-L'}, command: "lowercase"},
      {keys: {mac: 'Meta-Shift-L W t'}, command: "remove trailing whitespace"},

      {keys: "Ctrl-Space", command: "toggle active mark"},


      {keys: {win: 'Ctrl-=', mac: 'Meta-='}, command: "increase font size"},
      {keys: {win: 'Ctrl--', mac: 'Meta--'}, command: "decrease font size"},

      {keys: "Esc|Ctrl-G", command: "cancel input"},

      {keys: {win: "Ctrl-/", mac: "Meta-/"}, command: "toggle comment"},
      {keys: {win: "Alt-Ctrl-/", mac: "Alt-Meta-/|Alt-Meta-÷"/*FIXME*/}, command: "toggle block comment"},
      {keys: "Meta-Shift-L /  D", command: "comment box"},

      {keys: {windows: "Ctrl-.", mac: "Meta-."}, command: '[IyGotoChar] activate'},
      {keys: {windows: "Ctrl-,", mac: "Meta-,"}, command: {command: '[IyGotoChar] activate', args: {backwards: true}}},

      {keys: "Alt-Shift-Space|Alt-Space|Meta-Shift-P", command: "text completion"},

      {keys: "Alt-Q", command: "fit text to column"},

      {keys: {win: "Ctrl-F|Ctrl-G|Ctrl-S|F3", mac: "Meta-F|Meta-G|Ctrl-S"}, command: "search in text"},
      {keys: {win: "Ctrl-Shift-F|Ctrl-Shift-G|Ctrl-R", mac: "Meta-Shift-F|Meta-Shift-G|Ctrl-R"}, command: {command: "search in text", args: {backwards: true}}},


      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // multi select bindings
      {keys: "Ctrl-Shift-/|Ctrl-C Ctrl-Shift-,", command: "[multi select] all like this"},
      {keys: "Alt-Ctrl-P",                       command: "[multi select] add cursor above"},
      {keys: "Alt-Ctrl-N",                       command: "[multi select] add cursor below"},
      {keys: "Ctrl-Shift-,",                     command: "[multi select] more like this backward"},
      {keys: "Ctrl-Shift-.",                     command: "[multi select] more like this forward"},
      {keys: {mac: "Meta-Shift-,"},              command: "[multi select] goto previous focused cursor"},
      {keys: {mac: "Meta-Shift-."},              command: "[multi select] goto next focused cursor"},
      {keys: "Ctrl-Shift-;",                     command: "[multi select] remove focused cursor"},
      {keys: "Alt-Ctrl-A",                       command: "[multi select] align cursors"},
      {keys: "Ctrl-X R",                         command: "[multi select] create rectangular selection"},

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      // ide related
      {keys: "Ctrl-C E", command: "[javascript] list errors and warnings"},
    ]

  },

  codeEditor: {
    defaultStyle: {
      theme: "github",
      mode: "plain",
      fontFamily: "Hack, Monaco, monospace",
      fontSize: 12
    }
  }
}

// $$world.withAllSubmorphsDo(ea =>delete ea._cachedKeyhandlers);

export default config;
