import { arr, obj, Path } from "lively.lang";
import { Morph, HorizontalLayout, GridLayout, config } from "lively.morphic";
import { pt, Color } from "lively.graphics";
import { JavaScriptEditorPlugin } from "../editor-plugin.js";
import { withSuperclasses, lexicalClassMembers, isClass } from "lively.classes/util.js";
import { TreeData, Tree } from "lively.morphic/tree.js";
import { connect } from "lively.bindings";
import { RuntimeSourceDescriptor } from "lively.classes/source-descriptors.js";
import { addScript } from "lively.classes/object-classes.js";
import { Icon } from "../../../icons.js";
import { chooseUnusedImports, interactivelyChooseImports } from "../import-helper.js";
import { module } from "lively.modules";


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
    // if (node.isCollapsed) return [];

    if (node.isRoot) {
      if (node.children) return node.children;
      var classes = arr.without(withSuperclasses(node.target), Object).reverse();
      return node.children = classes.map(klass => ({target: klass, isCollapsed: true}))
    }

    if (isClass(node.target)) {
      try {
        return node.children
          || (node.children = lexicalClassMembers(node.target).map(ea => {
            var {static: _static, name} = ea;
            return {name: (_static ? "static " : "") + name, target: ea};
          }));
      } catch (e) { $world.showError(e); return node.children = []; }
    }

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
      extent: pt(800, 500),
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

  get selectedModule() {
    var mid = this.editorPlugin.evalEnvironment.targetModule;
    return mid ? module(mid) : null;
  }

  build(props) {
    var listStyle = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif"
        },

        textStyle = {
          borderLeft: {width: 1, color: Color.gray},
          borderRight: {width: 1, color: Color.gray},
          borderBottom: {width: 1, color: Color.gray},
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
          extent: pt(26,24),
        };

    this.submorphs = [
      {type: Tree, name: "classTree", treeData: new ClassTreeData(null),
       borderBottom: {width: 1, color: Color.gray}},

      {name: "classAndMethodControls",
       layout: new HorizontalLayout({direction: "centered", spacing: 2}), submorphs: [
         {...btnStyle, name: "addMethodButton", label: Icon.makeLabel("plus"), tooltip: "add a new method"},
         {...btnStyle, name: "removeMethodButton", label: Icon.makeLabel("minus"), tooltip: "remove selected method"}]},

      {name: "sourceEditor", ...textStyle},

      {name: "sourceEditorControls",
       borderLeft: {width: 1, color: Color.gray},
       borderRight: {width: 1, color: Color.gray},
       layout: new HorizontalLayout({direction: "centered", spacing: 2}), submorphs: [
          {...btnStyle, name: "saveButton", fontSize: 18, label: Icon.makeLabel("save"), tooltip: "save"},
          {...btnStyle, name: "playButton", fontSize: 18, label: Icon.makeLabel("play-circle-o"), tooltip: "execute selected method"}]},

      new ImportController({name: "importController"})
    ];

    var l = this.layout = new GridLayout({
      grid: [
        ["classTree", "sourceEditor", "importController"],
        ["classAndMethodControls", "sourceEditorControls", "importController"],
      ]});
    l.col(0).fixed = 180;
    l.col(2).fixed = 180;
    l.row(1).fixed = 30;
    // var oe = ObjectEditor.open({target: this})

    // l.col(2).fixed = 100; l.row(0).paddingTop = 1; l.row(0).paddingBottom = 1;

    connect(this.get("classTree"), "selection", this, "onClassTreeSelection");
    connect(this.get("addMethodButton"), "fire", this, "interactivelyAddMethod");
    connect(this.get("removeMethodButton"), "fire", this, "interactivelyRemoveMethod");

    connect(this.get("addImportButton"), "fire", this, "interactivelyAddImport");
    connect(this.get("removeImportButton"), "fire", this, "interactivelyRemoveImport");

    connect(this.get("saveButton"), "fire", this, "execCommand", {converter: () => "save source"});
    connect(this.get("cleanupButton"), "fire", this, "execCommand", {converter: () => "[javascript] removed unused imports"});
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

    var isClick = !!this.env.eventDispatcher.eventState.clickedOnMorph;
    this.selectMethod(parentNode.target, node.target, isClick);
  }

  sourceDescriptorFor(klass) {
    return RuntimeSourceDescriptor.for(klass);
  }

  async selectClass(klass) {
    var tree = this.get("classTree");
    if (!tree.selection || tree.selection.target !== klass) {
      var node = tree.nodes.find(ea => !ea.isRoot && ea.target === klass);
      tree.selection = node;
    }

    var ed = this.get("sourceEditor"),
        descr = this.sourceDescriptorFor(klass),
        source = await descr.source,
        system = await this.systemInterface(),
        format = (await system.moduleFormat(descr.module.id)) || "esm",
        [_, ext] = descr.module.id.match(/\.([^\.]+)$/) || [];

    ed.textString = source;

    Object.assign(this.editorPlugin.evalEnvironment, {
      targetModule: descr.module.id,
      context: this.target,
      format
    });

    this.state.selectedMethod = null;
    this.state.selectedClass = klass;

    this.get("importController").module = descr.module;

    await this.updateKnownGlobals();
  }

  async selectMethod(klass, methodSpec, highlight = true, putCursorInBody = false) {
    if (klass && !methodSpec && isClass(klass.owner)) {
      methodSpec = klass;
      klass = klass.owner
    }

    if (this.state.selectedClass !== klass)
      await this.selectClass(klass);

    var tree = this.get("classTree");
    tree.uncollapse(tree.selection);
    if (tree.selection.target !== methodSpec) {
      var node = tree.nodes.find(ea => ea.target.owner === klass && ea.target.name === methodSpec.name);
      tree.selection = node;
    }

    var ed = this.get("sourceEditor"),
        descr = RuntimeSourceDescriptor.for(klass),
        parsed = await descr.ast,
        methods = Path("body.body").get(parsed),
        method = methods.find(({key: {name}}) => name === methodSpec.name);

    this.state.selectedMethod = methodSpec;

    if (!method) {
      this.setStatusMessage(`Cannot find method ${methodSpec.name}`);
      return;
    }

    var cursorPos = ed.indexToPosition(putCursorInBody ?
      method.value.body.start+1 : method.key.start)
    ed.cursorPosition = cursorPos;

    if (highlight) {
      var methodRange = {
        start: ed.indexToPosition(method.start),
        end: ed.indexToPosition(method.end)
      }
      ed.flash(methodRange, {id: 'method', time: 1000, fill: Color.rgb(200,235,255)});
      ed.alignRowAtTop(undefined, pt(0, -20))
    }
  }

  async updateKnownGlobals() {
    var declaredNames = [], klass = this.state.selectedClass;
    if (klass) {
      var descr = this.sourceDescriptorFor(klass);
      ({declaredNames} = await descr.declaredAndUndeclaredNames);
    }
    Object.assign(this.editorPlugin.evalEnvironment, {
      knownGlobals: declaredNames,
    });
    this.editorPlugin.highlight();
  }

  async interactivelyAddMethod() {
    try {
      // let input = await this.world().prompt("Enter method name",
      //                   {historyId: "object-editor-method-name-hist"});
      // if (!input) return;
      var input = "newMethod";
      let {methodName} = await addScript(this.target, "function() {}", input);
      await this.refresh();
      await this.selectMethod(this.target.constructor, {name: methodName}, true, true);
      this.focus();
    } catch (e) {
      this.showError(e);
    }
  }

  async interactivelyRemoveMethod() {
    this.setStatusMessage("Not yet implemented")
  }

  async interactivelyAddImport() {
    try {
      var {selectedClass, selectedMethod} = this.state;
      if (!selectedClass) {
        this.showError(new Error("No class selected"));
        return;
      }

      var system = await this.editorPlugin.systemInterface(),
          choices = await interactivelyChooseImports(system);
      if (!choices) return null;

      // FIXME move this into system interface!
      var m = this.selectedModule;
      var origSource = await m.source();
      await m.addImports(choices);

    } catch (e) {
      origSource && await m.changeSource(origSource);
      this.showError(e);
    }
    finally {
      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    }

  }

  async interactivelyRemoveImport() {
    try {
      var sels = this.get("importsList").selections;
      if (!sels || !sels.length) return;
      var really = await this.world().confirm(
        "Really remove imports \n" + arr.pluck(sels, "local").join("\n") + "?")
      if (!really) return;
      var m = this.selectedModule;
      var origSource = await m.source()
      await m.removeImports(sels);
      this.get("importsList").selection = null;
    }
    catch (e) {
      origSource && await m.changeSource(origSource);
      this.showError(e);
    }
    finally {
      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    }
  }

  async interactivelyRemoveUnusedImports() {

    try {
      var m = this.selectedModule;
      var origSource = await m.source();
      var toRemove = await chooseUnusedImports(await m.source());

      if (!toRemove) {
        this.setStatusMessage("Canceled");
        return;
      }

      if (!toRemove.changes || !toRemove.changes.length) {
        this.setStatusMessage("Nothing to remove");
        return;
      }

      await m.removeImports(toRemove.removedImports);
      this.setStatusMessage("Imports removed");
    } catch (e) {
      origSource && await m.changeSource(origSource);
      this.showError(e);
    }
    finally {
      await this.get("importController").updateImports();
      await this.updateKnownGlobals();
      this.get("sourceEditor").focus();
    }
  }

  async refresh() {
    var {selectedClass, selectedMethod} = this.state,
        tree = this.get("classTree");

    await tree.maintainViewStateWhile(async () => {
      this.target = this.target;
    }, node => node.target ?
                  node.target.name
                    + node.target.kind
                    + (node.target.owner ? "." + node.target.owner.name : "") :
                  node.name);

    if (selectedClass && selectedMethod && !tree.selection) {
      // method rename, old selectedMethod does no longer exist
      await this.selectClass(selectedClass);
    }
  }


  async doSave() {
    var {selectedClass, selectedMethod} = this.state;

    if (!selectedClass) throw new Error("No class selected");

    var editor = this.get("sourceEditor"),
        descr = RuntimeSourceDescriptor.for(selectedClass);

var store = JSON.parse(localStorage["oe helper"] || '{"saves": []}')
store.saves.push(editor.textString);
if (store.saves.length > 300) store.saves = store.saves.slice(-300)
localStorage["oe helper"] = JSON.stringify(store);

    await descr.changeSource(editor.textString)

    await editor.saveExcursion(async () => {
      await this.refresh();
      // if (selectedMethod) await this.selectMethod(selectedClass, selectedMethod, false);
      // else await this.selectClass(selectedClass);
    });


  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  focus() { this.get("sourceEditor").focus(); }

  get keybindings() {
    return [
      {keys: "F1", command: "focus class tree"},
      {keys: "F2", command: "focus code editor"},
      {keys: {mac: "Command-S", win: "Ctrl-S"}, command: "save source"},
      {keys: {mac: "Command-Shift-=", win: "Ctrl-Shift-="}, command: "add method"},
      {keys: {mac: "Command-Shift--", win: "Ctrl-Shift--"}, command: "remove method"},
      {keys: "Alt-J", command: "jump to definition"},
      {keys: "Ctrl-C I", command: "[javascript] inject import"},
    ].concat(super.keybindings);
  }

  get commands() {
    return [

      {
        name: "focus class tree",
        exec: ed => { var m = ed.get("classTree"); m.show(); m.focus(); return true; }
      },

      {
        name: "focus code editor",
        exec: ed => { var m = ed.get("sourceEditor"); m.show(); m.focus(); return true; }
      },

      {
        name: "[javascript] inject import",
        exec: async ed => { await ed.interactivelyAddImport(); return true; }
      },

      {
        name: "[javascript] removed unused imports",
        exec: async ed => { await ed.interactivelyRemoveUnusedImports(); return true; }
      },

      {
        name: "add method",
        exec: async ed => { await ed.interactivelyAddMethod(); return true; }
      },

      {
        name: "remove method",
        exec: async ed => { await ed.interactivelyRemoveMethod(); return true; }
      },

      {
        name: "jump to definition",
        exec: async ed => {

          var tree = ed.getSubmorphNamed("classTree"),
              td = tree.treeData,
              classNodes = td.getChildren(td.root).slice(),
              items = lively.lang.arr.flatmap(classNodes.reverse(), node => {
                var klass = node.target,
                    methods = td.getChildren(node);

                return [{
                  isListItem: true,
                  string: klass.name,
                  value: {node, selector: "selectClass"}
                }].concat(
                  methods.map(ea => {
                    return {
                      isListItem: true,
                      label: [
                        [`${klass.name} `, {fontSize: 10}],
                        [`${ea.name}`]
                      ],
                      value: {node: ea, selector: "selectMethod"}
                    };
                  })
                );
              });

          var {selected: [choice]} = await ed.world().filterableListPrompt("select class or method", items);

          if (choice) {
            await ed[choice.selector](choice.node.target);
            ed.getSubmorphNamed("sourceEditor").focus();
            tree.scrollSelectionIntoView();
          }
          return true;
        }
      },

      {
        name: "save source",
        exec: async ed => {
          try {
            await ed.doSave();
            ed.setStatusMessage("saved", Color.green);
          } catch (e) { ed.showError(e); }
          return true;
        }
      }
    ];
  }

}


