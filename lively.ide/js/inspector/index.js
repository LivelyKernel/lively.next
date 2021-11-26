import { ViewModel, part } from 'lively.morphic/components/core.js';
import { InspectionTree, PropertyTree, isMultiValue, RemoteInspectionTree, printValue } from './context.js';
import { arr, num, promise, obj, Path } from 'lively.lang';
import { pt, rect, Color } from 'lively.graphics';
import { config, HorizontalLayout, Label, VerticalLayout, Morph, morph, Icon } from 'lively.morphic';
import { connect, noUpdate, disconnect, once } from 'lively.bindings';
import { LoadingIndicator, DropDownList } from 'lively.components';
import DarkTheme from '../../themes/dark.js';
import DefaultTheme from '../../themes/default.js';
import { SearchField, DropDownSelector, LabeledCheckBox } from 'lively.components/widgets.js';
import { InteractiveMorphSelector, MorphHighlighter } from 'lively.halos';
import { popovers, valueWidgets } from 'lively.ide';
import { onNumberDragStart, generateReferenceExpression, onNumberDragEnd, onNumberDrag } from './helpers.js';
import { InstructionWidget } from './ui.cp.js';

const inspectorCommands = [

  {
    name: 'focus codeEditor',
    exec: inspector => {
      inspector.get('codeEditor').show();
      inspector.get('codeEditor').focus();
      return true;
    }
  },

  {
    name: 'focus propertyTree',
    exec: inspector => {
      inspector.get('propertyTree').show();
      inspector.get('propertyTree').focus();
      return true;
    }
  }

];

class DraggedProp extends Morph {
  static get properties () {
    return {
      control: {},
      sourceObject: {},
      borderColor: { defaultValue: Color.rgb(169, 204, 227) },
      fill: { defaultValue: Color.rgb(235, 245, 251).withA(0.8) },
      borderWidth: { defaultValue: 2 },
      borderRadius: { defaultValue: 4 },
      submorphs: {
        after: ['control'],
        initialize () {
          const { control } = this;
          if (!control) return this.submorphs = [];
          this.height = 22;
          this.submorphs = [control];
          control.top = 0;
          control.fontSize = 14;
          if (typeof control.relayout === 'function') { control.relayout(); }
          this.width = control.width + 20;
          this.adjustOrigin(pt(10, 10));
        }
      }
    };
  }

  applyToTarget (evt) {
    const { currentTarget: target, control } = this;
    this.remove();
    MorphHighlighter.removeHighlighters(evt.world);
    if (!target) return;

    if (!target.isText || target.editorModeName !== 'js') {
      // normal apply prop
      if ('propertyValue' in control) { target[control.keyString] = control.propertyValue; }
      return;
    }

    // rk 2017-10-01 FIXME this is a hack to get droppable code in...
    // this needs to go somewhere else and needs a better UI, at least
    const editor = target;
    const toObject = editor.evalEnvironment.context;
    const textPos = editor.textPositionFromPoint(editor.localize(evt.position));
    let expr = generateReferenceExpression(this.sourceObject, { fromMorph: toObject });
    if (control.keyString) expr += '.' + control.keyString;
    editor.insertTextAndSelect(expr, textPos);
    editor.focus();
  }

  update (evt) {
    const handPosition = evt.hand.globalPosition;
    let target = this.morphBeneath(handPosition); let hiddenMorph;
    if (!target) return;
    if (target == this.morphHighlighter) {
      target = target.morphBeneath(handPosition);
    }
    while (hiddenMorph = [target, ...target.ownerChain()].find(m => !m.visible)) {
      target = hiddenMorph = target.morphBeneath(handPosition);
    }
    if (target != this.currentTarget) {
      this.currentTarget = target;
      if (this.morphHighlighter) this.morphHighlighter.deactivate();
      if (target.isWorld) return;
      this.morphHighlighter = MorphHighlighter.for($world, target);
      this.morphHighlighter.show();
    }
    this.position = handPosition;
  }
}

class DraggableTreeLabel extends Label {
  static get properties () {
    return {
      styleClasses: { defaultValue: ['TreeLabel'] },
      draggable: { defaultValue: true },
      nativeCursor: { defaultValue: '-webkit-grab' },
      keyString: {},
      valueString: {},
      fontFamily: { defaultValue: config.codeEditor.defaultStyle.fontFamily },
      fill: { defaultValue: Color.transparent },
      padding: { defaultValue: rect(0, 1, 10, -1) },
      isSelected: {
        after: ['submorphs'],
        set (b) {
          this.setProperty('isSelected', b);
          if (b) {
            this.removeStyleClass('deselected');
            this.addStyleClass('selected');
          } else {
            this.addStyleClass('deselected');
            this.removeStyleClass('selected');
          }
          if (this.control) this.control.isSelected = b;
        }
      }
    };
  }

