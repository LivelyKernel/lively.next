import { Color, pt, Rectangle } from "lively.graphics";
import { obj, arr, promise, string } from "lively.lang";
import { connect } from "lively.bindings";
import { Morph, config } from "lively.morphic";
import { Tree, TreeData } from "lively.morphic/components/tree.js";
import { HorizontalResizer } from "lively.morphic/components/resizers.js";
import { JavaScriptEditorPlugin } from "./editor-plugin.js";


var inspectorCommands = [

 {
   name: "focus codeEditor",
   exec: inspector => {
     inspector.get("codeEditor").show();
     inspector.get("codeEditor").focus();
     return true;
   }
 },

 {
   name: "focus propertyTree",
   exec: inspector => {
     inspector.get("propertyTree").show();
     inspector.get("propertyTree").focus();
     return true;
   }
 }

];


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// printing
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME duplication with lively.vm completions and lively morphic completions and inspector!
var symMatcher = /^Symbol\((.*)\)$/,
    knownSymbols = (() =>
      Object.getOwnPropertyNames(Symbol)
        .filter(ea => typeof Symbol[ea] === "symbol")
        .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))();
function printSymbol(sym) {
  if (Symbol.keyFor(sym)) return `Symbol.for("${Symbol.keyFor(sym)}")`;
  if (knownSymbols.get(sym)) return knownSymbols.get(sym)
  var matched = String(sym).match(symMatcher);
  return String(sym);
}
function safeToString(value) {
  if (!value) return String(value);
  if (Array.isArray(value)) return `[${value.map(safeToString).join(",")}]`;
  if (typeof value === "symbol") return printSymbol(value);
  try {
    return String(value);
  } catch (e) { return `Cannot print object: ${e}`; }
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function printValue(value) {
  var result;
  if (obj.isPrimitive(value)) result = string.print(value);
  else if (Array.isArray(value)) {
    var tooLong = value.length > 3;
    if (tooLong) value = value.slice(0, 3);
    var printed = string.print(value);
    if (tooLong) printed = printed.slice(0, -1) + ", ...]";
    result = printed;
  } else result = string.print(value);
  result = result.replace(/\n/g, "");
  return result;
}

function propertyNamesOf(obj) {
  if (!obj) return [];
  var keys = arr.sortBy(Object.keys(obj), p => p.toLowerCase());
  if (Array.isArray(obj)) {
    var indexes = obj.length ? arr.range(0, obj.length-1).map(String) : [];
    return indexes.concat(arr.withoutAll(keys, indexes));
  }
  return keys;
}

var defaultPropertyOptions = {
  includeDefault: true,
  includeSymbols: true,
  sort: true,
  sortFunction: (a, b) => {
    if (a.hasOwnProperty("priority") || b.hasOwnProperty("priority")) {
      var aP = a.priority || 0, bP = b.priority || 0;
      if (aP < bP) return -1;
      if (aP > bP) return 1;
    }

    var aK = (a.keyString || a.key).toLowerCase(),
        bK = (b.keyString || b.key).toLowerCase();
    return aK < bK ? -1 : aK === bK ? 0 : 1;
  }
}

function propertiesOf(target) {
  if (!target) return [];

  var seen = {}, props = [],
      isCollapsed = true,
      customProps = typeof target.livelyCustomInspect === "function" ?
        target.livelyCustomInspect() : {},
      options = {
        ...defaultPropertyOptions,
        ...customProps
      };

  if (customProps.properties) {
    for (let {key, hidden, priority, keyString, value, valueString} of customProps.properties) {
      seen[key] = true;
      if (hidden) continue;
      props.push({
        priority,
        key, keyString: keyString || safeToString(key),
        value, valueString,
        isCollapsed
      });
    }
  }

  if (options.includeDefault) {
    var defaultProps = propertyNamesOf(target);
    for (let key of defaultProps) {
      if (key in seen) continue;
      var value = target[key], valueString = printValue(value);
      props.push({key, value, valueString, isCollapsed})
    }
    if (options.includeSymbols) {
      for (let key of Object.getOwnPropertySymbols(target)) {
        var keyString = safeToString(key), value = target[key], valueString = printValue(value);
        props.push({key, keyString, value, valueString, isCollapsed});
      }
    }
  }

  if (options.sort) props = props.sort(options.sortFunction);

  return props;
}




class InspectorTreeData extends TreeData {

  static forObject(obj) {
    return new this({key: "inspectee", value: {inspectee: obj}, isCollapsed: true});
  }

  display(node) {
     var keyString = node.keyString || node.key,
         valueString = node.valueString || printValue(node.value);
     return `${keyString}: ${valueString}`;
  }

  isCollapsed(node) { return node.isCollapsed; }

  collapse(node, bool) {
    node.isCollapsed = bool;
    if (bool || this.isLeaf(node)) return;

    node.children = propertiesOf(node.value).map(node => {
      this.parentMap.set(node, node); return node; });
  }

  getChildren(node) { return node.children; }

  isLeaf(node) { return obj.isPrimitive(node.value); }
}


// inspect(this)
export async function inspect(targetObject) {
  return await Inspector.openInWindow({targetObject});
}

export default class Inspector extends Morph {

  static async openInWindow(props) {
    var i = new this(props).openInWorld();
    (await i.world().openInWindow(i)).activate();
    return i;
  }

  constructor(props = {}) {
    var {targetObject} = props;
    props = obj.dissoc(props, ["targetObject"])
    super({
      name: "inspector",
      extent: pt(400,500),
      ...props
    });
    this.build();
    this.state = {targetObject: undefined, updateInProgress: false};
    this.targetObject = targetObject || null;
  }

  get isInspector() { return true; }

  get targetObject() { return this.state.targetObject; }
  set targetObject(obj) {
    this.state.targetObject = obj;
    this.prepareForNewTargetObject(obj);
  }

  async prepareForNewTargetObject(target) {
    if (this.isUpdating()) await this.whenUpdated();

    var {promise: p, resolve} = promise.deferred();
    this.state.updateInProgress = p;

    try {
      var td = InspectorTreeData.forObject(target),
          tree = this.get("propertyTree");
      tree.treeData = td;
      await tree.onNodeCollapseChanged({node: td.root, isCollapsed: false});
      tree.selectedIndex = 1;
      await tree.execCommand("uncollapse selected node");
    } catch (e) { this.showError(e); }

    this.state.updateInProgress = null;

  }

  isUpdating() { return !!this.updateInProgress; }

  whenUpdated() { return this.updateInProgress || Promise.resolve(); }

  get selectedObject() {
    var sel = this.get("propertyTree").selection;
    return sel ? sel.value : this.state.targetObject
  }

  focus() {
    this.get("codeEditor").focus();
  }

  build() {
    var jsPlugin = new JavaScriptEditorPlugin(config.codeEditor.defaultTheme),
        treeStyle = {
          borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: config.codeEditor.defaultStyle.fontFamily
        },
        textStyle = {
          borderWidth: 1, borderColor: Color.gray,
          type: "text", ...config.codeEditor.defaultStyle,
          textString: "",
          plugins: [jsPlugin]
        };

    var [
      propertyTreeBounds,
      verticalResizerBounds,
      codeEditorBounds
    ] = this.innerBounds().divide([
      new Rectangle(0, 0,    1, 0.49),
      new Rectangle(0, 0.49, 1, 0.01),
      new Rectangle(0, 0.5,  1, .5)]);

    this.submorphs = [
      new Tree({
        name: "propertyTree", ...treeStyle,
        bounds: propertyTreeBounds,
        treeData: InspectorTreeData.forObject(null)
      }),
      new HorizontalResizer({name: "resizer", bounds: verticalResizerBounds}),
      {name: "codeEditor", bounds: codeEditorBounds, ...textStyle}
    ];

    // FIXME? how to specify that directly??
    jsPlugin.evalEnvironment = {
      targetModule: "lively://lively.morphic/inspector",
      get context() { return jsPlugin.textMorph.owner.selectedObject },
      format: "esm"
    }

    this.get("resizer").addScalingAbove(this.get("propertyTree"));
    this.get("resizer").addScalingBelow(this.get("codeEditor"));
    connect(this, "extent", this, "relayout");
  }

  relayout() {
    var tree = this.get("propertyTree"),
        resizer = this.get("resizer"),
        ed = this.get("codeEditor"),
        treeRatio = tree.height/(tree.height+ed.height);

    tree.height = treeRatio * (this.height-resizer.height);
    ed.height = (this.height-resizer.height) - tree.height;

    ed.top = tree.bottom;
    resizer.top = tree.bottom;
    ed.top = resizer.bottom;
    tree.width = ed.width = resizer.width = this.width;
  }

  get keybindings() {
    return [
      {keys: "Alt-Up", command: "focus propertyTree"},
      {keys: "Alt-Down", command: "focus codeEditor"},
      {keys: "F1", command: "focus propertyTree"},
      {keys: "F2", command: "focus codeEditor"},
    ].concat(super.keybindings);
  }

  get commands() { return inspectorCommands; }

}