// new ImportController().openInWorld()
class ImportController extends Morph {

  constructor(props) {
    super({
      extent: pt(300,600),
      ...props
    });
    this.build();
    connect(this, "module", this, "updateImports");
  }

  build() {

    var listStyle = {
          // borderWidth: 1, borderColor: Color.gray,
          fontSize: 14, fontFamily: "Helvetica Neue, Arial, sans-serif",
          type: "list"
        },

        btnStyle = {
          type: "button",
          fontSize: 10,
          activeStyle: {
            fill: Color.white,
            border: {color: Color.lightGray, style: "solid", radius: 5},
            nativeCursor: "pointer"
          },
          extent: pt(26,24),
        };

    this.submorphs = [
      {...listStyle, name: "importsList", multiSelect: true, borderBottom: {width: 1, color: Color.gray}},
      {name: "buttons", layout: new HorizontalLayout({direction: "centered", spacing: 2}),
        submorphs: [
        {...btnStyle, name: "addImportButton", label: Icon.makeLabel("plus"), tooltip: "add new import"},
        {...btnStyle, name: "removeImportButton", label: Icon.makeLabel("minus"), tooltip: "remove selected import(s)"},
        {...btnStyle, name: "cleanupButton", label: "cleanup", tooltip: "remove unused imports"}
      ]},
    ]

    this.layout = new GridLayout({
      grid: [
        ["importsList"],
        ["buttons"]
      ]});
    this.layout.row(1).fixed = 30;
  }

  async updateImports() {
    if (!this.module) return;
    var m = lively.modules.module(this.module),
        imports = await m.imports(),
        items = imports.map(ea => {
          var label = [];
          var alias = ea.local !== ea.imported && ea.imported !== "default" ? ea.local : null;
          if (alias) label.push([`${ea.imported} as `, {}])
          label.push([alias || ea.local, {fontWeight: "bold"}])
          label.push([` from ${ea.fromModule}`]);
          return {isListItem: true, value: ea, label}
        });

    this.get("importsList").items = items;
  }

  get module() { return this.getProperty("module"); }
  set module(moduleOrId) {
    var id = !moduleOrId ? null : typeof moduleOrId === "string" ? moduleOrId : moduleOrId.id;
    this.setProperty("module", id);
  }

  save() {
    // import { serializeMorph } from "lively.morphic/serialization.js";
    window.snapshot = serializeMorph(this).snapshot;
  }


}