  get inspector () { return this.owner.owner; }

  onDragStart (evt) {
    this.draggedProp = new DraggedProp({
      sourceObject: this.inspector.targetObject,
      control: this.copy()
    });
    this.draggedProp.openInWorld();
    connect(evt.hand, 'update', this.draggedProp, 'update');
  }

  onDrag (evt) {}

  onDragEnd (evt) {
    disconnect(evt.hand, 'update', this.draggedProp, 'update');
    this.draggedProp.applyToTarget(evt);
  }
}

export class PropertyControl extends DraggableTreeLabel {
  static get properties () {
    return {
      root: {},
      keyString: {},
      valueString: {},
      propertyValue: {},
      control: {
        after: ['submorphs'],
        derived: true,
        get () { return this.submorphs[0] || false; },
        set (c) { this.submorphs = [c]; }
      },
      submorphs: {
        initialize () {
          this.value = this.keyString + ':';
          this.submorphs = [];
          connect(this, 'extent', this, 'relayout');
        }
      }
    };
  }

  static inferType ({ keyString, value }) {
    if (value && (value.isColor || value.isGradient)) {
      return 'Color';
    } else if (value && value.isPoint) {
      return 'Point';
    } else if (obj.isBoolean(value)) {
      return 'Boolean';
    } else if (obj.isNumber(value)) {
      return 'Number';
    } else if (obj.isString(value)) {
      return 'String';
    } else if (value && value.isRectangle) {
      return 'Rectangle';
    }
    return false;
  }

  static render (args) {
    let propertyControl;

    if (!args.spec.type) {
      args.spec = {
        ...args.spec,
        isFloat: !Number.isInteger(args.value),
        type: this.inferType(args)
      };
    } // non mutating

    switch (args.spec.type) {
      // 12.6.17
      // rms: not sure wether a string based spec is that effective in the long run
      //      it may require too much dedicated maintenance
      case 'Color':
        propertyControl = this.renderColorControl(args); break;
      case 'ColorGradient':
        propertyControl = this.renderColorControl({ ...args, gradientEnabled: true }); break;
      case 'Number':
        propertyControl = this.renderNumberControl(args); break;
      case 'String':
        propertyControl = this.renderStringControl(args); break;
      case 'RichText':
        propertyControl = this.renderStringControl(args); break;
      case 'Layout':
        propertyControl = this.renderLayoutControl(args); break;
      case 'Enum':
        propertyControl = this.renderEnumControl(args); break;
      case 'Shadow':
        propertyControl = this.renderShadowControl(args); break;
      case 'Point':
        propertyControl = this.renderPointControl(args); break;
      case 'Rectangle':
        propertyControl = this.renderRectangleControl(args); break;
      case 'Boolean':
        propertyControl = this.renderBooleanControl(args); break;
      default:
        propertyControl = this.renderItSomehow(args);
    }

    if (propertyControl.control) {
      connect(propertyControl.control, 'openWidget', propertyControl, 'openWidget');
      propertyControl.toggleFoldableValue(args.value);
      return propertyControl;
    }

    return propertyControl;
  }

  menuItems () {
    return this._targetMenuItems || [];
  }

  renderValueSelector (propertyControl, selectedValue, values) {
    propertyControl.control = new DropDownSelector({
      opacity: 0.8,
      fill: Color.white.withA(0.5),
      name: 'valueString',
      styleClasses: ['TreeLabel'],
      selectedValue,
      padding: 0,
      values
    });
    connect(propertyControl.control, 'update', propertyControl, 'propertyValue', {
      updater: function ($upd, val) {
        if (this.targetObj.propertyValue != val) $upd(val);
      }
    });
    connect(propertyControl, 'update', propertyControl.control, 'selectedValue', {
      updater: function ($upd, val) {
        val = (val && val.valueOf) ? val.valueOf() : val;
        if (this.targetObj.propertyValue != val) $upd(val);
      }
    });
    return propertyControl;
  }

  static baseControl ({ keyString, valueString, value, spec }) {
    const propertyControl = new this({
      keyString,
      valueString,
      isSelected: false,
      propertyValue: value
    });
    if (spec.foldable) {
      propertyControl.asFoldable(spec.foldable);
    }
    return propertyControl;
  }

