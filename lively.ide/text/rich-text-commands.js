/* global localStorage,System */

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

export var commands = [

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
      const fontNames = [
        'serif',
        'sans-serif',
        'monospace'
      ];
      const lsKey = 'lively.morpic/text-change-font-additional-fonts';
      let additional = localStorage[lsKey];
      if (additional) {
        additional = JSON.parse(additional);
        fontNames.push(...additional);
      }
      if (!fontNames.map(ea => ea.toLowerCase()).includes(morph.fontFamily.toLowerCase())) {
        fontNames.push(morph.fontFamily);
        additional = [...(additional || []), morph.fontFamily];
        localStorage[lsKey] = JSON.stringify(additional);
      }

      const { selections: [choice] } = await $world.editListPrompt('choose font', fontNames, {
        requester: morph,
        preselect: fontNames.indexOf(morph.fontFamily),
        historyId: 'lively.morpic/text-change-font-hist'
      });

      if (choice) {
        morph.fontFamily = choice;
      }

      return true;
    }
  },

  {
    name: 'set link of selection',
    scrollCursorIntoView: false,
    exec: async function (morph, args = {}) {
      let link;
      if (!args.hasOwnProperty('link')) {
        var sel = morph.selection;
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
