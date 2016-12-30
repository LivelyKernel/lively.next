import { arr, obj, Path } from "lively.lang";
import { Morph, GridLayout, config } from "lively.morphic";
import { pt, Color, Rectangle } from "lively.graphics";
import { JavaScriptEditorPlugin } from "../editor-plugin.js";
import { withSuperclasses, instanceFields, classFields, isClass } from "lively.classes/util.js";
import { TreeData, Tree } from "lively.morphic/tree.js";
import { connect } from "lively.bindings";
import { RuntimeSourceDescriptor } from "lively.classes/source-descriptors.js";


// var oe = ObjectEditor.open({target: this})

// var tree = oe.get("classTree");
// tree.treeData = new ClassTreeData(this.constructor);
// var td = oe.get("classTree").treeData
// oe.remove()

// td.getChildren(td.root)
// td.collapse(td.getChildren(td.root)[0], false)
// tree.update()
// td.isCollapsed(td.getChildren(td.root)[2])
// tree.onNodeCollapseChanged(td.root)

// var x = new ClassTreeData(this.constructor)
// x.getChildren(x.root)
// x.getChildren(x.getChildren(x.root)[1])

// tree.selection = x.getChildren(x.root)[2]

class ClassTreeData extends TreeData {

  constructor(target) {
    super({
      target,
      name: "root",
      isRoot: true,
      isCollapsed: false
    });
  }

  display(node) {
    if (!node) return "empty";

    if (node.isRoot)
      return node.target.name || node.target.id || "root object"

    if (isClass(node.target))
      return node.target.name;

    return node.name || "no name";
  }

  isLeaf(node) { if (!node) return true; return !node.isRoot && !isClass(node.target); }
  isCollapsed(node) { return !node || node.isCollapsed; }
  collapse(node, bool) { node && (node.isCollapsed = bool); }

  getChildren(node) {
    if (!node) return [];
    if (node.isCollapsed) return [];

    if (node.isRoot) {
      if (node.children) return node.children;
      var classes = arr.without(withSuperclasses(node.target), Object).reverse();
      return node.children = classes.map(klass => {
        return {
          target: klass,
          isCollapsed: true,
        }
      })
    }

    if (isClass(node.target))
      return node.children || (node.children = classFields(node.target).map(ea => ({name: "static " + ea.name, target: ea}))
              .concat(instanceFields(node.target).map(ea => ({name: ea.name, target: ea}))));

    return [];
  }

}


export class ObjectEditor extends Morph {

  static open(options = {}) {
    var ed = new this(options),
        winOpts = {name: "ObjectEditor window", title: options.title || "ObjectEditor"},
        win = ed.openInWindow(winOpts).activate();

    return win;
  }

  constructor(props = {}) {
    super({
      extent: pt(700, 400),
      ...obj.dissoc(props, ["target"])
    });
    this.state = {target: null, selectedClass: null, selectedMethod: null};
    this.build(props);
    if (props.target) this.target = props.target;
  }

  get target() { return this.state.target; }
  set target(obj) {
    this.state.target = obj;
    this.state.selectedClass = null;
    this.state.selectedMethod = null;
    var tree = this.get("classTree");
    tree.treeData = new ClassTreeData(obj.constructor);

    Object.assign(this.editorPlugin.evalEnvironment, {
      targetModule: "lively://object-editor/" + this.id,
      context: this.target,
      format: "esm"
    });
  }

  build(props) {
    var listStyle = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
        },

        textStyle = {
          borderWidth: 1, borderColor: Color.gray,
          type: "text",
          ...config.codeEditor.defaultStyle,
          plugins: [new JavaScriptEditorPlugin(config.codeEditor.defaultTheme)]
        },