  toggleMultiValuePlaceholder (active) {
    this.multiValuePlaceholder = this.multiValuePlaceholder || this.addMorph({
      fill: Color.transparent,
      layout: new HorizontalLayout({ spacing: 3 }),
      name: 'multi value placeholder',
      nativeCursor: 'pointer',
      submorphs: arr.range(0, 2).map(i => ({
        type: 'ellipse',
        fill: Color.gray.withA(0.5),
        reactsToPointer: false,
        extent: pt(7, 7)
      }))
    });
    if (active) {
      connect(this.multiValuePlaceholder, 'onMouseDown', this, 'propertyValue', {
        converter: function () { return this.targetObj.propertyValue.valueOf(); }
      });
      this.control.opacity = 0;
      this.multiValuePlaceholder.visible = true;
    } else {
      disconnect(this.multiValuePlaceholder, 'onMouseDown', this, 'propertyValue');
      this.control.opacity = 1;
      this.multiValuePlaceholder.visible = false;
    }
  }

  toggleFoldableValue (newValue) {
    if (!this.foldableProperties) return;
    this.toggleMultiValuePlaceholder(isMultiValue(newValue, this.foldableProperties));
  }

  asFoldable (foldableProperties) {
    this.foldableProperties = foldableProperties;
    connect(this, 'update', this, 'toggleFoldableValue');
  }

  static renderGrabbableKey (args) {
    const { keyString, target } = args;
    return [
      `${keyString}:`, {
        nativeCursor: '-webkit-grab',
        onDragStart: (evt) => {
          evt.state.draggedProp = new DraggedProp({
            sourceObject: target,
            control: this.baseControl(args)
          });
          evt.state.draggedProp.openInWorld();
          connect(evt.hand, 'update', evt.state.draggedProp, 'update');
        },

        onDrag: (evt) => {},

        onDragEnd: (evt) => {
          disconnect(evt.hand, 'update', evt.state.draggedProp, 'update');
          evt.state.draggedProp.applyToTarget(evt);
        }
      }
    ];
  }

  static renderEnumControl (args) {
    let propertyControl;
    const { value, spec: { values }, valueString, keyString, target, node, tree } = args;
    const handler = async (evt, charPos) => {
      const menu = target.world().openWorldMenu(evt, values.map(v => ({
        string: v.toString(),
        action: () => {
          target[keyString] = v;
          node.rerender();
        }
      })));
    };
    return [
      ...this.renderGrabbableKey(args),
      ` ${value ? (value.valueOf ? value.valueOf() : value) : 'Not set'}`, {
        nativeCursor: 'pointer', onMouseDown: handler
      },
      ...Icon.textAttribute('angle-down', {
        paddingTop: '4px', paddingLeft: '4px', opacity: 0.7, onMouseDown: handler
      })
    ];
  }

  static renderStringControl (args) {
    let propertyControl;
    const { value, fastRender, keyString, valueString, node } = args;
    return [
      ...this.renderGrabbableKey(args),
      ` ${value.length > 200 ? value.slice(0, 20) + '...' : value}`, { fontColor: Color.blue, paddingTop: '0px' }
    ];
  }

  static renderRectangleControl (args) {
    let propertyControl;
    const { value, keyString, valueString, target, node } = args;
    const handler = async (evt) => {
      const editor = new popovers.RectanglePopover({
        hasFixedPosition: true,
        rectangle: value
      });
      editor.relayout();
      await editor.fadeIntoWorld(evt.positionIn(target.world()));
      connect(editor, 'rectangle', (rect) => {
        target[keyString] = rect;
        node.rerender();
      });
    };
    return [
      ...this.renderGrabbableKey(args),
      ` ${valueString}`, { fontColor: Color.black, nativeCursor: 'pointer', onMouseDown: handler }
    ];
  }

  static renderBooleanControl (args) {
    const { value, keyString, valueString, target, node } = args;
    return [
      ...this.renderGrabbableKey(args),
      ` ${valueString}`, {
        nativeCursor: 'pointer',
        fontColor: value ? Color.green : Color.red,
        onMouseDown: (evt) => {
          target[keyString] = !target[keyString]; // toggle boolean
          node.rerender();
        }
      }];
  }

