import { once } from 'lively.bindings';

// helper
function pToI (ed, pos) { return ed.positionToIndex(pos); }
function iToP (ed, pos) { return ed.indexToPosition(pos); }

function execCodeNavigator (sel) {
  return function (ed, args, count) {
    const nav = ed.pluginInvokeFirst('getNavigator');
    if (!nav) return true;
    ed.saveMark();
    var count = (count || 1);
    for (let i = 0; i < count; i++) { nav[sel](ed, args); }
    return true;
  };
}

export var commands = [

  {
    name: 'forwardSexp',
    bindKey: 'Ctrl-Alt-f|Ctrl-Alt-Right',
    exec: execCodeNavigator('forwardSexp'),
    multiSelectAction: 'forEach',
    readOnly: true
  },

  {
    name: 'backwardSexp',
    bindKey: 'Ctrl-Alt-b|Ctrl-Alt-Left',
    exec: execCodeNavigator('backwardSexp'),
    multiSelectAction: 'forEach',
    readOnly: true
  },

  {
    name: 'backwardUpSexp',
    bindKey: 'Ctrl-Alt-u|Ctrl-Alt-Up',
    exec: execCodeNavigator('backwardUpSexp'),
    multiSelectAction: 'forEach',
    readOnly: true
  },

  {
    name: 'forwardDownSexp',
    bindKey: 'Ctrl-Alt-d|Ctrl-Alt-Down',
    exec: execCodeNavigator('forwardDownSexp'),
    multiSelectAction: 'forEach',
    readOnly: true
  },

  {
    name: 'markDefun',
    bindKey: 'Ctrl-Alt-h',
    exec: execCodeNavigator('markDefun'),
    multiSelectAction: 'forEach',
    readOnly: true
  },

  {
    name: 'expandRegion',
    bindKey: { win: 'Shift-Ctrl-E|Ctrl-Shift-Space', mac: 'Shift-Command-Space|Ctrl-Shift-Space' },
    exec: function (ed, args) {
      args = args || {};

      const expander = ed.pluginInvokeFirst('getNavigator');
      if (!expander) return true;

      // if we get start/end position indexes to expand to handed in then we do
      // that
      var newState;
      const start = args.start; const end = args.end;
      if (typeof start === 'number' && typeof end === 'number') {
        const state = ensureExpandState();
        newState = { range: [start, end], prev: ensureExpandState() };
      } else {
        // ... otherwise we leave it to the code navigator...
        const ast = expander.ensureAST(ed);
        if (!ast) return;

        var newState = expander.expandRegion(ed, ed.textString, ast, ensureExpandState());
      }

      if (newState && newState.range) {
        ed.selection = {
          start: iToP(ed, newState.range[0]),
          end: iToP(ed, newState.range[1])
        };
        ed.$expandRegionState = newState;
      }

      once(ed, 'selectionChange', () => ed.$expandRegionState = null, 'call');

      return true;
      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      function ensureExpandState () {
        const state = ed.$expandRegionState;
        const pos = pToI(ed, ed.cursorPosition);
        if (state &&
        // has cursor moved? invalidate expansion state
         (state.range[0] === pos || state.range[1] === pos)) { return state; }

        const range = ed.selection.range;
        return ed.$expandRegionState = {
          range: [pToI(ed, range.start), pToI(ed, range.end)]
        };
      }
    },
    multiSelectAction: 'forEach',
    readOnly: true
  },

  {
    name: 'contractRegion',
    bindKey: { win: 'Shift-Ctrl-S|Ctrl-Alt-Space', mac: 'Ctrl-Command-space|Ctrl-Alt-Space' },
    exec: function (ed) {
      if (ed.selection.isEmpty()) return true;
      const expander = ed.pluginInvokeFirst('getNavigator');
      if (!expander) return true;

      const ast = expander.ensureAST(ed);
      if (!ast) return true;

      const state = ed.$expandRegionState;
      if (!state) return true;

      const newState = expander.contractRegion(ed, ed.textString, ast, state);
      if (newState && newState.range) {
        ed.selection = {
          start: iToP(ed, newState.range[0]),
          end: iToP(ed, newState.range[1])
        };
        ed.$expandRegionState = newState;
      }

      once(ed, 'selectionChange', () => ed.$expandRegionState = null, 'call');
      return true;
    },
    multiSelectAction: 'forEach',
    readOnly: true
  }

];
