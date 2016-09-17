import { Color, pt, Rectangle } from "lively.graphics"
import { morph, List, show, Text } from "lively.morphic"
import { connect, disconnect, signal } from "lively.bindings"
import { FilterableList } from "lively.morphic/list.js";
import { arr, string, obj } from "lively.lang";


export class Completer {
  compute() { return []; }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function buildEvalOpts(morph) {
  // FIXME, also in text/commands
  var env = morph.evalEnvironment || {};
  if (!env.targetModule) env.targetModule = "lively://lively.next-prototype_2016_08_23/" + morph.id;
  var sourceURL = targetModule + "_doit_" + Date.now();
  return {System, context: morph, sourceURL, ...env}
}

export class DynamicJavaScriptCompleter {

  isValidPrefix(prefix) {
    return /\.[a-z0-9_]*$/i.test(prefix);
  }

  async compute(textMorph) {
    let sel = textMorph.selection,
        roughPrefix = sel.isEmpty() ? textMorph.getLine(sel.lead.row).slice(0, sel.lead.column) : sel.text;

    if (!this.isValidPrefix(roughPrefix)) return [];

    // FIXME this should got into a seperate JavaScript support module where
    // the dependency can be properly declared
    var mod = System.get(System.decanonicalize("lively.vm/lib/eval-strategies.js"));
    if (!mod) return [];
    var evalStrategy = new mod.LivelyVmEvalStrategy();

    let completionRequest = await evalStrategy.keysOfObject(roughPrefix, buildEvalOpts(textMorph)),
        {completions, prefix} = completionRequest,
        count = completions.reduce((sum, [_, completions]) => sum+completions.length, 0),
        priority = 2000,
        processed = completions.reduce((all, [protoName, completions], i) => {
          return all.concat(completions.map(ea =>
            ({info: protoName, completion: ea, prefix: completionRequest.prefix})))
        }, []);

    // assign priority:
    processed.forEach((ea,i) => Object.assign(ea, {priority: priority+processed.length-i}));
    return processed
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const keywords = [
  "arguments",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "eval",
  "export",
  "import",
  "extends",
  "false",
  "true",
  "finally",
  "instanceof",
  "static",
  "super",
  "this",
  "throw",
  "typeof",
  "while",
  "with",
  "yield",
  "await",

  "Array",
  "Date",
  "eval",
  "function",
  "hasOwnProperty",
  "Infinity",
  "isFinite",
  "isNaN",
  "isPrototypeOf",
  "length",
  "Math",
  "NaN",
  "name",
  "Number",
  "Object",
  "prototype",
  "String",
  "toString",
  "undefined",
  "valueOf",

  "alert",
  "assign",
  "clearInterval",
  "clearTimeout",
  "decodeURI",
  "decodeURIComponent",
  "document",
  "encodeURI",
  "encodeURIComponent",
  "escape",
  "navigator",
  "parseFloat",
  "parseInt",
  "setInterval",
  "setTimeout",
  "window",
  "document",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]

export class JavaScriptKeywordCompleter {

  compute(textMorph, prefix) {
    return keywords.map(ea => ({completion: ea, priority: 0}))
  }

}


export var defaultCompleters = [
  new WordCompleter(),
  new DynamicJavaScriptCompleter(),
  new JavaScriptKeywordCompleter()
]

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class CompletionController {

  constructor(textMorph, completers = []) {
    this.textMorph = textMorph;
    this.completers = completers;
  }

  async computeCompletions(prefix) {
    var completions = [];
    for (var c of this.completers)
      try {
        completions = completions.concat(await c.compute(this.textMorph, prefix));
      } catch (e) {}

    var infoCol = completions.reduce((maxCol, ea) => Math.max(ea.completion.length, maxCol), 0),
        maxCol = infoCol;

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

    var items = arr.sortByKey(withHighestPriority, "priority")
      .reverse()
      .map(ea => {
        var info = (ea.info || "");
        maxCol = Math.max(maxCol, infoCol+info.length);
        return {
          isListItem: true,
          string: string.pad(ea.completion, infoCol-ea.completion.length, false) + info,
          value: ea
        };
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
    return globalCursorBounds.topLeft().addXY(m.padding.left()-1, m.padding.top()-1);
  }

  async completionListSpec() {
    var m = this.textMorph,
        {fontSize, fontFamily} = m,
        position = this.positionForMenu(),
        prefix = this.prefix(),
        {items, maxCol} = await this.computeCompletions(prefix),
        charBounds = m.env.fontMetric.sizeFor(fontFamily, fontSize, "M"),
        minWidth = 300,
        width = Math.max(minWidth, charBounds.width*maxCol),
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
      borderColor: Color.gray, borderWidth: 1
    }
  }

  async openCompletionList() {
    var spec = await this.completionListSpec(),
        menu = new FilterableList(spec),
        prefix = spec.input;

    connect(menu, "accepted", this, "insertCompletion", {
      updater: function($upd) {
        var textToInsert, completion = this.sourceObj.selection;
        if (completion) {
          if (completion.prefix) prefix = completion.prefix;
          textToInsert = completion.completion;
        } else {
          textToInsert = this.sourceObj.get("input").textString;
        }
        $upd(textToInsert, prefix);
      }, varMapping: {prefix}});
    connect(menu, "accepted", menu, "remove");
    connect(menu, "canceled", menu, "remove");
    connect(menu, "remove", this.textMorph, "focus");

    var world = this.textMorph.world();
    world.addMorph(menu);

    menu.selectedIndex = 0;
    prefix.length && menu.get("input").gotoStartOrEnd({direction: "end"});
    menu.get("input").focus();
  }

  insertCompletion(completion, prefix) {
    var m = this.textMorph,
        sel = m.selection;
    sel.collapseToEnd();
    var end = sel.lead;

    prefix && m.cursorLeft(prefix.length);
    var start = m.cursorPosition;
    sel.range = {start, end};
    sel.text = completion;
    sel.collapseToEnd();
  }

}


export var completionCommands = [{
  name: "text completion",
  async exec(morph, opts) {
    var completer = new CompletionController(morph, defaultCompleters);
    await completer.openCompletionList();
    return true;
  }
}];