  static renderNumberControl (args) {
    let propertyControl; const { value, spec, keyString, valueString, fastRender, node, target, tree } = args;
    const { _numberControls = new NumberControls() } = node;

    const [up, down] = _numberControls.submorphs;
    _numberControls.fontColor = tree.fontColor;
    const scrubState = node._numberControls = _numberControls;

    if ('max' in spec && 'min' in spec &&
        spec.min != -Infinity && spec.max != Infinity) {
      scrubState.baseFactor = (spec.max - spec.min) / 100;
      scrubState.floatingPoint = spec.isFloat;
      scrubState.max = spec.max;
      scrubState.min = spec.min;
    } else {
      scrubState.floatingPoint = spec.isFloat;
      scrubState.baseFactor = 0.5;

      scrubState.min = spec.min != undefined ? spec.min : -Infinity;
      scrubState.max = spec.max != undefined ? spec.max : Infinity;
    }

    const numberColor = valueWidgets.NumberWidget.properties.fontColor.defaultValue;
    return [
      ...this.renderGrabbableKey(args),
      ...node._inputMorph ? [node._inputMorph, {}] : [
        ` ${value != undefined && (value.valueOf ? value.valueOf() : value).toFixed(spec.isFloat ? Math.max(4, num.precision(value)) : 0)} `,

        {
          fontColor: numberColor,
          onMouseUp: (evt) => {
            node._inputMorph = morph({
              type: 'input',
              fill: null,
              fontColor: numberColor,
              fontFamily: 'IBM Plex Mono',
              fontSize: 14,
              padding: rect(8, 2, -6, 2),
              height: 23, // get line height?
              cursorColor: Color.white,
              value: value.valueOf ? value.valueOf() : valueString
            });
            target[keyString] = value; // trigger update. is there a better way?
            node._inputMorph.focus();
            once(node._inputMorph, 'inputAccepted', (v) => {
              delete node._inputMorph;
              target[keyString] = spec.isFloat ? Number.parseFloat(v) : Number.parseInt(v);
              node.rerender();
            });
            once(node._inputMorph, 'onBlur', (v) => {
              if (node._inputMorph) {
                delete node._inputMorph;
                target[keyString] = value;
                node.rerender();
              }
            });
            node.rerender();
          },
          onDragStart: (evt) => {
            scrubState.scrubbedValue = value;
            onNumberDragStart(evt, scrubState);
          },
          onDrag: (evt) => {
            target[keyString] = onNumberDrag(evt, scrubState);
            node.rerender();
          },
          onDragEnd: (evt) => onNumberDragEnd(evt, scrubState)
        }, _numberControls, {
          onMouseUp: () => {
            up.fill = down.fill = null;
          },
          onMouseDown: (evt) => {
            if (evt.targetMorph === up) {
              up.fill = Color.white.withA(0.2);
              if ('max' in spec && target[keyString] >= spec.max) return;
              target[keyString] += 1;
            }
            if (evt.targetMorph === down) {
              down.fill = Color.white.withA(0.2);
              if ('min' in spec && target[keyString] <= spec.min) return;
              target[keyString] -= 1;
            }
            node.rerender();
          }
        }]

    ];
  }

  static renderShadowControl (args) {
    const { keyString, valueString, value, target, node } = args;
    const handler = async (evt) => {
      // if already open, return
      const editor = new popovers.ShadowPopover({
        shadowValue: target[keyString],
        hasFixedPosition: true
      });
      await editor.fadeIntoWorld(evt.positionIn(target.world()));
      connect(editor, 'shadowValue', (pointValue) => {
        target[keyString] = pointValue;
        node.rerender();
      });
    };
    return [
      ...this.renderGrabbableKey(args),
       `${value ? value.toFilterCss() : 'No Shadow'}`, { nativeCursor: 'pointer', onMouseDown: handler }
    ];
  }

  static renderPointControl (args) {
    let propertyControl; const { keyString, valueString, value, fontColor, target, node } = args;
    const numberColor = valueWidgets.NumberWidget.properties.fontColor.defaultValue;
    const handler = async (evt) => {
      // if already open, return
      const editor = new popovers.PointPopover({
        pointValue: target[keyString],
        hasFixedPosition: true
      });
      await editor.fadeIntoWorld(evt.positionIn(target.world()));
      connect(editor, 'pointValue', (pointValue) => {
        target[keyString] = pointValue;
        node.rerender();
      });
    };
    const attrs = { nativeCursor: 'pointer', onMouseDown: handler };
    return [...this.renderGrabbableKey(args),
      ' pt(', { ...attrs },
            `${value.x.toFixed()}`, { fontColor: numberColor, ...attrs },
            ',', { ...attrs },
            `${value.y.toFixed()}`, { fontColor: numberColor, ...attrs },
            ')', { ...attrs }];
  }

  static renderLayoutControl (args) {
    let propertyControl; const { target, fastRender, valueString, keyString, value } = args;
    return [
      ...this.renderGrabbableKey(args),
      ` ${value ? valueString : 'No Layout'}`, {
        onMouseDown: (evt) => {

        }
      }];
  }

  static renderColorControl (args) {
    let propertyControl; const {
      node, gradientEnabled, fastRender,
      valueString, keyString, value, target
    } = args;
    const handler = async (evt) => {
      const editor = new popovers.FillPopover({
        hasFixedPosition: true,
        handleMorph: target,
        fillValue: value,
        title: 'Fill Control',
        gradientEnabled
      });
      await editor.fadeIntoWorld(evt.positionIn(target.world()));
      connect(editor, 'fillValue', (fill) => {
        target[keyString] = fill;
        node.rerender();
      });
    };
    return [
      ...this.renderGrabbableKey(args),
      morph({
        fill: value.valueOf ? value.valueOf() : value,
        extent: pt(15, 15),
        borderColor: Color.gray,
        borderWidth: 1
      }), {
        paddingLeft: '5px',
        paddingTop: '4px',
        paddingRight: '5px'
      },
     `${value ? (value.valueOf ? value.valueOf() : valueString) : 'No Color'}`, {
       nativeCursor: 'pointer', onMouseDown: handler
     }];
  }

