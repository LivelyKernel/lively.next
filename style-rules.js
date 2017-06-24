/* globals Power4 */
import { arr, tree, obj } from "lively.lang";
import { Sizzle, SizzleExpression } from "./sizzle.js";
import { ShadowObject, CustomLayout, Button, Text, Icon, HorizontalLayout, morph, Morph, config} from "./index.js";
import { Color, pt, rect } from "lively.graphics";
import { connect, once, signal, disconnect } from "lively.bindings";
import { TreeData, Tree } from "./components/tree.js";
import { PropertyControl } from "./ide/js/inspector.js";
import { safeToString, isObject } from "lively.lang/object.js";
import { LinearGradient } from "lively.graphics/color.js";
import { CompletionController } from "./text/completion.js";

// TOOLING

function validRule(rule) {
    let expr = new SizzleExpression(rule, $world);
    return !expr.compileError
}

class StylePropCompleter {

  constructor(propertiesAndSettings) {
    this.propertiesAndSettings = propertiesAndSettings
  }

  compute(_, prefix) {
    let stylePropNames = [];
    for (let p in this.propertiesAndSettings) {
      let spec = this.propertiesAndSettings[p];
      if (spec.isStyleProp && !(spec.derived && !spec.foldable)) stylePropNames.push(p);
    }
    // todo: fuzzy match these props
    return stylePropNames.filter(p => p.includes(prefix)).map((completion, priority) => {
      return {completion, priority};
    });
  }

}

class StyleRuleDraft extends Morph {
  static get properties() {
    return {
      fill: {defaultValue: Color.transparent},
      styleSheet: {},
      submorphs: {
        initialize() {
          var ruleInput, cancelButton;
          this.layout = new HorizontalLayout({spacing: 2});
          this.submorphs = [
            ruleInput = morph({
              name: "ruleInput",
              type: "text",
              styleClasses: ["empty"],
              textString: "Sizzle Expression"
            }),
            cancelButton = Icon.makeLabel('close',{
              styleClasses: ['empty'],
              fontColor: Color.rgbHex("5499c7"),
              fontSize: 14, padding: 2,
              nativeCursor: 'pointer'
            })
          ];
          connect(cancelButton, 'onMouseDown', this, 'cancel');
          connect(ruleInput, "onMouseDown", this, "startRuleInput");
          connect(ruleInput, "onKeyDown", this, "onRuleInput");
          connect(ruleInput, "onBlur", this, "submitRule");
        }
      }
    };
  }
  
  compileRule() {
    let ruleInput = this.getSubmorphNamed('ruleInput');
    ruleInput.textString = ruleInput.textString.replace(/\r?\n|\r/g, '');
    if (!validRule(ruleInput.textString)) {
      this.toggleError(true);
    } else {
      this.toggleError(false);
      signal(this, "addRule", {
        styleSheet: this.styleSheet,
        rule: ruleInput.textString,
      });
    }
    this.removeStyleClass('hover');
  }

  toggleError(error) {
    let input = this.get('ruleInput');
    if (error) {
      input.styleClasses = ['error'];
    } else {
      input.styleClasses = ['default'];
    }
  }

  startRuleInput() {
    let input = this.get('ruleInput');
    input.textString = '';
    input.styleClasses = ['default'];
  }

  onRuleInput(evt) {
    let rule = this.get('ruleInput').textString;
    if (evt.key == 'Enter') {
      this.get('ruleInput').textString = rule.replace(/\r?\n|\r/g, '');
      this.focus();
    }
  }

  submitRule() {
    let input = this.get('ruleInput');
    // if rule free of error, request the rule to be
    // fully inserted into the style sheet
    if (!input.textString) {
      input.styleClasses = ['empty'];
      input.textString = 'Sizzle Expression';
    } else {
      this.compileRule();
    }
  }
}

class PropertyDraft extends Morph {

  static get properties() {
    return {
      styleSheet: {},
      rule: {},
      styleClasses: {defaultValue: ["createProp"]},
      globalPropertySettings: {},
      layout: {
        initialize() {
          this.layout = new HorizontalLayout();
        }
      },
      submorphs: {
        initialize() {
          this.submorphs = [
            {
              type: "text",
              name: "key input",
              styleClasses: ['empty'],
              textString: "name",
            },
            {type: "label", value: ":", name: 'colon'},
            {
              type: "text",
              name: "value input",
              readOnly: true,
              nativeCursor: 'forbidden',
              styleClasses: ['empty'],
              textString: "value"
            }
          ];
          connect(this.get("key input"), "onKeyUp", this, "onPropNameInput");
          connect(this.get("key input"), "onBlur", this, "stopPropNameInput");
          connect(this.get("key input"), "onMouseDown", this, "startPropNameInput");
          connect(this.get('value input'), "onFocus", this, 'startEnteringValue');
          connect(this.get('value input'), "onkeyDown", this, 'enterValue');
          connect(this.get("value input"), "onBlur", this, "submitValue");
        }
      }
    };
  }

