/* global Map */
import { Color, Rectangle, pt } from 'lively.graphics';
import { morph, ShadowObject, StyleSheet } from 'lively.morphic';
import { connect } from 'lively.bindings';
import { arr, string } from 'lively.lang';
import { FilterableList } from 'lively.components/list.js';
import { Range } from 'lively.morphic/text/range.js';

export class Completer {
  compute () { return []; }
}

export class WordCompleter {
  compute (textMorph, prefix) {
    const words = [];
    const completions = [];
    const lines = textMorph.document.lineStrings;
    const { row, column } = textMorph.cursorPosition;
    const basePriority = 1000;

    for (var i = row - 1; i >= 0; i--) {
      for (var word of lines[i].split(/[^0-9a-z@_]+/i)) {
        if (!word || words.includes(word) || word === prefix) continue;
        words.push(word);
        completions.push({ priority: basePriority - (row - i), completion: word });
      }
    }

    for (var i = row + 1; i < lines.length; i++) {
      for (var word of lines[i].split(/[^0-9a-z_@]+/i)) {
        if (!word || words.includes(word) || word === prefix) continue;
        words.push(word);
        completions.push({ priority: basePriority - (i - row), completion: word });
      }
    }

    return completions;
  }
}

export var defaultCompleters = [
  new WordCompleter()
];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class CompletionController {
  constructor (textMorph, completers = []) {
    this.textMorph = textMorph;
    completers = textMorph.pluginCollect('getCompleters', completers);
    this.completers = completers;
  }

  async computeCompletions (prefix) {
    let completions = [];
    for (const c of this.completers) {
      try {
        completions = completions.concat(await c.compute(this.textMorph, prefix));
      } catch (e) {
        console.warn(`Error in completer ${c}: ${e.stack || e}`);
      }
    }

    // if multiple options with same completion exist, uniq by the highest priority
    // note: there is a lively.lang bug that breaks groupBy if key === constructor...!
    const groups = new Map();
    completions.forEach(ea => {
      let group = groups.get(ea.completion);
      if (!group) { group = []; groups.set(ea.completion, group); }
      group.push(ea);
    });

    const withHighestPriority = [];
    for (const val of groups.values()) { withHighestPriority.push(arr.last(arr.sortByKey(val, 'priority'))); }

    let maxCol = 0;
    const sorted = arr.sortByKey(withHighestPriority, 'priority').reverse();
    const highestPriority = (sorted.length && sorted[0].priority) || 0;
    const items = sorted.map(ea => {
      ea.highestPriority = highestPriority;
      const string = ea.completion.replace(/\n/g, '');
      const annotation = String((ea.info || '').replace(/\n/g, ''));
      maxCol = Math.max(maxCol, string.length + annotation.length);
      return { isListItem: true, string, annotation, value: ea };
    });
    return { items, maxCol };
  }

  async computeSortedCompletions (prefix, mustStartWithPrefix = false) {
    const parsedInput = { tokens: [prefix], lowercasedTokens: [prefix], input: prefix };
    const completions = await this.computeCompletions(prefix);
    const completionsFiltered = arr.sortBy(
      completions.items.filter(item => this.filterFunction(parsedInput, item, mustStartWithPrefix)),
      item => this.sortFunction(parsedInput, item));
    return completionsFiltered;
  }

  async _printCompletions (prefix) {
    // for debugging
    const table = (await this.computeSortedCompletions(prefix)).map(ea => {
      return {
        completion: ea.value.completion,
        priority: ea.value.priority,
        maxP: ea.value.highestPriority,
        sortVal: ea._cache[prefix].sortVal,
        lev: JSON.stringify(ea._cache[prefix].levenshtein)
      };
    });
    return string.printTable(lively.lang.grid.tableFromObjects(table));
  }

  prefix () {
    const m = this.textMorph;
    const sel = m.selection;
    const roughPrefix = sel.isEmpty() ? m.getLine(sel.lead.row).slice(0, sel.lead.column) : sel.text;
    return roughPrefix.match(/[a-z0-9@_]*$/i)[0];
  }

  filterFunction (parsedInput, item, mustStartWithPrefix = false) {
    if (!item._cache) item._cache = {};
    const { tokens, lowercasedTokens: lTokens, input } = parsedInput;
    const cache = item._cache[input] || (item._cache[input] = {});
    if (cache.hasOwnProperty('filtered')) return cache.filtered;

    const compl = item.value.completion.replace(/\([^\)]*\)$/, '');
    const lCompl = compl.toLowerCase();

    if (mustStartWithPrefix && tokens[0] && !compl.startsWith(tokens[0])) {
      return cache.filtered = false;
    }

    if (lTokens.every(token => lCompl.includes(token))) return true;
    // "fuzzy" match
    const levCache = cache.levenshtein || (cache.levenshtein = {});
    const filtered = mustStartWithPrefix || arr.sum(parsedInput.lowercasedTokens.map(token =>
      levCache[token] || (levCache[token] = string.levenshtein(lCompl, token)))) <= 3;
    return cache.filtered = filtered;
  }

  sortFunction (parsedInput, item) {
    // Preioritize those completions that are close to the input. We also
    // want to consider the static priority of the item itself but adjust it
    // across the priority of all items
    if (!item._cache) item._cache = {};
    var cache = item._cache[parsedInput.input] || (item._cache[parsedInput.input] = {});
    if (cache.hasOwnProperty('sortVal')) return cache.sortVal;

    var cache = item._cache[parsedInput.input] = {};
    var { highestPriority, completion, priority } = item.value;
    var completion = completion.replace(/\([^\)]*\)$/, '').toLowerCase();

    let boosted = 0;
    parsedInput.lowercasedTokens.forEach(t => {
      if (completion.startsWith(t)) boosted += 12;
      else if (t.length >= 3 && completion.includes(t)) boosted += 5;
    });

    const n = String(highestPriority).length - 2;
    const adjustedPriority = (priority || (boosted ? highestPriority : 0)) / 10 ** n;
    const base = -adjustedPriority - boosted;

    const levCache = cache.levenshtein || (cache.levenshtein = {});
    let lev = arr.sum(parsedInput.lowercasedTokens.map(token =>
      levCache[token] || (levCache[token] = string.levenshtein(completion, token))));
    if (boosted) lev /= 2;
    return cache.sortVal = lev + base;
  }

  positionForMenu () {
    const m = this.textMorph;
    const cursorBounds = m.charBoundsFromTextPosition(m.cursorPosition);
    const globalCursorBounds = m.getGlobalTransform().transformRectToRect(cursorBounds);
    return globalCursorBounds.topLeft()
      .addXY(-m.scroll.x, -m.scroll.y)
      .addPt(pt(m.borderWidth + 4, m.borderWidth + 4));
  }

  async completionListSpec () {
    const m = this.textMorph;
    const { fontSize, fontFamily, fontColor } = m;
    const position = this.positionForMenu();
    const prefix = this.prefix();
    const { items, maxCol } = await this.computeCompletions(prefix);
    const charBounds = m.env.fontMetric.sizeFor(fontFamily, fontSize, 'M');
    const minWidth = 120;
    const textWidth = charBounds.width * maxCol;
    const lineHeight = m.document.getLine(0).height;
    const width = Math.max(minWidth, textWidth < m.width ? textWidth : m.width);
    const minHeight = 70; const maxHeight = 700;
    const fullHeight = lineHeight * items.length + lineHeight + 10;
    const height = Math.max(minHeight, Math.min(maxHeight, fullHeight));
    let bounds = position.extent(pt(width, height));

    // ensure menu is visible
    const world = m.world(); let visibleBounds;
    if (world) {
      visibleBounds = world.visibleBounds().insetBy(5);
      if (bounds.bottom() > visibleBounds.bottom()) {
        let delta = bounds.bottom() - visibleBounds.bottom();
        if (delta > bounds.height - 50) delta = bounds.height - 50;
        bounds.height -= delta;
      }
      if (bounds.right() > visibleBounds.right()) {
        const delta = bounds.right() - visibleBounds.right();
        if (bounds.width - delta < minWidth) bounds.width = minWidth;
        else bounds.width -= delta;
      }
      if (!visibleBounds.containsRect(bounds)) {
        bounds = bounds.withTopLeft(visibleBounds.translateForInclusion(bounds).topLeft());
      }
      bounds = bounds.translatedBy(visibleBounds.insetBy(0).topLeft().negated());
    }

    return {
      master: {
        auto: 'styleguide://SystemWidgets/autocomplete list'
      },
      hasFixedPosition: true,
      epiMorph: true,
      fontSize,
      position: bounds.topLeft(),
      extent: bounds.extent(),
      items,
      input: prefix,
      name: 'text completion menu',
      historyId: 'lively.morphic-text completion',
      filterFunction: this.filterFunction,
      sortFunction: this.sortFunction
    };
  }

  removeMenuOnBlur ({ evt, menu }) {
    // this timeout ensures that the following
    // code always gets executed after blur and focus have
    // been processed completely (synchronously) by the event system
    setTimeout(() => {
      if (!menu.withAllSubmorphsDetect(m => m.isFocused())) {
        menu.remove();
        return;
      }
      menu.inputMorph.focus();
    });
  }

  async openCompletionList () {
    const currentCursorPos = this.textMorph.selection.start;
    const spec = await this.completionListSpec();
    const { theme } = this.textMorph.pluginFind(p => p.theme) || {};
    const menu = new FilterableList(spec);
    const intermittendTextRange = new Range({
      start: currentCursorPos,
      end: this.textMorph.selection.start
    });
    const intermittendInput = this.textMorph.textInRange(intermittendTextRange);
    const input = menu.inputMorph;
    const list = menu.listMorph;
    const prefix = spec.input;
    const mask = menu.addMorph({
      name: 'prefix mask',
      fill: Color.transparent,
      bounds: input.textBounds()
    }, input);
    list.master = null;
    if (!intermittendTextRange.isEmpty()) {
      this.textMorph.deleteText(intermittendTextRange);
      input.input = intermittendInput;
      input.gotoDocumentEnd();
    }
    input.fontColor = this.textMorph.fontColor;
    connect(input, 'textString', mask, 'setBounds', {
      converter: '() => input.textBounds()',
      varMapping: { input }
    });
    connect(menu, 'accepted', this, 'insertCompletion', {
      updater: `function($upd) {
        let textToInsert, customInsertionFn = null, completion = this.sourceObj.selection;
        if (completion) {
          if (completion.prefix) prefix = completion.prefix;
          textToInsert = completion.completion;
          customInsertionFn = completion.customInsertionFn;
        } else {
          textToInsert = this.sourceObj.inputMorph.textString;
        }
        $upd(textToInsert, prefix, customInsertionFn);
      }`,
      varMapping: { prefix }
    });
    connect(menu, 'accepted', menu, 'remove');
    connect(menu, 'canceled', menu, 'remove');
    connect(menu, 'remove', this.textMorph, 'focus');
    connect(menu.inputMorph, 'onBlur', this, 'removeMenuOnBlur', {
      converter: 'evt => ({menu, evt})', varMapping: { menu }
    });

    const world = this.textMorph.world();

    // fixme: the styling of the completion menu should be defined by the theme itself
    list.addStyleClass('hiddenScrollbar');
    menu.paddingMorph.height = 2;
    input.height = list.itemHeight;
    input.clipMode = 'visible';
    input.fill = this.textMorph.fill;
    input.fixedHeight = true;
    input.fixedWidth = false;
    input.fontSize = list.fontSize;

    //menu.get("padding").height = 0;
    menu.relayout();
    menu.selectedIndex = 0;

    // force the master styling while styll not visible, to ensure proper measuring
    menu.master.applyIfNeeded(true);
    input.focus(); // get the focus already, to receive all text input while style is being applied
    await menu.master.whenApplied();
    if (prefix.length) {
      input.gotoDocumentEnd();
      menu.moveBy(pt(-input.textBounds().width, 0));
    }
    world.addMorph(menu);
    menu.inputPadding = Rectangle.inset(0, 0, 0, 0);
    return menu;
  }

  async autoInsertBestMatchingCompletion (prefix, completionMustStartWithPrefix = true, customInsertionFn) {
    const [completion] = await this.computeSortedCompletions(prefix, completionMustStartWithPrefix);
    if (completion) { this.insertCompletion(completion.value.completion, prefix, customInsertionFn); }
  }

  insertCompletion (completion, prefix, customInsertionFn) {
    const m = this.textMorph; const doc = m.document;
    const selections = m.selection.isMultiSelection
      ? m.selection.selections : [m.selection];
    m.undoManager.group();
    selections.forEach(sel => {
      sel.collapseToEnd();
      const end = sel.lead;
      const start = prefix
        ? doc.indexToPosition(doc.positionToIndex(end) - prefix.length) : end;
      typeof customInsertionFn === 'function'
        ? customInsertionFn(completion, prefix, m, { start, end }, sel)
        : m.replace({ start, end }, completion);
    });
    m.undoManager.group();
  }
}

export var completionCommands = [

  {
    name: 'text completion',
    handlesCount: true, // to ignore and not open multiple lists
    multiSelectAction: 'single',
    async exec (morph, opts, count) {
      const completer = new CompletionController(morph, defaultCompleters);
      await completer.openCompletionList();
      return true;
    }
  },

  {
    name: 'text completion first match',
    handlesCount: true, // to ignore and not open multiple lists
    multiSelectAction: 'single',
    async exec (morph, opts, count) {
      const completer = new CompletionController(morph, defaultCompleters);
      await completer.autoInsertBestMatchingCompletion(completer.prefix());
      return true;
    }
  }

];