  static renderItSomehow (args) {
    let propertyControl; const { fastRender, keyString, valueString, value } = args;
    return [
      ...this.renderGrabbableKey(args),
      ` ${valueString}`, {}
    ];
  }

  relayout () {
    this.fit();
    if (this.control) {
      this.control.topLeft = this.textBounds().topRight().addXY(-2, 1);
      this.width = this.textBounds().width + this.control.bounds().width;
    }

    this.height = 18;

    if (this.multiValuePlaceholder) {
      this.multiValuePlaceholder.leftCenter = this.textBounds().rightCenter();
    }
  }

  toString () {
    return `${this.keyString}: ${this.valueString}`;
  }

  highlight () {
    if (this.highlighter) this.highlighter.remove();
    const hl = this.highlighter = this.addMorph(({ type: 'label', name: 'valueString', value: this.keyString }));
    hl.isLayoutable = false;
    hl.fontWeight = 'bold', hl.fontColor = Color.orange;
    hl.reactsToPointer = false;
    hl.fadeOut(2000);
  }
}

class NumberControls extends Morph {
  static get properties () {
    return {
      layout: {
        initialize () {
          this.layout = new VerticalLayout({ spacing: 0, orderByIndex: true });
        }
      },
      fill: { defaultValue: Color.transparent },
      width: { defaultValue: 15 },
      fontColor: {
        derived: true,
        set (c) {
          this.submorphs.map(m => m.fontColor = c);
        }
      },
      submorphs: {
        initialize () {
          this.submorphs = [
            Icon.makeLabel('sort-up', {
              autofit: true,
              opacity: 0.6,
              nativeCursor: 'pointer',
              padding: rect(5, 2, 0, -6),
              fontSize: 12
            }),
            Icon.makeLabel('sort-up', {
              top: 10,
              rotation: Math.PI,
              autofit: true,
              padding: rect(5, 4, 0, -9),
              opacity: 0.6,
              nativeCursor: 'pointer',
              fontSize: 12
            })
          ];
        }
      }
    };
  }
}

// static openInWindow (props) {
//   if (System._testsRunning) return console.log(props.targetObject);
//   const i = new this(props);
//   const window = i.openInWindow();
//   window.doNotAcceptDropsForThisAndSubmorphs();
//   return i;
// }

export class Inspector extends ViewModel {
  static get properties () {
    return {

      _serializableTarget: { defaultValue: null },

      remoteTarget: {
        set (obj) {
          this.setProperty('remoteTarget', obj);
          if (!this.ui.propertyTree) return;
          this.originalTreeData = null;
          this.prepareForNewTargetObject(obj, true);
        }
      },

      targetObject: {
        set (obj) {
          this._serializableTarget = (obj && obj.isMorph) ? obj.id : obj;
          this.setProperty('targetObject', obj);
          if (!this.ui.propertyTree) return;
          this.originalTreeData = null;
          this.prepareForNewTargetObject(obj);
        }
      },

      selectedContext: {
        readOnly: true,
        derived: true,
        get () {
          const { selectedNode, treeData } = this.ui.propertyTree;
          return treeData.getContextFor(selectedNode || treeData.root);
        }
      },

      originalTreeData: {
        // for filtering
        serialize: false
      },

      updateInProgress: {
        // for preventing update loops
        defaultValue: false, serialize: false
      },

      expose: {
        get () {
          return ['isInspector', 'onWindowClose', 'commands', 'keybindings'];
        }
      },

      isInspector: {
        get () { return true; }
      },

      keybindings: {
        get () {
          return [
            { keys: 'Alt-Up', command: 'focus propertyTree' },
            { keys: 'Alt-Down', command: 'focus codeEditor' },
            { keys: 'F1', command: 'focus propertyTree' },
            { keys: 'F2', command: 'focus codeEditor' }
          ];
        }
      },

      commands: {
        get () { return inspectorCommands; }
      },

      bindings: {
        get () {
          return [
            { target: 'target picker', signal: 'onMouseUp', handler: 'selectTarget', override: false },
            { target: 'property tree', signal: 'onScroll', handler: 'repositionOpenWidget', override: false },
            { target: 'resizer', signal: 'onDrag', handler: 'adjustProportions', override: false },
            { target: 'terminal toggler', signal: 'onMouseDown', handler: 'toggleCodeEditor', override: false },
            { model: 'unknowns', signal: 'trigger', handler: 'filterProperties', override: false },
            { model: 'internals', signal: 'trigger', handler: 'filterProperties', override: false },
            { model: 'search field', signal: 'searchInput', handler: 'filterProperties', override: false },
            { model: 'property tree', signal: 'nodeCollapseChanged', handler: 'filterProperties', override: false },
            // { model: 'this binding selector', signal: 'selection', handler: 'bindCodeEditorThis', override: false },
            { model: 'fix import button', signal: 'fire', handler: 'fixUndeclaredVariables', override: false },
            { signal: 'extent', handler: 'onViewResized', override: false }
          ];
        }
      }
    };
  }