  startEnterValue() {
    this.get('value input').textString = '';
  }

  enterValue(evt) {
    if (evt.key == 'Enter') {
      this.focus();
    }
  }

  startPropNameInput() {
    this.completion = null;
    this.toggleUnknownPropertyIndicator(false);
    this.get('key input').textString = ''
  }

  toggleUnknownPropertyIndicator(unknown) {
    if (unknown) {
      this.get("key input").addStyleClass("error");
      if (!this.getSubmorphNamed("error")) {
        this.addMorph(
          Icon.makeLabel("warning", {name: "error", fontColor: Color.red}),
          this.getSubmorphNamed("colon")
        );
      }
    } else {
      this.get("key input").removeStyleClass("error");
      this.getSubmorphNamed("error") && this.getSubmorphNamed("error").remove();
    }
  }

  async onPropNameInput(evt) {
    // if enter or tab is pressed, enter check
    // prop name for validity and move over to value
    // field
    if (evt.key == 'Enter') this.focus();
    if (this.get('key input').textString) {
      this.get('key input').removeStyleClass('empty');
    } else {
      this.get('key input').addStyleClass('empty');
    }
    if (!this.completion) {
      this.completionOpen = true;
      this.completion = new CompletionController(this.get("key input"), [
        new StylePropCompleter(this.globalPropertySettings)
      ]);
      let menu = await this.completion.openCompletionList();
      menu.moveBy(pt(-2,-2));
      connect(menu.inputMorph, 'onBlur', this, 'completionClosed');
    }
  }

  completionClosed() {
    this.completionOpen = false;
  }

  isValidProperty(key) {
    return key in this.globalPropertySettings;
  }

  async stopPropNameInput() {
    if (this.completionOpen) return;
    let propName = this.get('key input').textString;
    if (propName) {
      this.toggleUnknownPropertyIndicator(!this.isValidProperty(propName))
      this.get('key input').fit();
    } else if (!this.get('key input').isFocused()) {
      this.get('key input').addStyleClass('empty');
      this.get('key input').textString = 'name';
    }

    if (this.isValidProperty(propName)) {
      let spec = this.globalPropertySettings[propName];
      if (spec.defaultValue == undefined) {
        this.get('value input').readOnly = false;
        this.get('value input').nativeCursor = 'auto';
        this.get('value input').focus();
      } else {
        this.submit(propName, spec.defaultValue, spec);
      }
    }
  }

  async submitValue() {
    if (!this.isValidProperty(this.get('key input').textString)) return;
    let valueInput = this.get("value input"),
        {isError, value} = await lively.vm.runEval(valueInput.textString, {
          targetModule: window.origin + "/style-rules.js"
        });
    if (isError) {
      valueInput.addStyleClasses("error");
    } else {
      valueInput.removeStyleClass("error");
      this.submit(this.get('key input').textString, value);
    }
  }

  submit(prop, value, spec) {
    signal(this, "addProperty", {
      styleSheet: this.styleSheet,
      rule: this.rule,
      prop,
      value,
      spec
    });
    this.reset();
  }
  reset() {
    this.get('key input').textString = 'name';
    this.get('key input').styleClasses = ['empty'];
    this.get('value input').textString = 'value';
    this.get('value input').styleClasses = ['empty'];
  }

}

class DroppableStyleSheet extends Morph {
  static get properties() {
    return {
      initPos: {},
      value: {},
      toolContext: {},
      styleClasses: {defaultValue: ['StyleSheetControl']},
      opacity: {defaultValue: 0.7},
      dropTargetHighlighter: {
        defaultValue: new Morph({
          fill: Color.orange.withA(.3),
          borderColor: Color.orange,
          borderWidth: 2})
      },
      submorphs: {
        initialize() {
          this.submorphs = [
            {
              type: "label",
              padding: rect(5, 0, 0, 0),
              reactsToPointer: false,
              value: this.value.name || Object.keys(this.value.rules)[0]
            }
          ];
        }
      }
    };
  }

  isValidDropTarget(morph) {
    return (
      morph != this.toolContext &&
      !morph.ownerChain().includes(this.toolContext) &&
      morph != this.dropTargetHighlighter
    );
  }

