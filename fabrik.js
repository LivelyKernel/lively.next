import { InteractiveMorphSelector, MorphHighlighter } from "./halo/morph.js";
import { connect, signal, once } from "lively.bindings";
import { Color, rect, pt } from "lively.graphics";
import { showConnector } from "./components/markers.js";
import { show, VerticalLayout, StyleSheet, Icon, GridLayout, morph, Window } from "lively.morphic";
import { TreeData, Tree } from "./components/tree.js";
import { arr } from "lively.lang";
import { Leash, LabeledCheckBox, SearchField } from "./components/widgets.js";
import { isArray } from "lively.lang/object.js";
import { max } from "lively.lang/array.js";


// this.attributeConnections[4].getConverter()
// c.getConverter()
// let o = {}
// let c = connect(o, 'x', o, 'y', {converter: () => 33});
// printConnection(c)


export function interactivelyShowConnection(connection) {
  let {sourceObj, sourceAttrName, targetObj, targetMethodName} = connection;
  if (sourceObj.isMorph && targetObj.isMorph) {
    sourceObj.show();
    targetObj.show();
    showConnector(sourceObj, targetObj);
  } else show(String(connection));
}

export function printConnection(connection) {
  let {
        sourceObj, sourceAttrName, targetObj, targetMethodName
      } = connection,
      converter = connection.getConverter(),
      updater = connection.getUpdater();
  return printConnectionElements(
    sourceObj, sourceAttrName, targetObj, targetMethodName,
    converter, updater);
}


export function printConnectionElements(
  sourceObj, sourceAttr, targetObj, targetAttr,
  converter, updater
) {
  let source = `connect(sourceObj, '${sourceAttr}', targetObj, '${targetAttr}'`;
  if (converter || updater) source += ", {\n"
  if (converter) source += `  converter: ${converter}`
  if (converter && updater) source += ","
  if (converter) source += "\n"
  if (updater) source += `  updater: ${updater}\n`
  if (converter || updater) source += "}"
  source += ");"
  return source
}


export async function interactiveConnectGivenSource(sourceObj, sourceAttr) {
  let selected = await InteractiveMorphSelector.selectMorph(),
      bindings = selected && selected.targetDataBindings();
  if (!bindings || !bindings.length) {
    $world.setStatusMessage("connect canceled"); return; }
  
  let items = bindings.map(
    group => [group[0].group || "uncategorized",
              group.map(ea => [
                ea.name, () => interactivelyEvaluateConnection(
                                sourceObj, sourceAttr, selected, ea.name)])]);
  selected.openMenu(items);      
}

export async function interactivelyReEvaluateConnection(connection, prompt = "confirm connection", highlight) {
  let {
        sourceObj, sourceAttrName, targetObj, targetMethodName
      } = connection,
      converter = connection.getConverter(),
      updater = connection.getUpdater();
  return interactivelyEvaluateConnection(
    sourceObj, sourceAttrName, targetObj, targetMethodName,
    converter, updater, prompt, highlight)
}

export async function interactivelyEvaluateConnection(
  sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
  prompt = "confirm connection", highlight = true
) {
  let targetModule = "lively://lively.bindings-interactive-connect/x" + sourceObj.id,
      evalEnvironment = {
        context: window,
        format: "esm",
        targetModule
      },
      input = printConnectionElements(sourceObj, sourceAttr, targetObj, targetAttr, converter, updater);
  Object.assign(lively.modules.module(targetModule).recorder, {
    sourceObj, targetObj, connect, once
  })
  let source = await $world.editPrompt(prompt, {
    //requester: targetObj,
    input,
    historyId: "lively.bindings-interactive-morph-connect",
    mode: "js",
    evalEnvironment,
    animated: true
  });
  if (!source) { $world.setStatusMessage("connect canceled"); return; }
  let result = await lively.vm.runEval(source, evalEnvironment);
  if (result.isError) {
    $world.logError(result.value);
    return interactivelyEvaluateConnection(
    sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
      prompt = "confirm connection", highlight
    );
  }
  if (highlight) {
    $world.setStatusMessage("connected!", Color.green);
    interactivelyShowConnection(result.value); 
  }
}

class ConnectionNode {

  constructor(args) {
    Object.assign(this, args);
  }

  display() {
    if (this.type == 'connectedPin') {
      return this.displayConnected();
    } else {
      return this.displayVacant();
    }
  }

  clearCache() {
    this._cached = null;
  }