  attach (view) {
    super.attach(view);

    // init the selector, populate models
    const self = this;
    const { codeEditor, thisBindingSelector, propertyTree } = this.ui;
    const rightArrow = Icon.textAttribute('long-arrow-alt-right', {
      textStyleClasses: ['fas'], paddingTop: '2px'
    });
    thisBindingSelector.items = [{
      isListItem: true,
      value: 'target',
      label: ['this ', null, ...rightArrow, ' target', null]
    },
    {
      isListItem: true,
      value: 'selection',
      label: ['this ', null, ...rightArrow, ' selection', null]
    }];

    codeEditor.changeEditorMode('js').then(() =>
      codeEditor.evalEnvironment = {
        targetModule: 'lively://lively.morphic/inspector',
        get context () {
          return thisBindingSelector.selection == 'selection'
            ? self.selectedContext
            : self.targetObject;
        },
        get systemInterface () {
          return Path('treeData.systemInterface').get(propertyTree);
        },
        format: 'esm'
      }
    ).catch(err => $world.logError(err));
  }

  // __after_deserialize__ (snapshot, ref, pool) {
  //   const t = this._serializableTarget;
  //   const tree = new PropertyTree({
  //     name: 'propertyTree',
  //     ...this.treeStyle,
  //     treeData: InspectionTree.forObject(null, this)
  //   });
  //
  //   this.addMorph(tree, this.ui.terminalToggler);
  //
  //   super.__after_deserialize__(snapshot, ref, pool);
  //
  //   !this.isComponent && this.master.whenApplied().then(
  //     () => {
  //       this.layout.col(0).row(1).group.morph = tree;
  //       // if (this.targetObject.isMorph &&
  //       //     this.targetObject.world() == this.world()) {
  //       //   this.targetObject = this.targetObject;
  //       // } else {
  //       //   tree.value = ['Please select a target!', {
  //       //     textAlign: 'center',
  //       //     fontStyle: 'italic'
  //       //   }];
  //       // }
  //       if (this.targetObject) { this.targetObject = this.targetObject; }
  //     }
  //   );
  // }

  // __additionally_serialize__ (snapshot, ref, pool, addFn) {
  //   // remove tree
  //   const submorphs = snapshot.props.submorphs.value;
  //   for (let i = submorphs.length; i--;) {
  //     const { id } = submorphs[i];
  //     if (pool.refForId(id).realObj == this.ui.propertyTree) arr.removeAt(submorphs, i);
  //   }
  // }

  fixUndeclaredVariables () {
    this.ui.codeEditor.execCommand(
      '[javascript] fix undeclared variables',
      { autoApplyIfSingleChoice: true });
  }

  renderDraggableTreeLabel (args) {
    return new DraggableTreeLabel(args);
  }

  renderPropertyControl (args) {
    return PropertyControl.render(args);
  }

  onWindowClose () {
    this.view.stopStepping();
    this.ui.propertyTree.treeData.dispose();
    this.openWidget && this.closeOpenWidget();
  }

  refreshSelectedLine () {
    // instead of completely re-rendering the whole tree, identify the node at the selected line and replace it
    const row = this.ui.propertyTree.selectedIndex - 1;
    const selectedNode = this.ui.propertyTree.selectedNode;
    this.ui.propertyTree.selectedNode.refreshProperty();
    const newLine = this.ui
      .propertyTree.document.getLine(row)
      .textAndAttributes.slice(0, 4)
      .concat(selectedNode.display(this));
    const lineRange = this.ui.propertyTree.lineRange(row, false);
    this.ui.propertyTree.replace(lineRange, newLine, false, false, false);
    this.ui.propertyTree.selectedNode = this.ui.propertyTree.selectedNode;
  }

