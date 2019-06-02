(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vdomSerializedPatch = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var types = require('./types');

var SoftSetHook =
  require('virtual-dom/virtual-hyperscript/hooks/soft-set-hook');

function arrayToJson(arr) {
  var len = arr.length;
  var i = -1;
  var res = new Array(len);
  while (++i < len) {
    res[i] = toJson(arr[i]);
  }
  return res;
}

function plainObjectToJson(obj) {
  var res = {};
  /* jshint -W089 */
  /* this is fine; these objects are always plain */
  for (var key in obj) {
    var val = obj[key];
    res[key] = typeof val !== 'undefined' ? toJson(val) : val;
  }
  return res;
}

function virtualNodeToJson(obj) {
  var res = {
    // type
    t: types.VirtualNode,
    tn: obj.tagName
  };
  if (Object.keys(obj.properties).length) {
    res.p = plainObjectToJson(obj.properties);
  }
  if (obj.children.length) {
    res.c = arrayToJson(obj.children);
  }
  if (obj.key) {
    res.k = obj.key;
  }
  if (obj.namespace) {
    res.n = obj.namespace;
  }
  return res;
}

function virtualTextToJson(obj) {
  return {
    // type
    t: types.VirtualTree,
    // text
    x: obj.text
  };
}

function virtualPatchToJson(obj) {
  var res = {
    // type
    t: types.VirtualPatch,
    // patch type
    pt: obj.type
  };

  if (obj.vNode) {
    res.v = toJson(obj.vNode);
  }

  if (obj.patch) {
    res.p = toJson(obj.patch);
  }

  return res;
}

function softSetHookToJson(obj) {
  return {
    // type
    t: types.SoftSetHook,
    value: obj.value
  };
}

function objectToJson(obj) {
  if ('patch' in obj && typeof obj.type === 'number') {
    return virtualPatchToJson(obj);
  }
  if (obj.type === 'VirtualNode') {
    return virtualNodeToJson(obj);
  }
  if (obj.type === 'VirtualText') {
    return virtualTextToJson(obj);
  }
  if (obj instanceof SoftSetHook) {
    return softSetHookToJson(obj);
  }

  // plain object
  return plainObjectToJson(obj);
}

function toJson(obj) {

  var type = typeof obj;

  switch (type) {
    case 'string':
    case 'boolean':
    case 'number':
      return obj;
  }

  // type === 'object'
  if (Array.isArray(obj)) {
    return arrayToJson(obj);
  }

  if (!obj) { // null
    return null;
  }

  return objectToJson(obj);
}

module.exports = toJson;
},{"./types":2,"virtual-dom/virtual-hyperscript/hooks/soft-set-hook":18}],2:[function(require,module,exports){
module.exports = {
  VirtualTree: 1,
  VirtualPatch: 2,
  VirtualNode: 3,
  SoftSetHook: 4
};
},{}],3:[function(require,module,exports){
'use strict';

module.exports = require('./lib/toJson');
},{"./lib/toJson":1}],4:[function(require,module,exports){
'use strict';

var serialize = require('./lib/serialize');
var patch = require('./lib/patch');

module.exports = {
  serialize: serialize,
  patch: patch
};

},{"./lib/patch":8,"./lib/serialize":17}],5:[function(require,module,exports){
var isObject = require('./isObject');
var isSoftSetHook = require('./isSoftSetHook');

module.exports = applyProperties;

function applyProperties(node, props, previous) {
  for (var propName in props) {
    var propValue = props[propName]

    if (propValue === undefined) {
      removeProperty(node, propName, previous);
    } else if (isSoftSetHook(propValue)) {
      removeProperty(node, propName, propValue, previous)
      node[propName] = propValue.value
    } else {
      if (isObject(propValue)) {
        patchObject(node, props, previous, propName, propValue);
      } else {
        node[propName] = propValue
      }
    }
  }
}

function removeProperty(node, propName, previous) {
  if (!previous) {
    return
  }
  var previousValue = previous[propName]

  if (propName === "attributes") {
    for (var attrName in previousValue) {
      node.removeAttribute(attrName)
    }
  } else if (propName === "style") {
    for (var i in previousValue) {
      node.style[i] = ""
    }
  } else if (typeof previousValue === "string") {
    node[propName] = ""
  } else {
    node[propName] = null
  }
}

function patchObject(node, props, previous, propName, propValue) {
  var previousValue = previous ? previous[propName] : undefined

  // Set attributes
  if (propName === "attributes") {
    for (var attrName in propValue) {
      var attrValue = propValue[attrName]

      if (attrValue === undefined) {
        node.removeAttribute(attrName)
      } else {
        node.setAttribute(attrName, attrValue)
      }
    }

    return
  }

  if (previousValue && isObject(previousValue) &&
    getPrototype(previousValue) !== getPrototype(propValue)) {
    node[propName] = propValue
    return
  }

  if (!isObject(node[propName])) {
    node[propName] = {}
  }

  var replacer = propName === "style" ? "" : undefined

  for (var k in propValue) {
    var value = propValue[k]
    node[propName][k] = (value === undefined) ? replacer : value
  }
}

function getPrototype(value) {
  // getPrototypeOf shim for older browsers
  /* istanbul ignore else */
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else {
    return value.__proto__ || value.constructor.prototype;
  }
}

},{"./isObject":9,"./isSoftSetHook":10}],6:[function(require,module,exports){
var applyProperties = require("./applyProperties")
var isVText = require('./isVText');
var isVNode = require('./isVNode');

module.exports = createElement;

function createElement(vnode) {
  var doc = document;

  if (isVText(vnode)) {
    return doc.createTextNode(vnode.x) // 'x' means 'text'
  } else if (!isVNode(vnode)) {
    return null
  }

  var node = (!vnode.n) ? // 'n' === 'namespace'
    doc.createElement(vnode.tn) : // 'tn' === 'tagName'
    doc.createElementNS(vnode.n, vnode.tn)

  var props = vnode.p // 'p' === 'properties'
  applyProperties(node, props)

  var children = vnode.c // 'c' === 'children'

  if (children) {
    for (var i = 0; i < children.length; i++) {
      var childNode = createElement(children[i])
      if (childNode) {
        node.appendChild(childNode)
      }
    }
  }

  return node
}

},{"./applyProperties":5,"./isVNode":11,"./isVText":12}],7:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
  if (!indices || indices.length === 0) {
    return {}
  } else {
    indices.sort(ascending)
    return recurse(rootNode, tree, indices, nodes, 0)
  }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
  nodes = nodes || {}


  if (rootNode) {
    if (indexInRange(indices, rootIndex, rootIndex)) {
      nodes[rootIndex] = rootNode
    }

    var treeChildren = tree[0];

    if (treeChildren) {

      var childNodes = rootNode.childNodes

      for (var i = 0; i < treeChildren.length; i++) {
        rootIndex += 1

        var vChild = treeChildren[i] || noChild
        var nextIndex = rootIndex + (vChild[1] || 0)

        // skip recursion down the tree if there are no nodes down here
        if (indexInRange(indices, rootIndex, nextIndex)) {
          recurse(childNodes[i], vChild, indices, nodes, rootIndex)
        }

        rootIndex = nextIndex
      }
    }
  }

  return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
  if (indices.length === 0) {
    return false
  }

  var minIndex = 0
  var maxIndex = indices.length - 1
  var currentIndex
  var currentItem

  while (minIndex <= maxIndex) {
    currentIndex = ((maxIndex + minIndex) / 2) >> 0
    currentItem = indices[currentIndex]

    if (minIndex === maxIndex) {
      return currentItem >= left && currentItem <= right
    } else if (currentItem < left) {
      minIndex = currentIndex + 1
    } else if (currentItem > right) {
      maxIndex = currentIndex - 1
    } else {
      return true
    }
  }

  return false;
}