  displayVacant() {
    var l, p;
    l = morph({type: 'label', value: this.name, 
               submorphs: [p = this.renderVacantPin()]})
    l.fit(); 
    p.leftCenter = l.innerBounds().rightCenter().addXY(5,0); 
    return this._cached = l;
  }
  
  displayConnected() {
    var connectionPoint, connector;
    let maxAttrLen = arr.max(this.connections, c => c.targetMethodName.length).targetMethodName.length,
        [first, ...rest] = this.connections,
        longestTargetMethod = arr.max(this.connections, c => c.targetMethodName.length).targetMethodName;
    var nameLabel, longestLabel;
    this._cached = morph({
      styleClasses: ["connectionPin"],
      extent: pt(100, 20 + (this.connections.length * 15)),
      layout: new GridLayout({
        fitToCell: false,
        grid: [
          [
            nameLabel = morph({type: "label", value: this.name}),
            ...this.renderConnectedPin(first)
          ],
          ...(rest.length ? rest.map(c => [null, ...this.renderConnectedPin(c)]) : []),
          [null, null, null, this.renderVacantPin()]
        ],
        columns: [0, {paddingLeft: 5, fixed: nameLabel.textBounds().width + 15}, 
                  1, {fixed: longestTargetMethod.length * 10},
                  2, {fixed: 15},
                  3, {fixed: 20}]
      })
    });
    this._cached.layout.col(2).align = 'rightCenter';
    this._cached.layout.col(2).alignedProperty = 'rightCenter';    
    this._cached.layout.col(3).align = 'center';
    return this._cached;
  }

  renderVacantPin() {
    var connector,
        connectorPin = morph({
          type: "ellipse",
          styleClasses: ["vacantPin"],
          submorphs: [
            (connector = new Leash({
              opacity: 0,
              position: pt(3, 3),
              vertices: [pt(0, 0), pt(0, 0)],
              canConnectTo: m => arr.intersect(
                [m, ...m.ownerChain()],
                [connectorPin, ...connectorPin.ownerChain()]
              ).length < 2
            }))
          ]
        });
    connect(connector.endPoint, "onDragStart", this, "startConnecting", {
      updater: function($upd) {
        $upd(connector, connectorPin)
      },
      varMapping: {connector, connectorPin}
    });
    connect(connector.endPoint, "onDragEnd", this, "stopConnecting", {
      updater: function($upd) {
        $upd(connector, connectorPin)},
      varMapping: {connector, connectorPin}
    });
    return connectorPin;
  }
  
  renderConnectedPin(connection) {
    var connectionPoint = morph({type: "ellipse", styleClasses: ["occupiedPin"]}),
        removeButton = Icon.makeLabel('remove', {
          fontColor: Color.gray.darker(),
          nativeCursor: 'pointer'
        }),
        description = morph({
      type: "text", fill: Color.transparent, 
      readOnly: true, nativeCursor: 'pointer', padding: rect(0,1,0,0),
      textAndAttributes: [
        ...Icon.makeLabel("long-arrow-right").textAndAttributes, "  ", null,
        connection.targetMethodName, null
      ],
    })
    connect(description, 'onHoverIn', this, 'showConnection', {
      converter: () => ({connection, connectionPoint, description}),
      varMapping: {connection, connectionPoint, description}
    });
    connect(description, 'onHoverOut', this, 'hideConnection', {
      converter: () => ({connection, connectionPoint, description}), 
      varMapping: {connection, connectionPoint, description}
    });
    connect(description, 'onMouseDown', this, 'editConnection', {
      converter: () => ({connection, connectionPoint, description}), 
      varMapping: {connection, connectionPoint, description}
    });
    connect(removeButton, 'onMouseDown', this, 'removeConnection', {
      converter: () => connection,
      varMapping: {connection}
    });
    return [description, removeButton, connectionPoint];
  }

  visualizeConnection(m1, m2, existingLeash, leashStyle = {}) {
    // if m2 is not a morph, then render a data pointer (to open inspector)
    let sides = rect(0).sides.concat(rect(0).corners),
        leash = existingLeash || new Leash({
          borderColor: Color.orange,
          endpointStyle: {
            start: {fill: Color.transparent, nativeCursor: "auto"},
            end: {fill: Color.orange}
          },
          ...leashStyle
        });
    leash.startPoint.attachTo(m1, "rightCenter");
    leash.endPoint.attachTo(m2, m2.globalBounds().partNameNearest(sides, m1.globalPosition));
    return leash;
  }

