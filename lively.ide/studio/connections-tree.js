import { Tree } from 'lively.components/tree.js';
import { TreeData } from 'lively.components';
import { Icon, morph } from 'lively.morphic';
import { pt, Rectangle, rect, Color } from 'lively.graphics';
import { arr } from 'lively.lang';
import { connect, signal } from 'lively.bindings';
import { Leash } from 'lively.components/widgets.js';
import { once } from 'lively.bindings';
import { interactivelyReEvaluateConnection, interactiveConnectGivenSource, interactiveConnectGivenSourceAndTarget } from 'lively.ide/fabrik.js';
import { getClassName } from 'lively.serializer2';

function visualizeConnection (m1, m2, existingLeash, leashStyle = {}, orientation = 'left') {
  // if m2 is not a morph, then render a data pointer (to open inspector)
  const sides = rect(0).sides.concat(rect(0).corners);
  const leash = existingLeash || new Leash({
    isSmooth: true,
    styleClasses: ['Halo'],
    borderColor: Color.orange,
    epiMorph: true,
    endpointStyle: {
      start: { fill: Color.transparent, nativeCursor: 'auto' },
      end: { fill: Color.orange }
    },
    ...leashStyle,
    hasFixedPosition: true
  });
  // fixme: the attachment points of the leashes should be parametrized...
  leash.startPoint.attachTo(m1, 'rightCenter');
  if (m2.isMorph) {
    let nearestPart = m2.globalBounds().partNameNearest(sides, m1.globalPosition);
    if (m1.globalPosition.equals(m2.globalBounds().partNamed(nearestPart))) {
      // pick another part, that is not exactly the same
      nearestPart = m2.globalBounds().partNameNearest(arr.without(sides, nearestPart), m1.globalPosition);
    }
    leash.endPoint.attachTo(m2, 'leftCenter');
  } else {
    const virtualNodePos = m1.globalBounds().topRight().addPt(pt(100, 0));
    const visualPointer = morph({
      type: 'label',
      value: m2.toString(),
      styleClasses: ['Tooltip'],
      padding: rect(8, 4)
    }).openInWorld(virtualNodePos);
    visualPointer.position = m1.world().bounds().translateForInclusion(visualPointer.bounds()).topLeft();
    once(leash, 'remove', visualPointer, 'remove');
    leash.endPoint.attachTo(visualPointer, 'leftCenter');
  }
  return leash;
}

function startConnecting (connectorLeash, connectorPin) {
  connectorLeash.animate({ opacity: 0.8, duration: 300 });
  connectorLeash.startPoint.attachTo(connectorPin, 'center');
  connectorLeash.vertices[0].position = pt(2, 2);
}

async function stopConnecting (connectorLeash, connectorPin, sourceObj, sourceAttr = false) {
  const { startPoint, endPoint } = connectorLeash;
  let targetObj = endPoint.connectedMorph;
  if (targetObj && getClassName(targetObj) == 'MorphContainer') {
    targetObj = targetObj.target;
  }
  if (targetObj) { await interactiveConnectGivenSourceAndTarget(sourceObj, sourceAttr, targetObj); }

  await cleanup();

  async function cleanup () {
    await connectorLeash.animate({ opacity: 0, duration: 300 });
    connectorLeash.startPoint.clearConnection();
    connectorLeash.endPoint.clearConnection();
    connectorLeash.remove();
  }
}

async function editConnection ({ connection, connectionPoint, description }) {
  // this.hideConnection({connection, connectionPoint, description});
  const leash = visualizeConnection(connectionPoint, connection.targetObj, false, {
    borderColor: Color.gray.darker(),
    endpointStyle: {
      start: { fill: Color.transparent, nativeCursor: 'auto' },
      end: { fill: Color.gray.darker() }
    }
  });
  await interactivelyReEvaluateConnection(connection, 'Edit Connection', false);
  leash.remove();
}

class ConnectionsTreeData extends TreeData {
  static for (target) {
    const treeData = new this();
    treeData.root = treeData.parseMorphConnections(target);
    return treeData;
  }

  parseMorphConnections (target) {
    const { attributeConnections = [] } = target;
    const data = {};
    for (const conn of attributeConnections) {
      if (conn.targetObj.isHalo) continue;
      data[conn.sourceAttrName] = data[conn.sourceAttrName] || [{
        name: [
          '      New Connection  ', { fontColor: Color.white.withA(0.5), fontStyle: 'italic' },
          this.renderPin(target, conn.sourceAttrName), {}
        ]
      }];
      arr.pushAt(data[conn.sourceAttrName], {
        name: [
          ...this.renderExistingConnection(conn)
        ]
      }, 0);
    }
    return {
      children: Object.entries(data).map(([sourceAttrName, children]) => {
        return {
          name: [sourceAttrName, { fontWeight: 'bold' }, ' ', {}, morph({
            fill: Color.white,
            opacity: 0.7,
            value: `${children.length - 1}`,
            borderRadius: 15,
            fontWeight: 'bold',
            padding: Rectangle.inset(5, 0, 5, 0),
            type: 'label'
          }), { paddingTop: '4px' }],
          children
        };
      }).concat([{
        name: [
          'New Connection  ', { fontColor: Color.white.withA(0.5), fontStyle: 'italic' },
          this.renderPin(target), {}
        ]
      }])
    };
  }