  update(evt) {
    this.possibleTarget = evt.hand.findDropTarget(evt.hand.position, (m) => this.isValidDropTarget(m));
    if (this.dropTargetHighlighter.owner != $world) this.dropTargetHighlighter.openInWorld();
    if (this.possibleTarget.isWorld) {
       this.dropTargetHighlighter.remove();
    } else {
       this.dropTargetHighlighter.setBounds(this.possibleTarget.globalBounds());
    }
  }

  onBeingDroppedOn(hand, _) {
    disconnect(hand, "update", this, "update");
    if (this.possibleTarget) {
       this.remove();
       $world.logError(this.possibleTarget.name);
       this.possibleTarget.styleSheets = [...this.possibleTarget.styleSheets || [], this.value.copy()]
    } else {
       this.openInWorld(this.globalPosition);
       this.animate({
          opacity: 0, position: this.initPos,
          duration: 300, easing: Power4.easeOut
       });
       this.remove();
    }
    this.dropTargetHighlighter.remove();
  }
}

class StyleSheetControl extends Morph {

  static get properties() {
    return {
      value: {},
      key: {},
      styledMorph: {},
      isDraft: {defaultValue: false},
      submorphs: {
        after: ['isDraft'],
        initialize() {
          this.build();
        }
      }
    }
  }

  build() {
    if (this.isDraft) {
      this.styleClasses = ["draft"];
    } else {
      this.styleClasses = ["final"];
    }
    this.submorphs = [
      {
        type: "text",
        name: 'name',
        ...this.isDraft ? {readOnly: false} : {reactsToPointer: false},
        fontColor: Color.rgbHex("5499c7"),
        styleClasses: this.isDraft ? ['empty'] : [],
        value: this.key || "[Empty Sheet]"
      },
      ...this.isDraft ? [] : [Icon.makeLabel("pencil", {
        styleClasses: ["Control"],
        fontColor: Color.rgbHex("5499c7"),
        tooltip: "Rename Style Sheet",
        name: "rename"
      }),
      Icon.makeLabel("close", {
        styleClasses: ["Control"],
        fontColor: Color.rgbHex("5499c7"),
        tooltip: "Remove Style Sheet",
        name: "close"
      })]
    ];
    if (!this.isDraft) {
      connect(this.get("close"), "onMouseDown", this, "removeStyleSheet");
      connect(this.get("rename"), "onMouseDown", this, "renameStyleSheet");
    } else {
      connect(this.get('name'), 'onFocus', this, 'startNameInput');
      connect(this.get('name'), 'onKeyDown', this, 'onNameInput');
      connect(this.get('name'), 'onBlur', this, 'submit');
    }
  }

  onNameInput(evt) {
    if (evt.key == 'Enter') {
      this.focus();
    }
  }

  startNameInput() {
    this.get('name').textString = '';
    this.get('name').styleClasses = [];
  }

  submit() {
    let name = this.get("name").textString.replace(/\r?\n|\r/g, '')
    signal(this, "addStyleSheet", {
      styleSheet: new StyleSheet(name, {}),
      styledMorph: this.styledMorph
    });
  }

  renameStyleSheet() {
    let nameInput = this.get('name');
    nameInput.reactsToPointer = true;
    this.renameButton = this.get('rename');
    this.renameButton.replaceWith(Icon.makeLabel("check", {
        styleClasses: ["Control"],
        fontColor: Color.rgbHex("5499c7"),
        tooltip: "Save Name",
        name: "finish rename"
      }))
    if (!this.value.name) {
      nameInput.textString = 'Enter Name';
      nameInput.styleClasses = ['empty'];
      once(nameInput, 'onMouseDown', this, 'startNameInput');
    }
    connect(this.get('finish rename'), 'onMouseDown', this, 'finishRename');
  }

  finishRename() {
    this.focus();
    this.value.name = this.get('name').textString;
    this.get('name').reactsToPointer = false;
    this.get('finish rename').replaceWith(this.renameButton);
  }

  removeStyleSheet() {
    signal(this, 'removeStyleSheet', this);
  }

  onDragStart(evt) {
    this.grabHandle(evt);
  }

  grabHandle(evt) {
    var droppable;
    evt.stop();
    evt.hand.grab(droppable = new DroppableStyleSheet({
      toolContext: this.getWindow(),
      initPos: this.globalPosition,
      value: this.value, styleSheets: StyleSheetEditor.styleSheet}));
    connect(evt.hand, 'update', droppable, 'update');
  }

}