  refreshAllProperties () {
    if (!this.world()) this.stopStepping();
    if (!this.targetObject || !this.targetObject.isMorph) {
      this.stopStepping();
      return;
    }
    if (this.targetObject._styleSheetProps != this.lastStyleSheetProps) {
      this.refreshTreeView();
      this.lastStyleSheetProps = this.targetObject._styleSheetProps;
      return;
    }
    const change = arr.last(this.targetObject.env.changeManager.changesFor(this.targetObject));
    if (change == this.lastChange && this.lastSubmorphs == printValue(this.targetObject && this.targetObject.submorphs)) { return; }
    if (this.focusedNode && this.focusedNode.keyString == change.prop) {
      this.repositionOpenWidget();
    }
    this.lastChange = change;
    this.lastSubmorphs = printValue(this.targetObject && this.targetObject.submorphs);
    this.refreshTreeView();
  }

  refreshTreeView () {
    let v;
    this.originalTreeData && this.originalTreeData.asListWithIndexAndDepth(false).forEach(({ node }) => {
      if (!node.target) return;
      if (node.foldableNode) {
        v = node.target[node.foldableNode.key][node.key];
      } else {
        v = node.target[node.key];
      }
      if (!obj.equals(v, node.value) && node.refreshProperty) {
        node.refreshProperty(v);
      }
    });
    this.ui.propertyTree.update(true);
    // block drops even if target,... changes
    this.ui.propertyTree.doNotAcceptDropsForThisAndSubmorphs();
  }

  async prepareForNewTargetObject (target, remote = false) {
    if (this.isUpdating()) await this.whenUpdated();

    const { promise: p, resolve } = promise.deferred(); const animated = !!this.target;
    this.updateInProgress = p;
    try {
      let li;
      if (remote) li = LoadingIndicator.open('connecting to remote...');
      const td = remote
        ? await RemoteInspectionTree.forObject(target, this)
        : InspectionTree.forObject(target, this);
      const tree = this.ui.propertyTree;
      const prevTd = tree.treeData;
      await td.collapse(td.root, false);
      if (td.root.children) await td.collapse(td.root.children[0], false);
      const changedNodes = this.originalTreeData && this.originalTreeData.diff(td);
      if (changedNodes) {
        for (const [curr, upd] of changedNodes) { curr.refreshProperty(upd.value); }
      } else {
        tree.treeData = td;
        await this.filterProperties();
        if (tree.treeData.root.isCollapsed) {
          await tree.onNodeCollapseChanged({ node: td.root, isCollapsed: false });
          tree.selectedIndex = 1;
        }
        await tree.execCommand('uncollapse selected node');
      }
      this.toggleWindowStyle(animated);
      if (li) li.remove();
    } catch (e) { this.view.showError(e); }

    this.view.startStepping(1000, 'refreshAllProperties');
    this.updateInProgress = null;
  }

  async toggleWindowStyle (animated = true) {
    const duration = 300; let theme; let styleClasses;
    const { codeEditor } = this.ui;
    const editorPlugin = codeEditor.pluginFind(p => p.runEval);
    const window = this.view.getWindow();
    if ((await editorPlugin.runEval("System.get('@system-env').node")).value) {
      styleClasses = [...arr.without(window.styleClasses, 'local'), 'node'];
      theme = DarkTheme.instance;
    } else {
      styleClasses = ['local', ...window ? arr.without(window.styleClasses, 'node') : []];
      theme = DefaultTheme.instance;
    }
    editorPlugin.theme = theme;
    if (animated) {
      window && window.animate({ duration, styleClasses });
      codeEditor.animate({
        fill: theme.background, duration
      });
    } else {
      if (window) window.styleClasses = styleClasses;
    }
    // what?
    codeEditor.textString = codeEditor.textString;
    editorPlugin.highlight();
  }

  isUpdating () { return !!this.updateInProgress; }

  whenUpdated () { return this.updateInProgress || Promise.resolve(); }

  focus () {
    this.ui.codeEditor.focus();
  }

  async selectTarget () {
    let newTarget;
    if (this.view.env.eventDispatcher.isKeyPressed('Shift')) {
      [newTarget] = await $world.execCommand('select morph', { justReturn: true });
    } else {
      this.toggleSelectionInstructions(true);
      newTarget = await InteractiveMorphSelector.selectMorph();
      this.toggleSelectionInstructions(false);
    }
    if (newTarget) this.targetObject = newTarget;
  }

  // part(InstructionWidget, { opacity: 0.5 }).openInWorld()

  toggleSelectionInstructions (active) {
    if (active && !this.instructionWidget) {
      this.instructionWidget = this.view.addMorph(part(InstructionWidget, {
        isLayoutable: false,
        opacity: 0,
        clipMode: 'hidden',
        center: this.view.extent.scaleBy(0.5)
      }));
      this.instructionWidget.animate({ opacity: 1, duration: 200 });
    } else {
      this.instructionWidget.fadeOut(200);
      this.instructionWidget = null;
    }
  }