  renderExistingConnection (conn) {
    const nameLabel = morph({
      type: 'label',
      fontColor: Color.gray,
      fontSize: 16,
      nativeCursor: 'pointer',
      value: [...Icon.textAttribute('long-arrow-alt-right', { paddingTop: '4px' }),
        '  ', {}, conn.targetMethodName, {}]
    });
    const connectionPin = this.renderDeadPin();
    const bubble = connectionPin.submorphs[0];
    connect(nameLabel, 'onHoverIn', () => {
      nameLabel.fontColor = Color.orange;
      nameLabel._leash = visualizeConnection(bubble, conn.targetObj, nameLabel._leash);
      bubble.fill = Color.orange;
      bubble.border = { color: Color.orange, width: 3 };
    });
    connect(nameLabel, 'onMouseDown', async (evt) => {
      evt.stop();
      await interactivelyReEvaluateConnection(conn);
      signal(this, 'refresh');
    });
    connect(nameLabel, 'onHoverOut', () => {
      nameLabel.fontColor = Color.gray;
      bubble.fill = Color.gray;
      bubble.border = { color: Color.white, width: 1 };
      nameLabel._leash.remove();
      nameLabel._leash = undefined;
    });
    return [
      nameLabel, {},
      '  ', {},
      ...Icon.textAttribute('times', {
        nativeCursor: 'pointer ',
        onMouseDown: () => {
          conn.disconnect();
          signal(this, 'refresh');
        }
      }),
      '  ', {},
      connectionPin, {}
    ];
  }

  renderDeadPin () {
    const pin = morph({
      type: 'ellipse',
      fill: Color.gray,
      extent: pt(10, 10),
      center: pt(8, 12),
      borderWidth: 1
    });
    return morph({
      extent: pt(20, 20),
      fill: Color.transparent,
      reactsToPointer: false,
      submorphs: [pin]
    });
  }

  renderPin (sourceObj, sourceAttrName) {
    const pin = morph({
      type: 'ellipse',
      fill: Color.gray.withA(0.5),
      extent: pt(10, 10),
      center: pt(8, 12),
      draggable: false,
      borderWidth: 1
    });
    const connector = new Leash({
      opacity: 0,
      styleClasses: ['Halo'],
      isSmooth: true,
      epiMorph: true,
      hasFixedPosition: true,
      borderColor: Color.gray.darker(),
      endpointStyle: { fill: Color.gray.darker() },
      position: pt(1, 1),
      vertices: [pt(0, 0), pt(0, 0)],
      getLabelFor: m => {
        return getClassName(m) == 'MorphContainer' ? m.target.name : m.name;
      },
      canConnectTo: m => getClassName(m) == 'MorphContainer' || arr.intersect(
        [m, ...m.ownerChain()],
        [pin, ...pin.ownerChain()]
      ).length < 2
    });
    pin.addMorph(connector);
    connect(connector.endPoint, 'onDragStart', () => {
      startConnecting(connector, pin);
    });
    connect(connector.endPoint, 'onDragEnd', async (evt) => {
      pin.center = pt(8, 12);
      await stopConnecting(connector, pin, sourceObj, sourceAttrName);
      signal(this, 'refresh');
    });
    return morph({
      extent: pt(20, 20),
      fill: Color.transparent,
      reactsToPointer: false,
      submorphs: [pin]
    });
  }

  display (node) {
    return node.name;
  }

  collapse (node, bool) {
    node.isCollapsed = bool;
  }

  isCollapsed (node) {
    return node.isCollapsed;
  }

  isLeaf (node) {
    return !node.children;
  }

  getChildren (node) {
    return node.children;
  }
}

export default class ConnectionsTree extends Tree {
  static get properties () {
    return {

    };
  }

  inspectConnectionsOf (target) {
    // target = this.get("email input")
    // target = this.get("save button")
    this.targetMorph = target;
    if (target) {
      this.treeData = ConnectionsTreeData.for(target);
      connect(this.treeData, 'refresh', this, 'refresh');
    }
  }

  refresh () {
    if (!this.targetMorph) return;
    this.treeData = ConnectionsTreeData.for(this.targetMorph);
    connect(this.treeData, 'refresh', this, 'refresh');
  }
}