class StyleRuleControl extends Morph {
  static get properties() {
    return {
       key: {},
       styleSheet: {},
       styleClasses: {
        defaultValue: ['default']
       },
       submorphs: {
         after: ['key', 'value'],
        initialize() {
          var ruleInput;
          this.layout = new HorizontalLayout({spacing: 2});
          this.submorphs = [
            ruleInput = morph({name: "rule", type: "text", textString: this.key}),
            {
              name: "rule toggler",
              type: "checkbox",
              scale: 0.9,
              checked: !this.styleSheet.rules[this.key]._deactivated
            }
          ];
          connect(this.getSubmorphNamed("rule toggler"), "trigger", this, "toggleRule");
          connect(ruleInput, 'onFocus', this, 'editRule');
          connect(ruleInput, 'onKeyDown', this, 'onRuleEdit');
          connect(ruleInput, 'onBlur', this, 'compileRule');
        }
       }
    }
  }

  onRuleEdit(evt) {
    if (evt.key == 'Enter') {
      this.focus();
    }
  }

  editRule() {
    this.addStyleClass('hover');
    this.toggleError(false);
  }

  toggleError(active) {
    if (active) {
      this.addStyleClass("error");
      if (!this.getSubmorphNamed("error")) {
        this.addMorph(
          Icon.makeLabel("warning", {name: "error", fontColor: Color.red}),
          this.getSubmorphNamed("rule toggler")
        );
      }
    } else {
      this.removeStyleClass("error");
      this.getSubmorphNamed("error") && this.getSubmorphNamed("error").remove();
    }
  }

  compileRule() {
    let ruleInput = this.getSubmorphNamed('rule');
    ruleInput.textString = ruleInput.textString.replace(/\r?\n|\r/g, '');
    if (!validRule(ruleInput.textString)) {
      this.toggleError(true);
    } else {
      this.toggleError(false);
      signal(this, "replaceRule", {
        styleSheet: this.styleSheet,
        rule: this.key,
        matcher: ruleInput.textString
      });
    }
    this.removeStyleClass('hover');
  }

  toggleRule() {
    this.styleSheet.toggleRule(this.key);
  }

  onHoverIn(evt) {
    this.highlighters = this.styleSheet.sizzle
      .select(this.key)
      .filter(m => ![m, ...m.ownerChain()].includes(this.getWindow()))
      .map(m => $world.addMorph(morph({bounds: m.globalBounds(), fill: Color.orange.withA(0.4)}, m.ownerChain().find(m => m.owner == $world))));
  }

  onHoverOut(evt) {
    arr.invoke(this.highlighters, 'remove');
  }

  // todo: provide smart auto completion of known styleClasses
}

class StyleSheetData extends TreeData {

  constructor(editor) {
    this.targetMorph = editor.target;
    this.editor = editor;
    super({
      type: "morph",
      isCollapsed: false,
      children: [
        ...(this.targetMorph.styleSheets || []).map(ss => this.parseStyleSheet(ss)),
        {type: "style-sheet-adder", targetMorph: this.targetMorph}
      ]
    });
  }

  get globalPropertySettings() { return this.editor.globalPropertySettings }
  
  parseStyleSheet(styleSheet) {
    return {type: 'sheet',
            isCollapsed: true,
            value: styleSheet,
            key: styleSheet.name || obj.keys(obj.dissoc(styleSheet.rules, ['_rev']))[0],
            children: this.parseRules(styleSheet)}
  }

  parseRules(styleSheet) {
    let children = [],
        rules = obj.dissoc(styleSheet.rules, ['_rev']);
    for (let rule in rules) {
      children.push({
        type: "rule",
        isCollapsed: true,
        key: rule,
        styleSheet,
        value: rule,
        children: this.parseProps(styleSheet, rule)
      });
    }
    return [...children, {type: 'rule-adder', styleSheet}];
  }

  // placeholders

  createStyleSheet() {
    let styleSheets = this.root.children;
    arr.pushAt(styleSheets, {
       type: 'new-style-sheet',
       styledMorph: this.targetMorph
    }, styleSheets.length - 1);
    signal(this, 'update');
  }

  cancelStyleSheetDraft(draft) {
    let styleSheets = this.root.children;
    arr.remove(styleSheets, draft);
    signal(this, 'update');
  }

  createRule(styleSheet) {
    let rules = this.root.children.find(n => n.value == styleSheet).children;
    arr.pushAt(rules, {
       type: 'new-rule',
       styleSheet
    }, rules.length - 1);
    signal(this, 'update');
  }

  removeRuleDraft(draft) {
    let rules = this.root.children.find(n => n.value == draft.styleSheet).children;
    arr.remove(rules, draft);
    signal(this, "update");
  }

  replaceRule({styleSheet, rule, matcher}) {

  }

