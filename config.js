var config = {
  undoLevels: 20,
  halosEnabled: true,
  altClickDefinesThat: true,
  verboseLogging: true,
  maxStatusMessages: 5,
  repeatClickInterval: 250, // max time between clicks for double-, triple-click
  text: {
    cursorBlinkPeriod: .5,
    useSoftTabs: true,
    tabWidth: 2,
    markStackSize: 16,
    undoLevels: 50,
    clipboardBufferLength: 15,
    defaultKeyBindings: [
      {keys: {mac: 'Meta-C', win: 'Ctrl-C'}, command: {command: "clipboard copy", passEvent: true}},
      {keys: "Ctrl-W",                       command: {command: "manual clipboard copy", args: {"delete": true}}},
      {keys: "Alt-W",                        command: "manual clipboard copy"},
      {keys: "Ctrl-Y",                       command: "manual clipboard paste"},
      {keys: "Alt-Y",                        command: {command: "manual clipboard paste", args: {killRingCycleBack: true}}},
      {keys: {mac: 'Meta-X', win: 'Ctrl-X'}, command: {command: "clipboard cut", passEvent: true}},
      {keys: {mac: 'Meta-V', win: 'Ctrl-V'}, command: {command: "clipboard paste", passEvent: true}},

      {keys: {mac: 'Meta-Z', win: 'Ctrl-Z'}, command: "text undo"},
      {keys: {mac: 'Meta-Shift-Z'},          command: "text redo"},

      {keys: {mac: 'Meta-A', win: 'Ctrl-A'}, command: "select all"},
      {keys: {mac: 'Meta-D', win: 'Ctrl-D'}, command: "doit"},
      {keys: {mac: 'Meta-P', win: 'Ctrl-P'}, command: "printit"},
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

      {keys: 'Alt-Right|Alt-F',              command: "goto word right"},
      {keys: 'Alt-Left|Alt-B',               command: "goto word left"},
      {keys: 'Alt-Shift-Right|Alt-Shift-F',  command: {command: "goto word right", args: {select: true}}},
      {keys: 'Alt-Shift-Left|Alt-Shift-B',   command: {command: "goto word left", args: {select: true}}},
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
      {keys: {win: "Ctrl-Shift-D", mac: "Meta-Shift-D"},     command: "duplicate line or selection"},
      {keys: {win: "Ctrl-Backspace", mac: "Meta-Backspace"}, command: "delete left until beginning of line"},
      {keys: "Ctrl-K",                                       command: "delete emtpy line or until end of line"},

      {keys: {win: "Ctrl-Alt-Up|Ctrl-Alt-P", mac: "Ctrl-Meta-Up|Ctrl-Meta-P"}, command: "move lines up"},
      {keys: {win: "Ctrl-Alt-Down|Ctrl-Alt-N", mac: "Ctrl-Meta-Down|Ctrl-Meta-N"}, command: "move lines down"},

      {keys: {win: "PageDown", mac: "PageDown|Ctrl-V"},      command: "goto page down"},
      {keys: {win: "PageUp", mac: "PageUp|Alt-V"},           command: "goto page up"},
      {keys: {win: "Shift-PageDown", mac: "Shift-PageDown"}, command: "goto page down and select"},
      {keys: {win: "Shift-PageUp", mac: "Shift-PageUp"},     command: "goto page up and select"},

      {keys: "Ctrl-Up", command: "goto paragraph above"},
      {keys: "Ctrl-Down", command: "goto paragraph below"},

      {keys: {win: "Shift-PageUp", mac: "Shift-PageUp"},     command: "goto page up and select"},

      {keys: {win: "Ctrl-Shift-Home", mac: "Meta-Shift-Up"},           command: {command: "goto start", args: {select: true}}},
      {keys: {win: "Ctrl-Shift-End", mac: "Meta-Shift-Down"},          command: {command: "goto end", args: {select: true}}},
      {keys: {win: "Ctrl-Home", mac: "Meta-Up|Meta-Home|Alt-Shift-,"}, command: "goto start"},
      {keys: {win: "Ctrl-End", mac: "Meta-Down|Meta-End|Alt-Shift-."}, command: "goto end"},

      {keys: "Ctrl-L",                                           command: "realign top-bottom-center"},
      {keys: {win: "Ctrl-Shift-L", mac: "Ctrl-Shift-L|Alt-G G"}, command: "goto line"},

      {keys: 'Enter', command: {command: "insertstring", args: {string: "\n", undoGroup: true}}}, // FIXME windowss
      {keys: 'Space', command: {command: "insertstring", args: {string: " ", undoGroup: true}}},
      {keys: 'Tab',   command: {command: "insertstring", args: {string: "\t", undoGroup: true}}},

      {keys: {win: 'Ctrl-]', mac: 'Meta-]'}, command: "indent"},
      {keys: {win: 'Ctrl-[', mac: 'Meta-['}, command: "outdent"},

      {keys: {win: 'Ctrl-Enter', mac: 'Meta-Enter'}, command: {command: "insert line", args: {where: "below"}}},
      {keys: 'Shift-Enter',                          command: {command: "insert line", args: {where: "above"}}},
      {keys: 'Ctrl-O',                               command: "split line"},

      {keys: {mac: 'Ctrl-X Ctrl-T'}, command: "transpose chars"},

      {keys: "Ctrl-Space", command: "toggle active mark"},

      
      {keys: {win: 'Ctrl-=', mac: 'Meta-='}, command: "increase font size"},
      {keys: {win: 'Ctrl--', mac: 'Meta--'}, command: "decrease font size"},

      {keys: "Esc|Ctrl-G", command: "cancel input"}
    ]
  }
}

export default config;