function ascending(a, b) {
  return a > b ? 1 : -1
}

},{}],8:[function(require,module,exports){
var patchRecursive = require('./patchRecursive');

function patch(rootNode, patches) {
  return patchRecursive(rootNode, patches);
}

module.exports = patch;
},{"./patchRecursive":14}],9:[function(require,module,exports){
'use strict';

module.exports = function isObject(x) {
  return typeof x === "object" && x !== null;
};
},{}],10:[function(require,module,exports){
module.exports = isSoftSetHook

function isSoftSetHook(x) {
  return x && typeof x === 'object' && typeof x.value !== 'undefined';
}

},{}],11:[function(require,module,exports){
module.exports = isVirtualNode

var types = require('./types');

function isVirtualNode(x) {
  return x && x.t === types.VirtualNode
}

},{"./types":15}],12:[function(require,module,exports){
module.exports = isVirtualText

var types = require('./types');

function isVirtualText(x) {
  return x && x.t === types.VirtualTree;
}

},{"./types":15}],13:[function(require,module,exports){
var applyProperties = require("./applyProperties");
var patchTypes = require("../patchTypes");
var render = require('./createElement');

module.exports = applyPatch

function applyPatch(vpatch, domNode, patchRecursive) {
  var type = vpatch[0]
  var patch = vpatch[1]
  var vNode = vpatch[2]

  switch (type) {
    case patchTypes.REMOVE:
      return removeNode(domNode)
    case patchTypes.INSERT:
      return insertNode(domNode, patch)
    case patchTypes.VTEXT:
      return stringPatch(domNode, patch)
    case patchTypes.VNODE:
      return vNodePatch(domNode, patch)
    case patchTypes.ORDER:
      reorderChildren(domNode, patch)
      return domNode
    case patchTypes.PROPS:
      applyProperties(domNode, patch, vNode.p) // 'p' === 'properties'
      return domNode
    case patchTypes.THUNK:
      return replaceRoot(domNode,
          patchRecursive(domNode, patch))
    default:
      return domNode
  }
}

function removeNode(domNode) {
  var parentNode = domNode.parentNode

  if (parentNode) {
    parentNode.removeChild(domNode)
  }

  return null
}

function insertNode(parentNode, vNode) {
  var newNode = render(vNode)

  if (parentNode) {
    parentNode.appendChild(newNode)
  }

  return parentNode
}

function stringPatch(domNode, vText) {
  var newNode

  if (domNode.nodeType === 3) {
    domNode.replaceData(0, domNode.length, vText.x) // 'x' means 'text'
    newNode = domNode
  } else {
    var parentNode = domNode.parentNode
    newNode = render(vText)

    if (parentNode && newNode !== domNode) {
      parentNode.replaceChild(newNode, domNode)
    }
  }

  return newNode
}

function vNodePatch(domNode, vNode) {
  var parentNode = domNode.parentNode
  var newNode = render(vNode)

  if (parentNode && newNode !== domNode) {
    parentNode.replaceChild(newNode, domNode)
  }

  return newNode
}

function reorderChildren(domNode, moves) {
  var childNodes = domNode.childNodes
  var keyMap = {}
  var node
  var remove
  var insert

  for (var i = 0; i < moves.removes.length; i++) {
    remove = moves.removes[i]
    node = childNodes[remove.from]
    if (remove.key) {
      keyMap[remove.key] = node
    }
    domNode.removeChild(node)
  }

  var length = childNodes.length
  for (var j = 0; j < moves.inserts.length; j++) {
    insert = moves.inserts[j]
    node = keyMap[insert.key]
    // this is the weirdest bug i've ever seen in webkit
    domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
  }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../patchTypes":16,"./applyProperties":5,"./createElement":6}],14:[function(require,module,exports){
var domIndex = require("./domIndex")
var patchOp = require("./patchOp")

function patchRecursive(rootNode, patches) {
  var indices = patchIndices(patches)

  if (indices.length === 0) {
    return rootNode
  }

  var index = domIndex(rootNode, patches.a, indices)

  for (var i = 0; i < indices.length; i++) {
    var nodeIndex = indices[i]
    rootNode = applyPatch(rootNode,
      index[nodeIndex],
      patches[nodeIndex])
  }

  return rootNode
}

function applyPatch(rootNode, domNode, patchList) {
  if (!domNode) {
    return rootNode
  }

  var newNode

  for (var i = 0; i < patchList.length; i++) {
    newNode = patchOp(patchList[i], domNode, patchRecursive)

    if (domNode === rootNode) {
      rootNode = newNode
    }
  }

  return rootNode
}

function patchIndices(patches) {
  var indices = []

  for (var key in patches) {
    if (key !== "a") {
      indices.push(Number(key))
    }
  }

  return indices
}


module.exports = patchRecursive;

},{"./domIndex":7,"./patchOp":13}],15:[function(require,module,exports){
// copied from vdom-as-json/types.js

module.exports = {
  VirtualTree: 1,
  VirtualPatch: 2,
  VirtualNode: 3,
  SoftSetHook: 4
};
},{}],16:[function(require,module,exports){
// original this was is-vpatch.js

module.exports = {
  NONE: 0,
  VTEXT: 1,
  VNODE: 2,
  WIDGET: 3,
  PROPS: 4,
  ORDER: 5,
  INSERT: 6,
  REMOVE: 7,
  THUNK: 8
};
},{}],17:[function(require,module,exports){
var patchTypes = require('../patchTypes');
var toJson = require('vdom-as-json/toJson');

// traverse the thing that the original patch structure called "a',
// i.e. the virtual tree representing the current node structure.
// this thing only really needs two properties - "children" and "count",
// so trim out everything else
function serializeCurrentNode(currentNode) {
  var children = currentNode.children;
  if (!children) {
    return null;
  }
  var len = children.length;
  var arr = new Array(len);
  var i = -1;
  while (++i < len) {
    arr[i] = serializeCurrentNode(children[i]);
  }
  if (currentNode.count) {
    return [arr, currentNode.count];
  } else {
    return [arr];
  }
}

function serializeVirtualPatchOrPatches(vPatch) {
  if (Array.isArray(vPatch)) {
    var len = vPatch.length;
    var res = new Array(len);
    var i = -1;
    while (++i < len) {
      res[i] = serializeVirtualPatch(vPatch[i]);
    }
    return res;
  }
  return [serializeVirtualPatch(vPatch)];
}

function serializeVirtualPatch(vPatch) {
  var type = vPatch.type;
  var res = [
    type,
    vPatch.patch && vPatch.patch.a ? toJson(serializeRootPatch(vPatch.patch)) : toJson(vPatch.patch)
  ];

  if (type === patchTypes.PROPS) {
    // this is the only time the vNode is needed
    res.push({p: vPatch.vNode.properties}); // 'p' === 'properties'
  }
  return res;
}

function serializeRootPatch(patch) {
  var outputRootNode = serializeCurrentNode(patch.a);

  var res = {
    a: outputRootNode
  };

  for (var key in patch) {
    if (key !== 'a') {
      res[key] = serializeVirtualPatchOrPatches(patch[key]);
    }
  }

  return res;
};
module.exports = serializeRootPatch;

},{"../patchTypes":16,"vdom-as-json/toJson":3}],18:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}]},{},[4])(4)
});