  removeStyleSheet(node) {
    let styleSheets = this.root.children;
    this.targetMorph.styleSheets = arr.without(this.targetMorph.styleSheets, node.value)
    arr.remove(styleSheets, styleSheets.find((n) => n.displayedMorph == node));
    signal(this, 'update');
  }

  addStyleSheet({styleSheet, styledMorph}) {
    let styleSheets = this.root.children;
    styledMorph.styleSheets = [...styledMorph.styleSheets || [], styleSheet];
    arr.replaceAt(styleSheets, this.parseStyleSheet(styleSheet),
       arr.findIndex(styleSheets, n => n.type == 'new-style-sheet'));
    signal(this, 'update');
  }

  updateStyleSheet({styleSheet, rule, newRule}) {
    styleSheet.retarget(rule, newRule);
    signal(this, 'update');
  }

  addProperty(args) {
    let rules = this.root.children.find(n => n.value == args.styleSheet).children,
        props = rules.find(n => n.value == args.rule).children,
        node = {
          type: "property",
          styleSheet: args.styleSheet,
          rule: args.rule,
          value: args.value,
          key: args.prop,
          spec: args.spec,
          isCollapsed: !!args.spec.foldable,
        };
    if (args.prop in args.styleSheet.rules[args.rule]) return;
    node.children = args.spec.foldable ? this.getFoldedMembers(node) : [];
    arr.pushAt(props, node, -1);
    [...node.children, node].forEach(n => this.renderProperty(n));
    this.updateRule(node);
  }

  addRule(args) {
    let rules = this.root.children.find(n => n.value == args.styleSheet).children;
    arr.remove(rules, rules.find(n => n.type == 'new-rule'));
    if (args.rule in args.styleSheet.rules) {signal(this, 'update'); return;}
    arr.pushAt(
      rules,
      {
        type: "rule",
        isCollapsed: true,
        key: args.rule,
        styleSheet: args.styleSheet,
        value: args.rule,
        children: this.parseProps(args.styleSheet, args.rule)
      },
      -1
    );
    signal(this, 'update');
    this.updateRule(args);
  }

  updateRule(node) {
    let {styleSheet, rule, key: prop, foldedProperty, value, spec, 
         children, parent} = node;
    let props = styleSheet.rules[rule];
    if (foldedProperty) {
      value = {...props[foldedProperty], [prop]: value};
      styleSheet.setRule(rule, props ? {...props, [foldedProperty]: value} : {});
      // update the node for the foldedProperty display   
      parent && parent.displayedMorph && signal(parent.displayedMorph, 'update', value);     
    } else {
      styleSheet.setRule(rule, props ? {...props, [prop]: value} : {});
      signal(node.displayedMorph, "update", styleSheet.rules[rule][prop]);
      if (spec && spec.foldable) {
        // refresh all the folded member nodes
        for (let n of children) {
            signal(n.displayedMorph, "update", value.valueOf ? value.valueOf() : value);
        }
      }
    }
    signal(this, 'update');
  }

  getFoldedMembers(node) {
    let {spec, styleSheet, rule, key, value} = node,
        children = [];
    for (let m of spec.foldable) {
      children.push({type: "property", foldedProperty: key, styleSheet, 
                     spec: obj.dissoc(spec, 'foldable'),
                     value: value[m], key: m, rule, parent: node})
    }
    return children;
  }

  parseProps(styleSheet, rule) {
    let children = [], props = obj.dissoc(styleSheet.rules[rule], ['_rev']) || {};
    for (let prop in props) {
      if (prop == "_deactivated") continue;
      let spec = this.globalPropertySettings[prop] || {},
          value = spec.foldable ? {...props[prop], valueOf: () => props[prop].left} : props[prop],
          node = {
            type: "property",
            styleSheet,
            rule,
            spec,
            isCollapsed: true,
            value,
            key: prop
          };
      node.children = spec.foldable ? this.getFoldedMembers(node) : [];
      children.push(node);
    }
    return [...children, {type: "prop-adder", styleSheet, rule}];
  }

  renderProperty(node) {
    if (node.displayedMorph) return node.displayedMorph;
    var control = PropertyControl.render({
       target: node.styleSheet, value: node.value, spec: node.spec,
       valueString: node.value.toString(), keyString: node.key});
    if (control) {
      node.displayedMorph = control;
      connect(control, "propertyValue", this, "updateRule", {
        converter: v => {
          return {...node, value: v};
        },
        varMapping: {node}
      });
      connect(control, "openWidget", this, "onWidgetOpened", {
        converter: widget => ({widget, node}),
        varMapping: {node}
      });
    }
    return control ? node.displayedMorph : `${node.key}: ${safeToString(node.value)}`;
  }

