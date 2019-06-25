/*global Map*/
import { Color, Rectangle, pt } from "lively.graphics";
import { morph, ShadowObject, StyleSheet } from "lively.morphic";
import { connect } from "lively.bindings";
import { arr, string } from "lively.lang";
import { FilterableList } from "lively.components/list.js";
import { Range } from "lively.morphic/text/range.js";

export class Completer {
  compute() { return []; }
}

export class WordCompleter {

  compute(textMorph, prefix) {
    var words = [],
        completions = [],
        lines = textMorph.document.lineStrings,
        {row, column} = textMorph.cursorPosition,
        basePriority = 1000;

    for (var i = row-1; i >= 0; i--)
      for (var word of lines[i].split(/[^0-9a-z@_]+/i)) {
        if (!word || words.includes(word) || word === prefix) continue;
        words.push(word);
        completions.push({priority: basePriority-(row-i), completion: word})
      }

    for (var i = row+1; i < lines.length; i++)
      for (var word of lines[i].split(/[^0-9a-z_@]+/i)) {
        if (!word || words.includes(word) || word === prefix) continue;
        words.push(word);
        completions.push({priority: basePriority - (i-row), completion: word})
      }

    return completions;
  }

}

export var defaultCompleters = [
  new WordCompleter()
]

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class CompletionController {

  constructor(textMorph, completers = []) {
    this.textMorph = textMorph;
    completers = textMorph.pluginCollect("getCompleters", completers);
    this.completers = completers;
  }

  async computeCompletions(prefix) {
    var completions = [];
    for (var c of this.completers)
      try {
        completions = completions.concat(await c.compute(this.textMorph, prefix));
      } catch (e) {
        console.warn(`Error in completer ${c}: ${e.stack || e}`);
      }

    // if multiple options with same completion exist, uniq by the highest priority
    // note: there is a lively.lang bug that breaks groupBy if key === constructor...!
    var groups = new Map();
    completions.forEach(ea => {
      var group = groups.get(ea.completion);
      if (!group) { group = []; groups.set(ea.completion, group); }
      group.push(ea);
    });

    var withHighestPriority = [];
    for (let val of groups.values())
      withHighestPriority.push(arr.last(arr.sortByKey(val, "priority")))

    var maxCol = 0,
        sorted = arr.sortByKey(withHighestPriority, "priority").reverse(),
        highestPriority = (sorted.length && sorted[0].priority) || 0,
        items = sorted.map(ea => {
          ea.highestPriority = highestPriority;
          var string = ea.completion.replace(/\n/g, ""),
              annotation = String((ea.info || "").replace(/\n/g, ""));
          maxCol = Math.max(maxCol, string.length + annotation.length)
          return {isListItem: true, string, annotation, value: ea};
        });
    return {items, maxCol}
  }

  async computeSortedCompletions(prefix, mustStartWithPrefix = false) {
    let parsedInput = {tokens: [prefix], lowercasedTokens: [prefix], input: prefix},
        completions = await this.computeCompletions(prefix),
        completionsFiltered = arr.sortBy(
          completions.items.filter(item => this.filterFunction(parsedInput, item, mustStartWithPrefix)),
          item => this.sortFunction(parsedInput, item));
    return completionsFiltered;    
  }

  async _printCompletions(prefix) {
    // for debugging
    let table = (await this.computeSortedCompletions(prefix)).map(ea => {
      return {
        completion: ea.value.completion,
        priority: ea.value.priority,
        maxP: ea.value.highestPriority,
        sortVal: ea._cache[prefix].sortVal,
        lev: JSON.stringify(ea._cache[prefix].levenshtein),
      }
    })
    return string.printTable(lively.lang.grid.tableFromObjects(table));
  }

  prefix() {
    let m = this.textMorph,
        sel = m.selection,
        roughPrefix = sel.isEmpty() ? m.getLine(sel.lead.row).slice(0, sel.lead.column) : sel.text;
    return roughPrefix.match(/[a-z0-9@_]*$/i)[0];
  }

  filterFunction(parsedInput, item, mustStartWithPrefix = false) {
    if (!item._cache) item._cache = {};
    var {tokens, lowercasedTokens: lTokens, input} = parsedInput,
        cache = item._cache[input] || (item._cache[input] = {})
    if (cache.hasOwnProperty("filtered")) return cache.filtered;

    var compl = item.value.completion.replace(/\([^\)]*\)$/, ""),
        lCompl = compl.toLowerCase();


    if (mustStartWithPrefix && tokens[0] && !compl.startsWith(tokens[0])) {
      return cache.filtered = false;
    }

    if (lTokens.every(token => lCompl.includes(token))) return true;
    // "fuzzy" match
    var levCache = cache.levenshtein || (cache.levenshtein = {}),
        filtered = mustStartWithPrefix || arr.sum(parsedInput.lowercasedTokens.map(token =>
          levCache[token] || (levCache[token] = string.levenshtein(lCompl, token)))) <= 3;
    return cache.filtered = filtered;
  }

  sortFunction(parsedInput, item) {
    // Preioritize those completions that are close to the input. We also
    // want to consider the static priority of the item itself but adjust it
    // across the priority of all items
    if (!item._cache) item._cache = {};
    var cache = item._cache[parsedInput.input] || (item._cache[parsedInput.input] = {})
    if (cache.hasOwnProperty("sortVal")) return cache.sortVal;

    var cache = item._cache[parsedInput.input] = {},
        {highestPriority, completion, priority} = item.value ,
        completion = completion.replace(/\([^\)]*\)$/, "").toLowerCase();

    var boosted = 0;
    parsedInput.lowercasedTokens.forEach(t => {
      if (completion.startsWith(t)) boosted += 12;
      else if (t.length >= 3 && completion.includes(t)) boosted += 5;
    });

    var n = String(highestPriority).length-2,
        adjustedPriority = (priority || (boosted ? highestPriority : 0)) / 10**n,
        base = -adjustedPriority - boosted;

    var levCache = cache.levenshtein || (cache.levenshtein = {}),
        lev = arr.sum(parsedInput.lowercasedTokens.map(token =>
          levCache[token] || (levCache[token] = string.levenshtein(completion, token))));
    if (boosted) lev /= 2;
    return cache.sortVal = lev + base;
  }

  positionForMenu() {
    let m = this.textMorph,
        cursorBounds = m.charBoundsFromTextPosition(m.cursorPosition),
        globalCursorBounds = m.getGlobalTransform().transformRectToRect(cursorBounds);
    return globalCursorBounds.topLeft()
      .addXY(-m.padding.left(), -m.padding.top())
      .addXY(-m.scroll.x, -m.scroll.y)
      .addPt(pt(m.borderWidth + 2, m.borderWidth));
  }

  async completionListSpec() {
    let m = this.textMorph,
        {fontSize, fontFamily, fontColor} = m,
        position = this.positionForMenu(),
        prefix = this.prefix(),
        {items, maxCol} = await this.computeCompletions(prefix),
        charBounds = m.env.fontMetric.sizeFor(fontFamily, fontSize, "M"),
        minWidth = 120,
        textWidth = charBounds.width*maxCol,
        width = Math.max(minWidth, textWidth < m.width ? textWidth : m.width),
        minHeight = 70, maxHeight = 700,
        fullHeight = charBounds.height*items.length+charBounds.height+10,
        height = Math.max(minHeight, Math.min(maxHeight, fullHeight)),
        bounds = position.extent(pt(width, height));

    // ensure menu is visible
    let world = m.world(), visibleBounds;
    if (world) {
      visibleBounds = world.visibleBounds().insetBy(5);
      if (bounds.bottom() > visibleBounds.bottom()) {
        let delta = bounds.bottom() - visibleBounds.bottom();
        if (delta > bounds.height-50) delta = bounds.height-50;
        bounds.height -= delta;
      }
      if (bounds.right() > visibleBounds.right()) {
        let delta = bounds.right() - visibleBounds.right();
        if (bounds.width-delta < minWidth) bounds.width = minWidth;
        else bounds.width -= delta;
      }
      if (!visibleBounds.containsRect(bounds))
        bounds = bounds.withTopLeft(visibleBounds.translateForInclusion(bounds).topLeft());
      bounds = bounds.translatedBy(visibleBounds.insetBy(-5).topLeft().negated());
    }

    return {
      styleSheets: new StyleSheet({
        "[name=input]": {
          fill: Color.transparent
        },
        ".List": {
          dropShadow: new ShadowObject({
            rotation: 45,
            distance: 5,
            blur: 40,
            color: Color.black.withA(.3)
          }),
          fontColor,
        },
        ".List .ListItemMorph": {
          fontFamily,
          fontSize,
          fontColor
        }
      }),
      hasFixedPosition: true,      
      fontColor,
      epiMorph: true,
      fontFamily, fontSize,
      position: bounds.topLeft(),
      extent: bounds.extent(),
      items, input: prefix,
      name: "text completion menu",
      historyId: "lively.morphic-text completion",
      fill: Color.transparent,
      border: {width: 0, color: Color.gray},
      inputPadding: Rectangle.inset(0, 2),
      filterFunction: this.filterFunction,
      sortFunction: this.sortFunction
    }
  }
  
  removeMenuOnBlur({evt, menu}) {
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

  async openCompletionList() {
    let currentCursorPos = this.textMorph.selection.start,
        spec = await this.completionListSpec(),
        { theme } = this.textMorph.pluginFind(p => p.theme) || {},
        menu = new FilterableList(spec),
        intermittendTextRange = new Range({
          start: currentCursorPos,
          end: this.textMorph.selection.start
        }),
        intermittendInput = this.textMorph.textInRange(intermittendTextRange),
        input = menu.inputMorph,
        list = menu.listMorph,
        prefix = spec.input ,
        mask = menu.addMorph({
          name: 'prefix mask',
          fill: Color.transparent,
          bounds: input.textBounds()
        }, input);
    if (!intermittendTextRange.isEmpty()) {
      this.textMorph.deleteText(intermittendTextRange);
      input.input = intermittendInput;
      input.gotoDocumentEnd(); 
    }
    input.fontColor = this.textMorph.fontColor;
    connect(input, 'textString', mask, 'setBounds', {
      converter: () => input.textBounds(),
      varMapping: {input}
    });
    connect(menu, "accepted", this, "insertCompletion", {
      updater: function($upd) {
        let textToInsert, customInsertionFn = null, completion = this.sourceObj.selection;
        if (completion) {
          if (completion.prefix) prefix = completion.prefix;
          textToInsert = completion.completion;
          customInsertionFn = completion.customInsertionFn;
        } else {
          textToInsert = this.sourceObj.inputMorph.textString;
        }
        $upd(textToInsert, prefix, customInsertionFn);
      },
      varMapping: {prefix}
    });
    connect(menu, "accepted", menu, "remove");
    connect(menu, "canceled", menu, "remove");
    connect(menu, "remove", this.textMorph, "focus");
    connect(menu.inputMorph, 'onBlur', this, 'removeMenuOnBlur', {
      converter: evt => ({menu, evt}), varMapping: {menu}
    });

    var world = this.textMorph.world();
    world.addMorph(menu);

    // fixme: the styling of the completion menu should be defined by the theme itself
    list.addStyleClass("hiddenScrollbar");
    list.fill = Color.white.withA(0.85);
    if (theme && theme.constructor.name == 'DarkTheme') {
      list.styleClasses = ['dark'];
      list.fill = Color.black.withA(0.7);
    }

    input.height = list.itemHeight;
    input.fixedHeight = true;
    input.focus();

    menu.get("padding").height = 0;
    menu.relayout();
    menu.selectedIndex = 0;
    if (prefix.length) {
      input.gotoDocumentEnd();
      menu.moveBy(pt(-input.textBounds().width + 2, 0));
    } else {
      menu.moveBy(pt(2, 0));
    }
    return menu;
  }

  async autoInsertBestMatchingCompletion(prefix, completionMustStartWithPrefix = true, customInsertionFn) {
    let [completion] = await this.computeSortedCompletions(prefix, completionMustStartWithPrefix);
    if (completion)
      this.insertCompletion(completion.value.completion, prefix, customInsertionFn);
  }

  insertCompletion(completion, prefix, customInsertionFn) {
    var m = this.textMorph, doc = m.document,
        selections = m.selection.isMultiSelection ?
          m.selection.selections : [m.selection];
    m.undoManager.group();
    selections.forEach(sel => {
      sel.collapseToEnd();
      var end = sel.lead,
          start = prefix ?
            doc.indexToPosition(doc.positionToIndex(end) - prefix.length) : end;
      typeof customInsertionFn === "function" ?
        customInsertionFn(completion, prefix, m, {start, end}, sel) :
        m.replace({start, end}, completion);
    });
    m.undoManager.group();
  }

}


export var completionCommands = [
  
  {
    name: "text completion",
    handlesCount: true, // to ignore and not open multiple lists
    multiSelectAction: "single",
    async exec(morph, opts, count) {
      var completer = new CompletionController(morph, defaultCompleters);
      await completer.openCompletionList();
      return true;
    }
  },

  {
    name: "text completion first match",
    handlesCount: true, // to ignore and not open multiple lists
    multiSelectAction: "single",
    async exec(morph, opts, count) {
      var completer = new CompletionController(morph, defaultCompleters);
      await completer.autoInsertBestMatchingCompletion(completer.prefix());
      return true;
    }
  },

];
