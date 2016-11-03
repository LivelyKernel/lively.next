import { Color, pt, Rectangle, rect } from "lively.graphics";
import { obj, arr, promise, string, Path } from "lively.lang";
import { connect, disconnect } from "lively.bindings";
import { Morph, morph, show } from "../../index.js";
import { Tree, TreeData } from "../../tree.js";
import { GridLayout } from "../../layout.js";
import { JavaScriptEditorPlugin } from "./editor-plugin.js";
import { HorizontalResizer } from "../../resizers.js";
import config from "../../config.js";


var inspectorCommands = [];

function propertyNamesOf(obj) {

  if (!obj) return [];

  var keys = arr.sortBy(Object.keys(obj), p => p.toLowerCase());

  if (Array.isArray(obj)) {
    var indexes = obj.length ? arr.range(0, obj.length-1).map(String) : [];
    return indexes.concat(arr.withoutAll(keys, indexes));
  }

  return keys;
}

class InspectorTreeData extends TreeData {

  static forObject(obj) {
    return new this({propName: "???", value: obj, isCollapsed: true})
  }

  display(node) { return `${node.propName}: ${string.truncate(String(node.value), 100).replace(/\n/g, "")}`; }
  isCollapsed(node) { return node.isCollapsed; }
  collapse(node, bool) {
    node.isCollapsed = bool;
    if (bool || this.isLeaf(node)) return;
    node.children = propertyNamesOf(node.value)
      .map(propName => {
        var childNode = {propName, value: node.value[propName], isCollapsed: true};
        this.parentMap.set(childNode, node);
        return childNode;
      });
  }
  getChildren(node) { return this.isLeaf(node) ? null : this.isCollapsed(node) ? [] : node.children; }
  isLeaf(node) { return obj.isPrimitive(node.value); }

}

// var i = Inspector.openInWindow({targetObject: this})
// i.remove()

// i.targetObject = this
// i.get("propertyTree").onNodeCollapseChanged


export class Inspector extends Morph {

  static openInWindow(props) {
    var i = new this(props).openInWorld();
    i.world().openInWindow(i).activate();
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
    this.state = {targetObject: undefined};
    this.targetObject = targetObject || null;
  }

  get isInspector() { return true; }

  get targetObject() { return this.state.targetObject; }
  set targetObject(obj) {
    this.state.targetObject = obj;
    var td =  InspectorTreeData.forObject(obj),
        tree = this.get("propertyTree");
    tree.treeData = td;
    tree.onNodeCollapseChanged({node: td.root, isCollapsed: false})
  }

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