  display(node) {
    var string = String(node.name);
    switch (node.type) {
      case "sheet":
        if (!node.displayedMorph) {
          node.displayedMorph = new StyleSheetControl(node);
          connect(node.displayedMorph, "removeStyleSheet", this, "removeStyleSheet");
        }
        return node.displayedMorph;
      case "rule":
        if (!node.displayedMorph) {
          let ruleControl = node.displayedMorph = new StyleRuleControl(node);
          connect(ruleControl, 'replaceRule', this, 'replaceRule');
        }
        return node.displayedMorph;
      case "new-rule":
        // isDraft
        if (!node.displayedMorph) {
          let draft = node.displayedMorph = new StyleRuleDraft(node);
          connect(draft, "cancel", this, "removeRuleDraft", {
            updater: function($upd) {
              $upd(node); 
            },
            varMapping: {node}
          });
          connect(draft, "addRule", this, "addRule");
        }
        return node.displayedMorph;
      case "property":
        return this.renderProperty(node);
      case "prop-adder":
        if (!node.displayedMorph) {
          node.globalPropertySettings = this.globalPropertySettings;
          node.displayedMorph = new PropertyDraft(node);
          connect(node.displayedMorph, "addProperty", this, "addProperty");
        }
        return node.displayedMorph;
      case "rule-adder":
        if (!node.displayedMorph) {
          node.displayedMorph = this.renderRuleAdder();
          connect(node.displayedMorph, "onMouseDown", this, "createRule", {
            converter: () => node.styleSheet,
            varMapping: {node}
          });
        }
        return node.displayedMorph;
      case "new-style-sheet":
        if (!node.displayedMorph) {
          node.displayedMorph = new StyleSheetControl({...node, isDraft: true});
          connect(node.displayedMorph, "cancel", this, "removeStyleSheetDraft");
          connect(node.displayedMorph, "addStyleSheet", this, "addStyleSheet");
        }
        return node.displayedMorph;
      case "style-sheet-adder":
        if (!node.displayedMorph) {
          node.displayedMorph = this.renderStyleSheetAdder();
          connect(node.displayedMorph, "onMouseDown", this, "createStyleSheet");
        }
        return node.displayedMorph;
    }
    return string; // default should still enable a basic editing interface
  }

  renderStyleSheetAdder() {
    return morph({
      styleClasses: ["createRule"],
      submorphs: [
        Icon.makeLabel("plus-circle", {reactsToPointer: false}),
        {
          type: "label",
          reactsToPointer: false,
          textString: "Create new Style Sheet"
        }
      ]
    });
  }

  renderRuleAdder() {
    return morph({
      styleClasses: ["createRule"],
      submorphs: [
        Icon.makeLabel("plus-circle", {reactsToPointer: false}),
        {
          type: "label",
          reactsToPointer: false,
          textString: "Add new rule"
        }
      ]
    });
  }

  isLeaf(node) { return !node.children }
  isCollapsed(node) { return node.isCollapsed; }
  collapse(node, bool) { node.isCollapsed = bool; }
  getChildren(node) {
    return this.isLeaf(node) ?
      null : this.isCollapsed(node) ?
        [] : node.children;
  }
}

function weakRef(refName) {
  return {
    [refName]: {
      set(morph) {
        this.setProperty(refName, morph.id);
      },
      get() {
        return $world.getMorphWithId(this.getProperty(refName));
      }
    }
  };
}

export class StyleSheetEditor extends Morph {

