import { Color, pt } from "lively.graphics";
import { morph } from "lively.morphic";
import { connect } from "lively.bindings";
import { FilterableList } from "lively.morphic/list.js";
import { arr, string } from "lively.lang";


export class Completer {
  compute() { return []; }
}

export class WordCompleter {

  compute(textMorph, prefix) {
    var words = [],
        completions = [],
        lines = textMorph.document.lines,
        row = textMorph.cursorPosition.row,
        basePriority = 1000;

    for (var i = row; i >= 0; i--)
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

    var maxCol = 0;
    var items = arr.sortByKey(withHighestPriority, "priority")
      .reverse()
      .map(ea => {
        var string = ea.completion,
            annotation = String(ea.info || "");
        maxCol = Math.max(maxCol, string.length + annotation.length)
        return {isListItem: true, string, annotation, value: ea};
      });
    return {items, maxCol}
  }

  prefix() {    
    let m = this.textMorph,
        sel = m.selection,
        roughPrefix = sel.isEmpty() ? m.getLine(sel.lead.row).slice(0, sel.lead.column) : sel.text;
    return roughPrefix.match(/[a-z0-9@_]*$/i)[0];
  }

  positionForMenu() {
    var m = this.textMorph,
        cursorBounds = m.charBoundsFromTextPosition(m.cursorPosition).translatedBy(m.scroll.negated()),
        globalCursorBounds = m.getGlobalTransform().transformRectToRect(cursorBounds);
    return globalCursorBounds.topLeft().addXY(m.padding.left()-1, -m.padding.top());
  }

  async completionListSpec() {
    var m = this.textMorph,
        {fontSize, fontFamily} = m,
        position = this.positionForMenu(),
        prefix = this.prefix(),
        {items, maxCol} = await this.computeCompletions(prefix),
        charBounds = m.env.fontMetric.sizeFor(fontFamily, fontSize, "M"),
        minWidth = 80,
        textWidth = charBounds.width*maxCol,
        width = Math.max(minWidth, textWidth < m.width ? textWidth : m.width),
        minHeight = 70, maxHeight = 700,
        fullHeight = charBounds.height*items.length+charBounds.height+10,
        height = Math.max(minHeight, Math.min(maxHeight, fullHeight)),
        bounds = position.extent(pt(width, height));

    // ensure menu is visible
    var world = m.world();
    if (world) {
      var visibleBounds = world.visibleBounds().insetBy(5);
      if (bounds.bottom() > visibleBounds.bottom()) {
        var delta = bounds.bottom() - visibleBounds.bottom();
        if (delta > bounds.height-50) delta = bounds.height-50;
        bounds.height -= delta;
      }
      if (!visibleBounds.containsRect(bounds))
        bounds = bounds.withTopLeft(visibleBounds.translateForInclusion(bounds).topLeft());
    }

    return {
      fontFamily, fontSize,
      position: bounds.topLeft(),
      extent: bounds.extent(),
      items, input: prefix,
      name: "text completion menu",
      borderColor: Color.gray, borderWidth: 1,
      historyId: "lively.morphic-text completion"
    }
  }

  async openCompletionList() {
    var spec = await this.completionListSpec(),
        menu = new FilterableList(spec),
        prefix = spec.input;
    connect(menu, "accepted", this, "insertCompletion", {
      updater: function($upd) {
        var textToInsert,
            customInsertionFn = null,
            completion = this.sourceObj.selection;
        if (completion) {
          if (completion.prefix) prefix = completion.prefix;
          textToInsert = completion.completion;
          customInsertionFn = completion.customInsertionFn;
        } else {
          textToInsert = this.sourceObj.get("input").textString;
        }
        $upd(textToInsert, prefix, customInsertionFn);
      }, varMapping: {prefix}});
    connect(menu, "accepted", menu, "remove");
    connect(menu, "canceled", menu, "remove");
    connect(menu, "remove", this.textMorph, "focus");

    var world = this.textMorph.world();
    world.addMorph(menu);

    menu.selectedIndex = 0;
    prefix.length && menu.get("input").gotoDocumentEnd();
    menu.get("input").focus();
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


export var completionCommands = [{
  name: "text completion",
  handlesCount: true, // to ignore and not open multiple lists
  multiSelectAction: "single",
  async exec(morph, opts, count) {
    var completer = new CompletionController(morph, defaultCompleters);
    await completer.openCompletionList();
    return true;
  }
}];