  closeOpenWidget () {
    this.openWidget.close();
  }

  onWidgetOpened ({ widget }) {
    if (this.openWidget) {
      this.openWidget.fadeOut();
    }
    this.focusedNode = this.ui.propertyTree.selectedNode;
    widget.epiMorph = true;
    this.openWidget = widget;
    once(widget, 'close', this, 'closeOpenWidget');
    once(this.ui.propertyTree, 'onMouseDown', this, 'closeOpenWidget');
  }

  getWidgetPosition () {
    const { propertyTree } = this.ui;
    const { height, x, y } = propertyTree.textLayout.boundsFor(propertyTree, { column: 0, row: propertyTree.selectedIndex - 1 });
    let pos = propertyTree.worldPoint(pt(x, y + height / 2)).addPt(propertyTree.scroll.negated());
    const treeBounds = propertyTree.globalBounds();
    pos.x = this.globalBounds().center().x;
    if (pos.y < treeBounds.top()) {
      pos = treeBounds.topCenter();
    } else if (treeBounds.bottom() - 20 < pos.y) {
      pos = treeBounds.bottomCenter().addXY(0, -20);
    }
    return pos;
  }

  repositionOpenWidget () {
    if (this.openWidget && this.focusedNode) {
      this.openWidget.topCenter = this.getWidgetPosition();
    }
  }

  adjustProportions (evt) {
    const { layout } = this.view;
    layout.row(1).height += evt.state.dragDelta.y;
    this.relayout();
  }

  isEditorVisible () { return this.ui.codeEditor.height > 10; }

  makeEditorVisible (show) {
    if (show === this.isEditorVisible()) return;
    const { extent: prevExtent, layout } = this.view;
    const {
      ui: {
        terminalToggler, codeEditor,
        thisBindingSelector, fixImportButton
      }
    } = this;
    const duration = 200;
    layout.disable();
    if (show) {
      terminalToggler.fontColor = Color.rgbHex('00e0ff');
      layout.row(3).height = this.codeEditorHeight || 180;
      layout.row(2).height = 5;
      fixImportButton.animate({ visible: true, duration });
      thisBindingSelector.animate({ visible: true, duration });
    } else {
      this.codeEditorHeight = layout.row(3).height;
      terminalToggler.fontColor = Color.white;
      layout.row(3).height = layout.row(2).height = 0;
      fixImportButton.animate({ visible: false, duration });
      thisBindingSelector.animate({ visible: false, duration });
    }
    this.view.extent = prevExtent;
    layout.enable({ duration });
    this.relayout({ duration });
    codeEditor.focus();
    codeEditor.animate({
      opacity: show ? 1 : 0, duration
    });
  }

  async toggleCodeEditor () {
    this.makeEditorVisible(!this.isEditorVisible());
  }

  async filterProperties () {
    console.log('filter props');
    const searchField = this.ui.searchField;
    const tree = this.ui.propertyTree;
    if (!this.originalTreeData) { this.originalTreeData = tree.treeData; }
    disconnect(tree.treeData, 'onWidgetOpened', this, 'onWidgetOpened');
    await tree.treeData.filter({
      maxDepth: 2,
      showUnknown: this.ui.unknowns.checked,
      showInternal: this.ui.internals.checked,
      iterator: (node) => searchField.matches(node.key)
    });
    tree.update();
    connect(tree.treeData, 'onWidgetOpened', this, 'onWidgetOpened');
  }

  onViewResized (newExt) {
    // if extent changed
    if (!this._lastExtent || !this._lastExtent.equals(newExt)) { this.relayout(); }
    if (this.world()) this._lastExtent = newExt;
  }

  relayout (animated = {}) {
    const {
      ui: {
        fixImportButton,
        terminalToggler: toggler,
        propertyTree: tree,
        thisBindingSelector,
        codeEditor
      }, view: { layout }
    } = this;
    layout && layout.forceLayout(); // removes "sluggish" button alignment
    const togglerBottomLeft = tree.bounds().insetBy(5).bottomLeft();
    const importBottomRight = tree.bounds().insetBy(5).bottomRight();
    const bindingBottomRight = importBottomRight.subXY(fixImportButton.width + 10, 0);

    toggler.visible = !!this.world();

    if (animated.duration) {
      toggler.animate({ bottomLeft: togglerBottomLeft, ...animated });
      fixImportButton.animate({ bottomRight: importBottomRight, ...animated });
      thisBindingSelector.animate({ bottomRight: bindingBottomRight, ...animated });
    } else {
      toggler.bottomLeft = togglerBottomLeft;
      fixImportButton.bottomRight = importBottomRight;
      thisBindingSelector.bottomRight = bindingBottomRight;
    }
  }
}