  static get styleSheet() {
    return new StyleSheet({
      ".Tree": {
        draggable: false,
        fill: Color.transparent,
        fontColor: Color.rgbHex("5499c7")
      },
      ".TreeNode": {
        fill: Color.transparent
      },
      ".TreeNode.selected": {
        fill: Color.transparent,
        fontColor: Color.black,
      },
      ".StyleSheetEditor": {
        fill: Color.transparent,
        extent: pt(200, 300)
      },
      ".StyleRuleDraft .Text": {
        fontSize: 14,
        fontFamily: config.codeEditor.defaultStyle.fontFamily
      },
      ".StyleRuleDraft .empty": {
        fill: Color.transparent,
        fontColor: Color.rgbHex("5499c7").withA(.7)
      },
      ".StyleRuleDraft .default": {
        fill: Color.transparent,
        fontColor: Color.rgbHex("5499c7")
      },
      ".StyleRuleDraft .Text.error": {
        fill: Color.transparent,
        fontColor: Color.red
      },
      ".StyleRuleControl.default [name=rule]": {
        padding: rect(0, 0, 5, 0),
        autofit: true,
        borderWidth: 1,
        fontSize: 14,
        fontFamily: config.codeEditor.defaultStyle.fontFamily,
        borderColor: Color.transparent,
        fill: Color.transparent,
        fontColor: Color.rgbHex("5499c7")
      },
      ".StyleRuleControl.draft [name=rule]": {
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: Color.rgbHex("5499c7")
      },
      ".StyleRuleControl.hover [name=rule]": {
        borderStyle: 'dashed',
        autofit: true,
        borderWidth: 1,
        borderColor: Color.rgbHex("5499c7")
      },
      ".StyleRuleControl": {
        layout: new HorizontalLayout({spacing: 2}),
        fill: Color.transparnet
      },
      ".StyleRuleControl [name=close]": {
        visible: false
      },
      "[name=error]": {
        fontSize: 11,
        padding: rect(1,1,5,0)
      },
      ".StyleRuleControl.error [name=rule]": {
        fontColor: Color.red
      },
      ".StyleRuleControl.hover [name=close]": {
        visible: true,
        fontColor: Color.rgbHex("5499c7"),
        fontSize: 14
      },
      ".Control": {
        nativeCursor: "pointer"
      },
      // property control
      ".createProp": {
        fill: Color.transparent,
        layout: new HorizontalLayout(),
        extent: pt(0, 18)
      },
      ".createProp .Text": {
        fill: Color.transparent,
                fontColor: Color.black,
        fontFamily: config.codeEditor.defaultStyle.fontFamily,
        fontSize: 14,
      },
      ".createProp .Text.empty": {
        fill: Color.transparent,
        fontColor: Color.gray.darker().withA(.8),
        fontFamily: config.codeEditor.defaultStyle.fontFamily,
        fontSize: 14
      },
      ".createProp .Label": {
        fontFamily: config.codeEditor.defaultStyle.fontFamily,
        fontColor: Color.black,
        autofit: true,
        extent: pt(10, 15),
        padding: rect(0, 0, 5, 0),
        fontSize: 14
      },
      ".createProp .Text.error": {
        fontColor: Color.red,
      },
      ".createProp [name=error]": {
        fontColor: Color.red,
        fontSize: 11,
        padding: rect(2,2,2,2)
      },
      // rule control
      ".createRule": {
        nativeCursor: "pointer",
        fill: Color.transparent,
        opacity: 0.5,
        extent: pt(0, 21),
        layout: new HorizontalLayout({spacing: 4})
      },
      // style sheet control
      ".StyleSheetControl .Label": {
        fontSize: 14,
        padding: rect(0, 0, 5, 0),
        autofit: true
      },
      ".StyleSheetControl .Text": {
        fontSize: 14,
        padding: rect(0, 0, 5, 0),
        fontColor: Color.rgbHex("5499c7"),
        fill: Color.transparent
      },
      ".StyleSheetControl.draft": {
        fill: Color.rgbHex("d4e6f1").withA(.5),
        borderStyle: 'dashed'
      },
      ".StyleSheetControl.final": {
        nativeCursor: "-webkit-grab",
        fill: Color.rgbHex("d4e6f1"),
      },
      ".StyleSheetControl": {
        layout: new HorizontalLayout({spacing: 4}),
        borderWidth: 1,
        extent: pt(0, 22),
        borderColor: Color.rgbHex("5499c7"),
        borderRadius: 4
      }
    });
  }

  static get properties() {
    return {
      ...weakRef("target"),
      styleSheets: {
        initialize() {
          this.styleSheets = StyleSheetEditor.styleSheet;
        }
      },
      styledClasses: {
        //after: ['rule'],
        initialize() {
          this.styledClasses = arr.union(
               [Morph, Text, Button],
               // new Sizzle($world).select(this.rule)
               //     .map(m => m.constructor)
            []);
        }
      },
      globalPropertySettings: {
        after: ['styledClasses'],
        initialize() {
          this.globalPropertySettings = obj.merge(
            this.styledClasses.map(klass => {
              let notStyleProps = obj
                .keys(klass.properties)
                .filter(p => !klass.properties[p].isStyleProp);
              return obj.dissoc(klass.properties, notStyleProps);
            })
          );
        }
      },
      layout: {
        initialize() {
          this.layout = new CustomLayout({
            relayout: () => this.relayout()
          })
        }
      },
      submorphs: {
        after: ['styleSheets'],
        initialize() {
          var bounds = rect(0,0,200,250),
              td = new StyleSheetData(this),
              tree;
          this.submorphs = [
            tree = new Tree({
              fontSize: 14,
              selectionColor: Color.transparent,
              selectionFontColor: Color.black,
              name: "propertyTree",
              bounds, treeData: td,
            }),
            {name: 'resizer', 
             fill: Color.transparent,
             nativeCursor: 'nwse-resize'}
          ];
          tree.keyhandlers[0].unbindKey('Right');
          tree.keyhandlers[0].unbindKey('Left');
          connect(td, 'onWidgetOpened', this, 'onWidgetOpened');
          connect(td, 'update', tree, 'update');
          connect(this.get('resizer'), 'onDrag', this, 'resizeBy', {
            converter: (evt) => evt.state.dragDelta
          })
          tree.update();
          this.height = tree.nodeItemContainer.height;
        }
      }
    }
  }