  showConnection({connection, connectionPoint, description}) {
    connectionPoint.fill = Color.orange;
    description.fontColor = Color.orange;
    this.morphHighlighter = MorphHighlighter.for($world, connection.targetObj).show();
    this.connectionIndicator = this.visualizeConnection(
      connectionPoint,
      connection.targetObj,
      this.connectionIndicator
    );
  }  
  
  hideConnection({connection, connectionPoint, description}) {
    description.fontColor = Color.black;
    connectionPoint.fill = Color.gray.darker();
    if (this.connectionIndicator) this.connectionIndicator.remove();
    MorphHighlighter.removeHighlighters();
  }

  async editConnection({connection, connectionPoint, description}) {
    this.hideConnection({connection, connectionPoint, description});
    let leash = this.visualizeConnection(connectionPoint, connection.targetObj, false, {
      borderColor: Color.gray.darker(),
      endpointStyle: {
        start: {fill: Color.transparent, nativeCursor: "auto"},
        end: {fill: Color.gray.darker()}
      }
    });
    await interactivelyReEvaluateConnection(connection, 'Edit Connection', false);
    leash.remove();
  }

  removeConnection(connection) {
    connection.disconnect();
    signal(this.treeData, 'update', new ConnectionTreeData(this.target));
  }

  startConnecting(connectorLeash, connectorPin) {
    connectorLeash.startPoint.attachTo(connectorPin, 'center');
    connectorLeash.animate({opacity: .8, duration: 300});
    connectorLeash.vertices[0].position = pt(2,2);
  }

  async stopConnecting(connectorLeash, connectorPin) {
    let {startPoint, endPoint} = connectorLeash,
         sourceObj = this.target,
         sourceAttr = this.name,
         targetObj = endPoint.connectedMorph;
    if (targetObj) {
      let {
        selected: [targetAttr]
      } = await $world.filterableListPrompt(
        "Select Attribute to connect to...",
        arr.flatten(targetObj.sourceDataBindings()).map(n => n.name),
        {
          preselect: 0,
          historyId: null,
          fuzzy: true,
          actions: ["default"],
          selectedAction: "default",
          theme: "dark"
        }
      );
      targetAttr && await interactivelyEvaluateConnection(
        sourceObj,
        sourceAttr,
        targetObj,
        targetAttr,
        null,
        null,
        "Conform Connection",
        false
      );
    }    
    await connectorLeash.animate({opacity: 0, duration: 300});
    connectorLeash.startPoint.clearConnection();
    connectorLeash.endPoint.clearConnection();
    connectorLeash.remove();
    this._cached = null;
    signal(this.treeData, 'update', new ConnectionTreeData(this.target));
  }
}

class ConnectionTreeData extends TreeData {
  
  constructor(morph) {
    let connections = morph.attributeConnections || [], treeData = this;
    function unwrap([name, childrenOrPin]) {
      if (isArray(childrenOrPin)) {
        let children = childrenOrPin.map(unwrap);
        return {
          type: "category",
          name, visible: true,
          isCollapsed: !children.find(n => n.type == 'connectedPin'),
          children
        };
      }
      let connectionsWithName = connections.filter(c => c.sourceAttrName == name);
      return new ConnectionNode({
        type: !!connectionsWithName.length ? "connectedPin" : "sourceAttr",
        name, treeData, target: morph,
        visible: !!connectionsWithName.length,
        priority: connectionsWithName.length,
        connections: connectionsWithName,
        connectionPin: childrenOrPin
      });
    }
    super({
      name: "root",
      isCollapsed: false,
      visible: true,
      children: morph.connectMenuItems().map(unwrap)
    });
  }

  filter(iterator) {
    this.asListWithIndexAndDepth(false).forEach(n => n.node.visible = iterator(n));
  }

  asListWithIndexAndDepth(filter = true) {
    return super.asListWithIndexAndDepth(n => filter ? n.node.visible : true);
  }