        btnStyle = {
          type: "button",
          fontSize: 10,
          activeStyle: {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(20,18),
        },

        bounds = this.innerBounds(),

        [
          classTreeBounds,
          sourceEditorBounds
        ] = bounds.extent().extentAsRectangle().divide([
          new Rectangle(0,   0,    0.5,   1),
          new Rectangle(0.5,   0,    0.5,   1)
        ]);

    this.submorphs = [
      {name: "sourceEditor", bounds: sourceEditorBounds, ...textStyle, doSave: () => this.save()},

      {type: Tree, name: "classTree", bounds: classTreeBounds, treeData: new ClassTreeData(null)},
      {type: "button", name: "addClassButton", label: "+"},
    ];

    var l = this.layout = new GridLayout({
      grid: [
        ["classTree", "classTree", "sourceEditor"],
        [null, "addClassButton", "sourceEditor"],
      ]});
    l.col(0).fixed = 100;
    l.col(1).fixed = 100;
    l.row(1).fixed = 20;
    // var oe = ObjectEditor.open({target: this})

    // l.col(2).fixed = 100; l.row(0).paddingTop = 1; l.row(0).paddingBottom = 1;

    connect(this.get("classTree"), "selection", this, "onClassTreeSelection");
  }

  async systemInterface() {
    var livelySystem = await System.import("lively-system-interface"),
        remote = this.backend;
    return !remote || remote === "local" ?
      livelySystem.localInterface :
      livelySystem.serverInterfaceFor(remote);
  }

  get backend() { return this.editorPlugin.evalEnvironment.remote || "local"; }
  set backend(remote) {
    this.editorPlugin.evalEnvironment.remote = remote;
  }

  get editorPlugin() { return this.get("sourceEditor").pluginFind(p => p.isEditorPlugin); }

  onClassTreeSelection(node) {
    if (!node) {
      this.get("sourceEditor").textString = "";
      return;
    }

    if (isClass(node.target)) {
      this.selectClass(node.target);
      return;
    }

    var tree = this.get("classTree"),
        parentNode = tree.treeData.parentNode(node);
    this.selectMethod(parentNode.target, node.target);
  }

  sourceDescriptorFor(klass) {
    return RuntimeSourceDescriptor.for(klass);
  }

  async selectClass(klass) {
    var ed = this.get("sourceEditor"),
        descr = this.sourceDescriptorFor(klass),
        {declaredNames} = await descr.declaredAndUndeclaredNames,
        source = await descr.source,
        system = await this.systemInterface(),
        format = (await system.moduleFormat(descr.module.id)) || "esm",
        [_, ext] = descr.module.id.match(/\.([^\.]+)$/) || [];

    ed.textString = source;

    Object.assign(this.editorPlugin.evalEnvironment, {
      targetModule: descr.module.id,
      context: this.target,
      knownGlobals: declaredNames,
      format
    });

    this.state.selectedClass = klass;
  }

  async selectMethod(klass, methodSpec) {
    if (this.state.selectedClass !== klass)
      await this.selectClass(klass);

    var ed = this.get("sourceEditor"),
        descr = RuntimeSourceDescriptor.for(klass),
        parsed = await descr.ast,
        methods = Path("body.body").get(parsed),
        method = methods.find(({key: {name}}) => name === methodSpec.name);

    if (!method) {
      this.setStatusMessage(`Cannot find method ${methodSpec.name}`);
      return;
    }

    ed.cursorPosition = ed.indexToPosition(method.key.start);
    var methodRange = {
      start: ed.indexToPosition(method.start),
      end: ed.indexToPosition(method.end)
    }
    ed.flash(methodRange, {id: 'method', time: 1000, fill: Color.rgb(200,235,255)});
    ed.centerRow();
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  focus() { this.get("sourceEditor").focus(); }

  get keybindings() {
    return [
      {keys: "F1", command: "focus class tree"},
      {keys: "F2", command: "focus code editor"},
    ].concat(super.keybindings);
  }

  get commands() {
    return commands;
  }

}


var commands = [
  {name: "focus class tree", exec: ed => { var m = ed.get("classTree"); m.show(); m.focus(); return true; }},
  {name: "focus code editor", exec: ed => { var m = ed.get("sourceEditor"); m.show(); m.focus(); return true; }},
]