  onWidgetOpened({node, widget}) {
    if (this.openWidget) {
      this.openWidget.fadeOut();
    }
    this.focusedNode = node;
    this.openWidget = widget;
    once(this, "onMouseDown", this, "closeOpenWidget");
    connect(this, 'openInWorld', widget, 'openInWorld', {
      converter: () => widget.globalPosition, varMapping: {widget}
    });
  }

   closeOpenWidget() {
     this.openWidget && this.openWidget.close();
   }

  relayout() {
    let tree = this.get('propertyTree'),
        treeItemBounds = tree.nodeItemContainer.bounds();
    if (treeItemBounds.height > this.height && this.height < 300) {
      this.height = Math.min(treeItemBounds.height, 300);
    }
    this.width = tree.width = treeItemBounds.width + 10;
    tree.height = this.height;
    this.get('resizer').bottomRight = this.extent;
  }

  open() {
    let win = this.openInWindow({title: this.target.name + `'s Style Sheets`});
    win.styleSheets = new StyleSheet({
      ".Window": {
        fill: new LinearGradient({
          stops: [
            {offset: 0, color: Color.lightGray.lighter()},
            {offset: 1, color: new Color.rgb(236, 240, 241)}
          ]
        })
      }
    })
  }
}

// THE MODEL

export class StyleSheet {

  constructor(name, rules) {
    if (obj.isObject(name) && !rules) {
      rules = name;
      name = null;
    }
    this.rules = rules;
    for (let rule in rules) rules[rule] = this.unwrapFoldedProps(rules[rule]);
    this.name = name;
  }

  copy() {
    let copiedRules = {};
    for (let rule in this.rules) {
       copiedRules[rule] = {...this.rules[rule]};
    }
    return new StyleSheet(this.name, copiedRules)
  }

  get __only_serialize__() {
    return ['rules', 'context'];
  }

  set context(morph) {
    this._context = morph;
    this.sizzle = new Sizzle(morph);
    this.context.withAllSubmorphsDo(m => {
       m._styleSheetProps = null;
       m.makeDirty();
    });
  }

  get context() { return this._context }

  unwrapFoldedProps(props) {
    ["borderRadius", "borderWidth", "borderColor", "borderStyle"].forEach(p => {
      if (p in props) {
        let v = props[p];
        props[p] = arr.intersect(obj.keys(v), ["top", "left", "bottom", "right"]).length == 4
          ? v
          : {
              top: v,
              bottom: v,
              right: v,
              left: v,
              valueOf: () => v
            };
      }
    });
    return props;
  }
  refreshMorphsFor(rule) {
    for (let morph of this.sizzle.select(rule)) {
       morph._styleSheetProps = null;
       morph._transform = null;
       morph.makeDirty();
    }
  }

  removeRule(rule) {
    delete this.rules[rule];
    this.refreshMorphsFor(rule);
  }

  setRule(rule, props) {
    this.rules[rule] = this.unwrapFoldedProps(props);
    this.refreshMorphsFor(rule);
  }

  toggleRule(rule) {
    this.rules[rule]._deactivated = !this.rules[rule]._deactivated;
    this.refreshMorphsFor(rule);
  }

  getStyleProps(morph) {
    var props = {}, rule;
    for (rule in this.rules) {
      if (this.rules[rule]._deactivated) continue;
      if (this.sizzle.matches(rule, morph)) {
        props = obj.dissoc({...props, ...this.rules[rule]}, ['_deactivated']);
      }
    }
    if ("layout" in props) {
      let layout = props.layout.copy();
      layout.container = morph;
      props.layout = layout;
    }
    if ("dropShadow" in props) {
      props.dropShadow = new ShadowObject(props.dropShadow);
      props.dropShadow.morph = morph;
    }
    if ("padding" in props) {
      props.padding = props.padding.isRect ?
        props.padding : rect(props.padding, props.padding);
    }
    props.layout && props.layout.scheduleApply();
    return props;
  }
}