  display(node) {
    if (node._cached) return node._cached;
    if (node.type == 'category') {
      return node._cached = node.name
    } else {
      return node.display();
    }
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

export class ConnectionInspector extends Window {

  static get properties() {
    return {
      target: {},
      extent: {defaultValue: pt(200,300)},
      targetMorph: {
        initialize() {
          this.targetMorph = this.build();
          this.setupConnections();
          this.updateStyleSheet();
        }
      },
      ui: {
        readOnly: true,
        get() {
          return {
            resizer: this.get('resizer'),
            connectionTree: this.get('connectionTree'),
            addConnectionButton: this.get('addConnection'),
            searchInput: this.get('searchInput'),
            showAllToggle: this.get('filter')
          }
        }
      }
    }
  }
  
  updateStyleSheet() {
    this.styleSheets = new StyleSheet({
      "[name=connectionlist]": {
        borderRadius: 4,
        borderWidth: 1,
        borderColor: Color.gray,
        clipMode: 'hidden'
      },
      "[name=addConnection]": {
        padding: 4,
        fontSize: 14,
        fontColor: Color.gray.darker(),
        nativeCursor: 'pointer'
      },
      "[name=resizer]": {
        fill: Color.transparent,
        nativeCursor: "nwse-resize",
      },
      '.sourceAttribute': {
        padding: 1
      },
      '[name=filter] .Label': {
        fontColor: Color.gray.darker()
      },
      '[name=connectionTree]': {
        borderRadius: {bottom: 4, left: 4, right: 4, top: 0},
        borderWidth: 1,
        borderColor: Color.gray
      },
      '.connectionPin': {
        borderRadius: 5,
        fill: Color.gray.lighter(),
        borderColor: Color.gray,
        borderWidth: 1
      },
      '.connectionPin .Label': {
         fontColor: Color.gray.darker(),
         padding: 2
      },
      '.occupiedPin': {
        fill: Color.gray.darker(),
        nativeCursor: 'pointer'
      },
      '.vacantPin': {
        draggable: false, 
        borderWidth: 1, borderColor: Color.gray.darker(),
        nativeCursor: '-webkit-grab'
      }
    });
  }

  build() {
    let width = 200,
        tree = new Tree({
            name: "connectionTree",
            extent: pt(width, 300),
            selectionColor: Color.transparent,
            selectionFontColor: Color.black,
            layout: new VerticalLayout({spacing: 2, autoResize: false}),
            treeData: this.getConnectionData()
          });
    this.whenRendered().then(() => {
      this.width = Math.max(tree.nodeItemContainer.bounds().width + 5, width);
      let l = new Leash({
        endpointStyle: {
          start: {fill: Color.black},
          end: {fill: Color.transparent}
        },
        opacity: 0
      });      
      l.startPoint.attachTo(this.target, 'center');
      l.endPoint.attachTo(this, 'topCenter');
      l.animate({opacity: .8});
      connect(this, 'close', l, 'remove');
    });
    return morph({
        name: "controls",
        reactsToPointer: false, 
        fill: Color.transparent,
        extent: pt(tree.nodeItemContainer.bounds().width, 300),
        layout: new GridLayout({
          autoAssign: false,
          grid: [
            [null, "searchInput", null],
            [null, 'filter', 'filter'],
            ["connectionTree", "connectionTree", "connectionTree"]
          ],
          columns: [0, {fixed: 5}, 2, {fixed: 5}],
          rows: [0, {fixed: 30, paddingTop: 5, paddingBottom: 5},
                 1, {fixed: 23}]
        }),
        submorphs: [
          new SearchField({
            name: "searchInput",
            width,
            placeHolder: "Filter Connection Points"
          }),
          new LabeledCheckBox({
            name: 'filter',
            fill: Color.transparent,
            label: 'Show all Attributes'
          }),
          tree
        ]
      });
  }

  setupConnections() {
    let {connectionTree, addConnectionButton, 
         showAllToggle, resizer, searchInput} = this.ui;
    connect(this, "fadeOut", this, "hideConnection");
    connect(connectionTree.treeData, "update", this, "refreshTreeView");
    connect(showAllToggle, 'checked', this, 'refreshTreeView', {converter: () => false});
    connect(searchInput, 'searchInput', this, 'searchConnections');
  }

  searchConnections() {
    this.ui.showAllToggle.active = !this.ui.searchInput.textString;
    this.refreshTreeView();
  }

  refreshTreeView(newData) {
    let {connectionTree, searchInput, showAllToggle} = this.ui,
        td = !!newData ? newData : connectionTree.treeData;
    td.uncollapseAll(() => true);
    td.filter(({depth, node}) => {
      if (node.type == 'category' || node.name == 'root') return true;
      if (!!searchInput.textString)
        return searchInput.matches(node.name) 
      return (showAllToggle.active && showAllToggle.checked) || !!node.connections.length;
    });
    connectionTree.treeData = td;
    if (newData) this.setupConnections();
    this.width = Math.max(connectionTree.nodeItemContainer.bounds().width + 5, 200);
  }
  
  getConnectionData() {
    return new ConnectionTreeData(this.target);
  }
  
}
