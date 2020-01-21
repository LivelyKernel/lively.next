import { connect, once } from "lively.bindings";
import { Color, rect, pt } from "lively.graphics";
import { arr, properties, Path, obj } from "lively.lang";
import { HorizontalLayout, Morph, VerticalLayout, StyleSheet, Icon, GridLayout, morph } from "lively.morphic";
import { TreeData, Tree } from "lively.components/tree.js";
import { Leash, LabeledCheckBox, SearchField } from "lively.components/widgets.js";
import {showConnector, show} from "lively.halos/markers.js"
import { InteractiveMorphSelector, MorphHighlighter } from "lively.halos/morph.js";
import Window from "lively.components/window.js";

export function interactivelyShowConnection(connection) {
  let {sourceObj, sourceAttrName, targetObj, targetMethodName} = connection;
  if (sourceObj.isMorph && targetObj.isMorph) {
    sourceObj.show();
    targetObj.show();
    showConnector && showConnector(sourceObj, targetObj);
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
  let source = `/* global connect, source, target */
connect(source, '${sourceAttr}', target, '${targetAttr}'`;
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
  let selected = await InteractiveMorphSelector.selectMorph();
  return selected ?
    interactiveConnectGivenSourceAndTarget(sourceObj, sourceAttr, selected) :
    null;
}

export async function interactiveConnectGivenSourceAndTarget(sourceObj, sourceAttr, targetObj, onConnect) {
  let bindings = targetObj && targetObj.targetDataBindings(),
      world = sourceObj.world();
  if (!bindings || !bindings.length) {
    world.setStatusMessage("connect canceled"); return; }

  let items = bindings.map(
    group => [group[0].group || "uncategorized",
              group.map(ea => [
                ea.signature || ea.name, () => interactivelyEvaluateConnection(
                  {sourceObj, sourceAttr, targetObj, targetAttr: ea.name, onConnect})])]);


    items.push(["custom...", async () => {
      let targetAttr = await world.prompt("Enter custom connection point", {
            requester: $world,
            historyId: "lively.morphic-custom-connection-points",
            useLastInput: true
          })
      if (targetAttr) interactivelyEvaluateConnection(
        {sourceObj, sourceAttr, targetObj, targetAttr, onConnect});
    }]);

  targetObj.openMenu(items).addStyleClass('Halo');
}

export async function interactivelyReEvaluateConnection(
  connection, prompt = "confirm connection", highlight, onConnect
) {
  let {
        sourceObj, sourceAttrName, targetObj, targetMethodName
      } = connection,
      converter = connection.getConverter(),
      updater = connection.getUpdater();
  return interactivelyEvaluateConnection({
    sourceObj, sourceAttr: sourceAttrName, targetObj, targetAttr: targetMethodName,
    converter, updater, prompt, highlight, onConnect});
}

export async function interactivelyEvaluateConnection(opts) {
  let {
    sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
    prompt, // = "confirm connection",
    highlight = true, onConnect
  } = opts;
  let targetModule = "lively://lively.bindings-interactive-connect/x" + sourceObj.id,
      evalEnvironment = {
        context: window,
        format: "esm",
        targetModule
      },
      input = printConnectionElements(sourceObj, sourceAttr, targetObj, targetAttr, converter, updater);
  if (targetObj.isMorph && sourceObj.isMorph) {
    // figure out if the properties can be coerced naively
    let { type: targetType } = targetObj.propertiesAndPropertySettings().properties[targetAttr] || {
      type: typeof targetObj[targetAttr]
    };
    let { type: sourceType } = sourceObj.propertiesAndPropertySettings().properties[sourceAttr] || {
      type: typeof sourceObj[sourceAttr]
    }
    if (sourceType !== targetType) {
      prompt = true;
    }
  }
  Object.assign(lively.modules.module(targetModule).recorder,
    {source: sourceObj, target: targetObj, connect, once, [sourceAttr]: sourceObj[sourceAttr]
  });
  let source;
  if (prompt) {
    source = await $world.editPrompt(prompt, {
      input, historyId: "lively.bindings-interactive-morph-connect", mode: "js",
      requester: $world,
      evalEnvironment,
      animated: false
    });
    if (!source) { $world.setStatusMessage("connect canceled"); return; }
  } else {
    source = input;
  }
  let result = await lively.vm.runEval(source, evalEnvironment);
  if (result.isError) {
    $world.logError(result.value);
    return interactivelyEvaluateConnection({
      sourceObj, sourceAttr, targetObj, targetAttr, converter, updater,
      prompt: "confirm connection", highlight, onConnect
    });
  }
  if (highlight) {
    $world.setStatusMessage("connected!", Color.green);
    interactivelyShowConnection(result.value);
  }
  if (typeof onConnect === "function") {
    onConnect(result);
  }
}


class ConnectionNode {

  constructor(args) {
    Object.assign(this, args);
  }

  clearCache() {
    this._cached = null;
  }

  display() {
    return this._cached || (this._cached = new ConnectionPin({
      target: this.target,
      propertyName: this.name,
      connections: this.connections
    }));
  }

}

class ConnectionPin extends Morph {

  static get properties() {
    return {
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            ".ConnectionPin.collapsed": {
              fill: Color.transparent,
              extent: pt(15, 15),
              borderRadius: 15
            },
            ".ConnectionPin.expanded": {
              fill: Color.transparent,
              borderColor: Color.transparent,
              borderRadius: 0
            },
            ".light .connectionPin": {
              borderRadius: 5,
              fill: Color.gray.lighter(),
              borderColor: Color.gray,
              borderWidth: 1
            },
            ".dark .connectionPin": {
              borderRadius: 5,
              fill: Color.black.withA(.7),
              borderColor: Color.gray,
              borderWidth: 1
            },
            ".light .connectionPin .Label": {
              fontColor: Color.gray.darker(),
              padding: 2
            },
            ".dark .connectionPin .Label": {
              fontColor: Color.white,
              padding: 2
            },
            ".dark .connectionPin .Text": {
              fontColor: Color.white,
              padding: 2
            },
            ".light .occupiedPin": {
              fill: Color.gray.darker(),
              nativeCursor: "pointer"
            },
            ".dark .occupiedPin": {
              fill: Color.white.withA(.8),
              nativeCursor: "pointer"
            },
            ".vacantPin": {
              draggable: false,
              borderWidth: 1,
              nativeCursor: "-webkit-grab"
            },
            ".light .vacantPin": {
              borderColor: Color.gray.darker(),
            },
            ".dark .vacantPin": {
              fill: Color.white.withA(.4),
              borderColor: Color.gray
            },
            ".propertyName": {
              padding: rect(7,2,2,2),
              fill: Color.gray.lighter(),
              borderRadius: 10,
              fontWeight: "bold",
              fontStyle: "italic",
              fontColor: Color.gray.darker(),
              nativeCursor: 'pointer'
            }
          });
        }
      },
      connections: {},
      nativeCursor: {defaultValue: 'pointer'},
      expanded: {defaultValue: true},
      collapsible: {defaultValue: false},
      draggable: {defaultValue: false},
      propertyName: {},
      orientation: {defaultValue: 'left'},
      styleClasses: {defaultValue: ['light']},
      target: {},
      submorphs: {
        initialize() {
          this.update();
        }
      }
    }
  }

  async update(duration = 0) {
    let world = this.world(),
        isConnected = this.connections.length > 0;
    this.connectionControl = isConnected ? 
        this.displayConnected() : this.displayVacant();

    if (this.expanded) {
      this.submorphs = [this.connectionControl];
      let styleClasses = [...arr.without(this.styleClasses, 'collapsed'), 'expanded'];
      if (duration) {
        this.connectionControl.scale = 0;
        this.connectionControl.animate({scale: 1, duration});
        this.animate({styleClasses, duration});
      } else {
        this.styleClasses = styleClasses;
      }
    } else {
      let styleClasses = [...arr.without(this.styleClasses, 'expanded'), 'collapsed'];
      if (duration) {
        this.animate({styleClasses, duration});
        await this.submorphs[0].animate({scale: 0, duration});
      } else {
        this.styleClasses = styleClasses;
      }
      var l;
      this.submorphs = [
        l = morph({
          type: 'label',
          styleClasses: ['propertyName'],
          value: this.propertyName,
          opacity: duration ? 0 : 1,
        })
      ];
      l.animate({opacity: 1, duration});
    }
  }

  displayVacant() {
    var l, p;
    l = morph({type: 'text', styleClasses: ['connectionPin'], 
               fontColor: Color.white, padding: 5, //fontSize: 14,
               textAndAttributes: [this.propertyName, {paddingRight: '20px'}],
                submorphs: [p = this.renderVacantPin()]});
    l.fit();
    p.rightCenter = l.rightCenter.addXY(-7,1);
    return this._cached = l;
  }

  renderVacantPin() {
    var connector,
        connectorPin = morph({
          type: "ellipse",
          styleClasses: ["vacantPin"],
          submorphs: [
            (connector = new Leash({
              opacity: 0,
              styleClasses: ['Halo'],
              isSmooth: true,
              epiMorph: true,
              borderColor: Color.gray.darker(),
              endpointStyle: {fill: Color.gray.darker()},
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

  displayConnected() {
    var connectionPoint, connector;
    let maxAttrLen = arr.max(this.connections, c => c.targetMethodName.length).targetMethodName.length,
        [first, ...rest] = this.connections,
        longestTargetMethod = arr.max(this.connections, c => c.targetMethodName.length).targetMethodName;
    var nameLabel, longestLabel;
    this._cached = morph({
      styleClasses: ["connectionPin"],
      extent: pt(100, 20 + (this.connections.length * 16)),
      layout: new GridLayout({
        fitToCell: false,
        grid: [
          [
            ...this.renderConnectedPin(first),
            nameLabel = morph({type: "label", fontWeight: 'bold', value: this.propertyName}),
          ],
          ...(rest.length ? rest.map(c => [...this.renderConnectedPin(c), null]) : []),
          [this.renderVacantPin(), null, null, null]
        ],
        columns: [3, {paddingLeft: 5, fixed: nameLabel.textBounds().width + 15},
                  1, {fixed: 15 + morph({type: 'label', value: longestTargetMethod}).textBounds().width + 15},
                  2, {fixed: 15},
                  0, {fixed: 20}]
      })
    });
    this._cached.layout.col(0).align = 'center';
    this._cached.layout.col(2).align = 'rightCenter';
    this._cached.layout.col(2).alignedProperty = 'rightCenter';
    this._cached.layout.col(3).align = 'center';
    return this._cached;
  }

  renderConnectedPin(connection) {
    var connectionPoint = morph({type: "ellipse", styleClasses: ["occupiedPin"]}),
        removeButton = Icon.makeLabel('remove', {nativeCursor: 'pointer'}),
        targetPropExists = connection.targetObj[connection.targetMethodName] !== undefined,
        description = morph({
          type: "text", fill: Color.transparent,
          readOnly: true, nativeCursor: 'pointer', padding: rect(0,1,0,0),
          textAndAttributes: [
            connection.targetMethodName, {
              fontColor: targetPropExists ? "" : Color.red
            }, "  ", null,
            ...Icon.textAttribute("long-arrow-left")
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
    return [connectionPoint, removeButton, description];
  }

  visualizeConnection(m1, m2, existingLeash, leashStyle = {}, orientation = 'left') {
    // if m2 is not a morph, then render a data pointer (to open inspector)
    let sides = rect(0).sides.concat(rect(0).corners),
        leash = existingLeash || new Leash({
          isSmooth: true,
          styleClasses: ['Halo'],
          borderColor: Color.orange,
          epiMorph: true,
          endpointStyle: {
            start: {fill: Color.transparent, nativeCursor: "auto"},
            end: {fill: Color.orange}
          },
          ...leashStyle,
          hasFixedPosition: true
        });
    // fixme: the attachment points of the leashes should be parametrized...
    leash.startPoint.attachTo(m1, 'leftCenter');
    if (m2.isMorph) {
       var nearestPart = m2.globalBounds().partNameNearest(sides, m1.globalPosition);
       if (m1.globalPosition.equals(m2.globalBounds().partNamed(nearestPart))) {
         // pick another part, that is not exactly the same
         nearestPart = m2.globalBounds().partNameNearest(arr.without(sides, nearestPart), m1.globalPosition);
       }
       leash.endPoint.attachTo(m2, 'rightCenter');
    } else {
       let virtualNodePos = m1.globalBounds().topRight().addPt(pt(100,0)),
            visualPointer = morph({
             type: 'label', value: m2.toString(),
             styleClasses: ['Tooltip'] , padding: rect(8,4)
           }).openInWorld(virtualNodePos);
       visualPointer.position = this.world().bounds().translateForInclusion(visualPointer.bounds()).topLeft();
       if (visualPointer.bounds().intersection(this.globalBounds()).area() > 0) {
         visualPointer.top = this.owner.globalBounds().insetBy(-20).bottom();
       }
       once(leash, 'remove', visualPointer, 'remove');
       leash.endPoint.attachTo(visualPointer, 'leftCenter');
    }
    return leash;
  }

  showConnection({connection, connectionPoint, description}) {
    connectionPoint.fill = Color.orange;
    description.fontColor = Color.orange;
    if (connection.targetObj.isMorph)
      this.morphHighlighter = MorphHighlighter.for($world, connection.targetObj).show();
    this.connectionIndicator = this.visualizeConnection(
      connectionPoint,
      connection.targetObj,
      this.connectionIndicator
    );
  }

  hideConnection({connection, connectionPoint, description}) {
    description.fontColor = Color.white;
    connectionPoint.fill = Color.white.withA(.8);
    if (this.connectionIndicator) this.connectionIndicator.remove();
    MorphHighlighter.removeHighlighters();
  }

  async editConnection({connection, connectionPoint, description}) {
    this.connectingInProgress = true;
    this.hideConnection({connection, connectionPoint, description});
    let leash = this.visualizeConnection(connectionPoint, connection.targetObj, false, {
      borderColor: Color.gray.darker(),
      endpointStyle: {
        start: {fill: Color.transparent, nativeCursor: "auto"},
        end: {fill: Color.gray.darker()}
      }
    });
    await interactivelyReEvaluateConnection(connection, 'Edit Connection', false);
    this.connectingInProgress = false;
    this.focus();
    this.update();
    leash.remove();
  }

  removeConnection(connection) {
    connection.disconnect();
    //this.connections = (this.target.attributeConnections || []).filter(c => c.sourceAttrName == this.propertyName);
    this.focus();
    this.update();
  }

  startConnecting(connectorLeash, connectorPin) {
    this.connectingInProgress = true;
    connectorLeash.animate({opacity: .8, duration: 300});
    connectorLeash.startPoint.attachTo(connectorPin, 'center');
    connectorLeash.vertices[0].position = pt(2,2);
  }

  async stopConnecting(connectorLeash, connectorPin) {
    let {startPoint, endPoint} = connectorLeash,
         self = this,
         sourceObj = this.target,
         sourceAttr = this.propertyName,
         targetObj = endPoint.connectedMorph;
    if (targetObj)
      interactiveConnectGivenSourceAndTarget(sourceObj, sourceAttr, targetObj, cleanup);
    cleanup();

    async function cleanup() {
      await connectorLeash.animate({opacity: 0, duration: 300});
      connectorLeash.startPoint.clearConnection();
      connectorLeash.endPoint.clearConnection();
      connectorLeash.remove();
      //self.connections = (self.target.attributeConnections || []).filter(c => c.sourceAttrName == self.propertyName);
      self.connectingInProgress = false;
      self.focus();
      self.update();
    }
  }

  async showAllConnections(active) {
    this.previewConnections(false);
    this.expanded = active;
    this.update(200)
  }

  previewConnections(active) {
    if (active) {
      this.previews = this.connections.map(conn => {
        return this.visualizeConnection(this, conn.targetObj, false, {
          borderColor: Color.black,
          endpointStyle: {
            start: {fill: Color.transparent, reactsToPointer: false},
            end: {fill: Color.black}
          }
        }, this.orientation);
      });
    } else {
      arr.invoke(this.previews || [], "remove");
    }
  }

  onHoverIn(evt) {
    this.collapsible && !this.expanded && this.previewConnections(true);
  }

  onHoverOut(evt) {
    this.collapsible && this.previewConnections(false);
  }

  onMouseDown(evt) {
     !this.expanded && this.collapsible && this.showAllConnections(true);
            this.focus();
  }

  onBlur(evt) {
    setTimeout(() => {
      let focused = this.world() && this.world().focusedMorph;
      if (this !== focused && !this.withAllSubmorphsDetect(m => m == focused)) {
        this.onFocusLost();
      } else {
        console.log('refocus')
      }
    }, 100);
  }

  onFocusLost() {
     !this.connectingInProgress && this.collapsible && this.showAllConnections(false);
  }

}


export class ConnectionHalo extends Morph {
  /*
    The connection halo is an alternative visual interface to the
    window based connection inspector.
    The ConnectionHalo represents the existing connections by pins, that are
    distributed around the bounding box of the selected morph.
    Each pin is aligned such that it is as close as possible to the visual morph
    it is connected to in the world.
    The connection is visualized just as in the connection inspector, when the user
    hovers over the pins in question.
    New connections can be created via the add connections button that is attached
    directly to the halo.
    Pins connected to invisble datastructures, or morphs no inside the world, are vizualized in
    an open ended connection, that allows the user to open up an inspector on the connection's
    target object.
  */

  static get properties() {

    return {
      acceptsDrops: {defaultValue: false},
      epiMorph: {defaultValue: true},
      hasFixedPosition: {defaultValue: true},
      reactsToPointer: {defaultValue: false},
      fill: {defaultValue: Color.transparent},
      styleClasses: {defaultValue: ['Halo']},
      borderWidth: {defaultValue: 0},
      borderColor: {defaultValue: Color.red},
      borderRadius: {defaultValue: 5},
      borderStyle: {defaultValue: 'dashed'},
      target: {
        set(t) {
          if (!t.isMorph)
            throw Error('Can not display visual connections for non morphic objects!');
          if (!t.world())
            throw Error('Can not display visual connections for morphs not opened in world!');
          this.setProperty('target', t);
          this.alignWithTarget();
        }
      },

      visiblePins: {defaultValue: []},

      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            ".controlButton": {
              fill: Color.rgb(236,240,241),
              borderRadius: 20,
              fontSize: 13,
              fontColor: Color.darkGray.darker(),
              borderWidth: 2,
              nativeCursor: 'pointer',
              borderColor: Color.transparent
            },
            '.controlButton .Label': {
              fontColor: Color.darkGray.darker()
            }
          })
        }
      },

      submorphs: {
        after: ['target'],
        initialize() {
          this.placeConnectionPins();
          this.alignWithTarget();
        }
      }
    }
  }

  alignWithTarget() {
    this.width = this.submorphBounds().width;
    this.placeConnectionPins();
  }

  initControls() {
    // add close button
    let closeButton = Icon.makeLabel('close', {
      styleClasses: ['controlButton'],
      padding: rect(3,2,3,3),
    });
    let [plusIcon, plusAttrs] = Icon.makeLabel('plus').textAndAttributes;
    plusAttrs.paddingTop = '1px';
    // add create new pin button
    let addPinButton = morph({
      type: 'button',
      width: 110,
      label: [plusIcon, plusAttrs, ' Add Pin...', {}],
      styleClasses: ['controlButton'],
      padding: rect(2,3,2,0),
    });

    this.addMorph({
      fill: Color.transparent,
      name: 'control wrapper',
      bottomCenter: this.innerBounds().insetBy(-10).topCenter(),
      layout: new HorizontalLayout({spacing: 2, align: 'center'}),
      submorphs: [addPinButton, closeButton]
    });

    connect(closeButton, 'onMouseDown', this, 'remove');
    connect(addPinButton, 'onMouseDown', this, 'interactivelyAddPin');
  }

 interactivelyAddPin() {
    let menuItems = this.target.connectMenuItems(async (name, target, spec) => {
      if (name === "custom...") {
        name = await this.world().prompt("Enter custom connection point", {
          requester: this.world(),
          historyId: "lively.morphic-custom-connection-points",
          useLastInput: true
        });
      }
      if (!name) return;
      arr.pushIfNotIncluded(this.visiblePins, name);
      this.placeConnectionPins();
    });

   this.target.openMenu(menuItems).addStyleClass('Halo');
  }

  getPlacementPoints() {
    return [
      ...this.innerBounds().translatedBy(pt(-8,-8)).leftEdge().sample(20)
             .reverse().map(p => [p, 'left']),
      ...this.innerBounds().translatedBy(pt(-8,-8)).rightEdge().sample(20)
             .reverse().map(p => [p, 'left']),
    ]
  }

  placeConnectionPins() {
    var placementPoints = this.getPlacementPoints(),
        sides = rect(0).sides.concat(rect(0).corners);
    this.submorphs = [this.rightContainer = morph({
       fill: Color.transparent, layout: new VerticalLayout({
         reactToSubmorphAnimations: true, spacing: 3, resizeContainer: true
       })
    }), this.leftContainer = morph({
       fill: Color.transparent, layout: new VerticalLayout({
         reactToSubmorphAnimations: true, spacing: 3, resizeContainer: true
       })      
    })];
    this.initControls();

    let pinsAndConnections = this.visiblePins.reduce(
      (spec, name) => Object.assign(spec, {[name]: []}), {});
    (this.target.attributeConnections || []).reduce((spec, con) => {
      let conns = spec[con.sourceAttrName] || (spec[con.sourceAttrName] = []);
      conns.push(con);
      return spec;
    }, pinsAndConnections);

    Object.keys(pinsAndConnections).map((sourceName) => {
      if (!placementPoints.length) placementPoints = this.getPlacementPoints();
      let [center, orientation] = placementPoints.pop()
      this[orientation + 'Container'].addMorphBack(
        new ConnectionPin({
          expanded: false,
          styleClasses: ['dark'],
          propertyName: sourceName,
          connections: pinsAndConnections[sourceName],
          target: this.target,
          collapsible: true,
          orientation
        })
      )
    });
    this.rightContainer.topLeft = this.innerBounds().topLeft().addXY(5);
    this.leftContainer.topLeft = this.innerBounds().topLeft().addXY(5);
  }

}