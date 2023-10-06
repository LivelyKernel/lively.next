/* global */
import { Icons } from 'lively.morphic/text/icons.js';
import { Icon } from 'lively.morphic';
import { obj } from 'lively.lang';
import { connect } from 'lively.bindings';
import { pt } from 'lively.graphics';
import { availableFonts } from 'lively.morphic/rendering/fonts';
/* global localStorage */

function changeAttributeInSelectionOrMorph (target, name, valueOrFn) {
  const sel = target.selection;
  target.keepPosAtSameScrollOffsetWhile(() => {
    if (sel.isEmpty()) {
      target[name] = typeof valueOrFn === 'function'
        ? valueOrFn(target[name])
        : valueOrFn;
    } else {
      if (!target.undoManager) return;
      target.undoManager.group();
      target.changeStyleProperty(name,
        oldVal => typeof valueOrFn === 'function'
          ? valueOrFn(oldVal)
          : valueOrFn);
      target.undoManager.group();
    }
  });
}

export const editingCommand = {
  name: 'temporary edit text',
  exec: (textMorph, evt) => {
    const t = textMorph;

    // this makes sense even if target is not readonly
    // in the case we are in halo mode, this allows for editing which would be otherwise blocked by the halo
    t.prevReadOnly = t.readOnly;
    t.prevReactsToPointer = t.reactsToPointer;
    t.tmpEdit = true;
    t.reactsToPointer = true;
    t.readOnly = false;
    t.focus();
    setTimeout(() => {
      // ensure that the document is rendered and text layout measured
      t.cursorPosition = t.textPositionFromPoint(evt ? evt.positionIn(t) : pt(0, 0));
    });

    connect($world, 'onMouseDown', t, 'cancelTemporaryEdit');
    // switch to hand mode to stop halo from eating clicks for editing
    const topBar = $world.get('lively top bar') || $world.withAllSubmorphsSelect(m => m.isTopBar)?.[0];
    topBar.setEditMode('Hand', true, true);
    t.editorPlugin.showIconButton(true);
    $world.halos().forEach(h => {
      if (h.target === textMorph) h.remove();
    });
  }
};

export const interactiveCommands = [
  {
    name: 'clean up rich-text UI',
    exec: (textMorph, immediate) => {
      textMorph.editorPlugin.removeFormattingPopUp(immediate);
      textMorph.editorPlugin.removeIconButton();
    }
  },

  {
    name: 'close formatting popup',
    exec: (textMorph) => textMorph.editorPlugin.removeFormattingPopUp()
  },

  {
    name: 'show formatting popup',
    exec: (textMorph) => textMorph.editorPlugin.showFormattingPopUp()
  },

  {
    name: 'add icon at cursor position',
    exec: async function (morph) {
      morph.keepTmpEditMode = true;

      const res = await $world.filterableListPrompt('Select Icon', Object.keys(Icons).map(iconName => {
        return { isListItem: true, label: [...Icon.textAttribute(iconName, { paddingRight: '10px' }), iconName, {}], value: iconName };
      }));
      const [iconName] = res.selected;

      let previousAttributes = { ...morph.textAttributeAt(morph.cursorPosition) };
      if (iconName) {
        morph.withMetaDo({ reconcileChanges: true }, () => {
          morph.insertText(Icon.textAttribute(iconName));
          morph.insertText([' ', previousAttributes], morph.cursorPosition, false);
        });
      }
      morph.focus();
      morph.keepTmpEditMode = false;
    }
  },

  {
    name: 'increase font size',
    scrollCursorIntoView: false,
    exec: function (morph) {
      const defaultFontSize = morph.fontSize;
      changeAttributeInSelectionOrMorph(morph, 'fontSize', oldSize => {
        oldSize = oldSize || defaultFontSize;
        return oldSize + (oldSize >= 18 ? 2 : 1);
      });
      return true;
    }
  },

  {
    name: 'decrease font size',
    scrollCursorIntoView: false,
    exec: function (morph) {
      // morph.keepPosAtSameScrollOffsetWhile(() => morph.fontSize--);

      const defaultFontSize = morph.fontSize;
      changeAttributeInSelectionOrMorph(morph, 'fontSize', oldSize => {
        oldSize = oldSize || defaultFontSize;
        return oldSize - (oldSize <= 18 ? 1 : 2);
      });

      return true;
    }
  },

  {
    name: 'change font',
    scrollCursorIntoView: false,
    exec: async function (morph) {
      const fonts = availableFonts().map(font => font.name);

      const res = await $world.listPrompt('choose font', fonts, {
        requester: morph,
        preselect: fonts.indexOf(morph.fontFamily),
        historyId: 'lively.morpic/text-change-font-hist'
      });

      if (res.status !== 'accepted') return false;
      
      morph.fontFamily = res.selected[0];
      return true;
    }
  },

  {
    name: 'set link of selection',
    scrollCursorIntoView: false,
    exec: async function (morph, args = {}) {
      let link;
      if (!args.hasOwnProperty('link')) {
        const sel = morph.selection;
        const { link: oldLink } = morph.getStyleInRange(sel);
        link = await morph.world().prompt('Set link', {
          input: oldLink || 'https://',
          historyId: 'lively.morphic-rich-text-link-hist'
        });
        if (!link) return;
      }
      morph.undoManager.group();
      morph.setStyleInRange({ link: link || undefined }, sel);
      morph.undoManager.group();
    }
  },

  {
    name: 'set doit of selection',
    scrollCursorIntoView: false,
    exec: async function (morph, args = {}) {
      const sel = morph.selection;
      const { doit: oldDoit } = morph.getStyleInRange(sel);
      const newDoitCode = await morph.world().editPrompt(
        'Enter doit code (runs on clicking the text)', {
          requester: morph,
          input: oldDoit ? oldDoit.code : '// empty doit',
          historyId: 'lively.morphic-rich-text-doit-hist',
          mode: 'js',
          evalEnvironment: morph.evalEnvForDoit(oldDoit || {})
        });

      morph.undoManager.group();
      if (!newDoitCode) {
        morph.removeTextAttribute({
          doit: null,
          nativeCursor: '',
          textDecoration: ''
        }, sel);
      } else {
        morph.addTextAttribute({
          doit: { code: newDoitCode },
          nativeCursor: 'pointer',
          textDecoration: 'underline'
        }, sel);
      }
      morph.undoManager.group();
    }
  },

  {
    name: 'reset text style',
    scrollCursorIntoView: false,
    exec: function (morph, args = {}) {
      morph.undoManager.group();
      const range = !args.onlySelection && morph.selection.isEmpty()
        ? morph.documentRange
        : morph.selection.range;
      morph.setStyleInRange(null, range);
      morph.undoManager.group();
      return true;
    }
  }
];
