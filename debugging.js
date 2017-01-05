import { fun, obj, arr, num, string, graph, Path } from "lively.lang";

import { ObjectPool } from "lively.serializer2";
import ClassHelper from "./class-helper.js";
import { HTMLMorph, inspect } from "lively.morphic";

/*

var a = {bar: 15}; a.b = {foo: 23};
var p = new ObjectPool(); p.add(a)
var i = SnapshotInspector.forSnapshot(p.snapshot())

var ids = p.objectRefs().map(ea => ea.id);
i.findIdReferencePathFromToId(ids[0], ids[1]);

*/

export class SnapshotInspector {

  static forSnapshot(snapshot) {
    return new this(snapshot).processSnapshot();
  }

  constructor(snapshot) {
    this.snapshot = snapshot;
    this.classes = {};
    this.expressions = {};
  }

  processSnapshot() {
    var {snapshot, classes, expressions} = this,
        pool = ObjectPool.fromSnapshot(snapshot);

    pool.objectRefs().forEach(ref => {
      var snap = ref.currentSnapshot,
          {className} = snap[ClassHelper.classMetaForSerializationProp] || {};

      var propNames = Object.keys(snap.props);
      if (className == null) {
        if (propNames.length > 3) className = "{" + propNames.slice(0, 3).join(", ") + ", ...}";
        else className = "{" + propNames.join(", ") + "}";
      }

      if (!classes[className])
        classes[className] = {count: 0, bytes: 0, name: className, objects: []};
      classes[className].count++;
      classes[className].bytes += JSON.stringify(snap).length;
      classes[className].objects.push([ref.id, snap]);

      propNames.forEach(key => {
        var value = snap.props[key].value;
        if (!value || typeof value !== "string"
         || !pool.expressionSerializer.isSerializedExpression(value)) return;

        var {__expr__} = pool.expressionSerializer.exprStringDecode(value);
        var expr = expressions[__expr__]
        if (!expr)
          expr = expressions[__expr__] = {count: 0, bytes: 0, name: __expr__, objects: []};
        expr.count++;
        expr.bytes += value.length;
        expr.objects.push([[ref.id, key], value]);
      });

    });

    return this;
  }

  explainId(id) {
    var ref = this.snapshot[id];
    if (!ref) return null;
    var {className} = ref[ClassHelper.classMetaForSerializationProp] || {className: "Object"};
    var propNames = Object.keys(ref.props)
    if (className == "Object") {
      if (propNames.length > 3) className = "{" + propNames.slice(0, 3).join(", ") + ", ...}";
      else className = "{" + propNames.join(", ") + "}";
    }
    return className
  }

  sorted(prop) {
    return arr.sortBy(
      Object.keys(this[prop]).map(key => this[prop][key]),
      tuple => isNaN(tuple.bytes) ? 0 : tuple.bytes).reverse()
  }

  report(prop) {
    var items = [
      ['#bytes', '#objs', 'avg', prop],
      ...this.sorted(prop).map(tuple =>
        [num.humanReadableByteSize(tuple.bytes),
         tuple.count,
         num.humanReadableByteSize(tuple.bytes / tuple.count),
         tuple.name])];
    return string.printTable(items, {separator: ' | '})
  }

  toString() {
    var {snapshot} = this,
        bytesAltogether = JSON.stringify(snapshot).length,
        objCount = Object.keys(snapshot).length;
    return string.format('Total: %s (%s objs - %s per obj)',
                num.humanReadableByteSize(bytesAltogether), objCount,
                num.humanReadableByteSize(bytesAltogether / objCount))
        + '\nclasses:\n' + this.report("classes")
        + '\nexpressions:\n' + this.report("expressions")
  }

  biggestObjectsOfType(typeString) {
    return arr.sortBy(
      this.classes[typeString].objects.map(([id, obj]) => JSON.stringify(obj)),
      ea => ea.length).reverse()
     .map(ea => JSON.parse(ea));
  }

  toCSV() {
    var lines = ['type,size,size in bytes,count,size per object,size perobject in bytes'];
    this.sorted("classes").forEach(tuple => {
      lines.push([tuple.name, num.humanReadableByteSize(tuple.bytes), tuple.bytes, tuple.count,
      num.humanReadableByteSize(tuple.bytes / tuple.count), tuple.bytes / tuple.count].join(','))
    });
    return lines.join('\n');
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  findPathFromToId(fromId, toId, options = {}) {
    // findPathFromToId(snapshot, id, "A9E157AB-E863-400C-A15C-677CE90098B0")
    // findPathFromToId(snapshot, id, "A9E157AB-E863-400C-A15C-677CE90098B0", {hideId: false, showClassNames: true})
    return findPathFromToId(this.snapshot, fromId, toId, options);
  }

  referenceGraph() {
    return Object.keys(this.snapshot).reduce((g, id) =>
      Object.assign(g, {[id]: referencesOfId(this.snapshot, id)}), {})
  }

  referenceCouncts() {
    var invertedG = graph.invert(this.referenceGraph()),
        counts = {};
    Object.keys(invertedG).forEach(key => counts[key] = invertedG[key].length);
    return counts;
  }

  lookupPath(fromId, path) {
    // given a path like "submorphs.1.submorphs.0" and a starting id (root
    // object), try to resolve the path, returning the serialized object of
    // this.snapshot

    path = path.replace(/^\./, "");
    // foo[0].baz => foo.0.baz
    path = path.replace(/\[([^\]])+\]/g, ".$1")

    var parts = Path(path).parts(),
        current = this.snapshot[fromId],
        counter = 0;

    while (true) {
      if (counter++ > 1000) throw "stop";
      var key = parts.shift();
      if (!key) return current;

      if (!current.props || !current.props[key])
        throw new Error(`Property ${key} not found for ref ${JSON.stringify(current)}`);

      var {value} = current.props[key];
      if (!value)
        throw new Error(`Property ${key} has no value`);

      while (Array.isArray(value))
        value = value[parts.shift()];

      if (!value || !value.__ref__) return value;

      current = this.snapshot[value.id];
    }
    return current;
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


function isReference(value) { return value && value.__ref__; }

function referencesOfId(snapshot, id, withPath) {
  // all the ids an regObj (given by id) points to
  var ref = snapshot[id], result = [];
  Object.keys(ref.props).forEach(key => {
    var {value, verbatim} = ref.props[key];
    if (Array.isArray(value)) {
      result = result.concat(referencesInArray(snapshot, value, withPath && key));
      return;
    };
    if (verbatim || !value || !isReference(value)) return;
    result.push(withPath ? {key: key, id: value.id} : value.id);
  });
  return result;
}

function referencesInArray(snapshot, arr, optPath) {
  // helper for referencesOfId
  var result = [];
  arr.forEach((value, idx) => {
    if (Array.isArray(value)) {
      var path = optPath ? optPath + '[' + idx + ']' : undefined;
      result = result.concat(referencesInArray(snapshot, value, path));
      return;
    };
    if (!value || !isReference(value)) return;
    result.push(optPath ? {key: optPath + '[' + idx + ']', id: value.id} : value.id);
  })
  return result;
}

function referencesAndClassNamesOfId(snapshot, id) {
  // given an id, the regObj behind it is taken and for all its references a list is assembled
  // [id:ClassName]
  return referencesOfId(snapshot, id).map(id => id + ':' + classNameOfId(snapshot, id));
}

function classNameOfId(snapshot, id) {
  var ref = snapshot[id];
  var {className} = ref[ClassHelper.classMetaForSerializationProp] || {}
  return className || "Object";
}



function findPathFromToId(snapshot, fromId, toId, options = {}) {
  // prints path:
  //   findIdReferencePathFromToId(snapshot, 0, 10);
  // prints ids, classNames, property names:
  //   findIdReferencePathFromToId(snapshot, id, "A9E157AB-E863-400C-A15C-677CE90098B0", {hideId: false, showClassNames: true})
  var showPath = options.showPath === undefined ?  true : options.showPath,
      showClassNames = options.hasOwnProperty('showClassNames') ? options.showClassNames : !showPath,
      showPropNames = options.hasOwnProperty('showPropNames') ? options.showPropNames : showPath,
      hideId = options.hasOwnProperty('hideId') ? options.hideId : showPath;

  // how can one get from obj behind fromId to obj behind toId
  // returns an array of ids
  // findIdReferencePathFromToId(snapshot, 0, 1548)
  var stack = [], visited = {}, found;

  function pathFromIdToId(fromId, toId, depth) {
    if (found) return;
    if (depth > 50) { alert('' + stack); return; }
    if (fromId === toId) { stack.push(fromId); found = stack.slice(); return };
    if (visited[fromId]) return;
    visited[fromId] = true;
    stack.push(fromId);
    var refs = referencesOfId(snapshot, fromId);
    for (var i = 0; i < refs.length; i++)
      pathFromIdToId(refs[i], toId, depth + 1);
    stack.pop();
  }
  pathFromIdToId(fromId, toId, 0);

  if (!found) return null;

  if (!showClassNames && !showPropNames) return found;

  var result = [];
  for (var i = 0; i < found.length-1; i++) {
    var currId = found[i],
        nextId = found[i+1],
        strings = [];
    if (!hideId) strings.push(currId);
    if (showClassNames) {
      var {className} = snapshot[currId][ClassHelper.classMetaForSerializationProp] || {}
      strings.push(className || "Object");
    }
    if (showPropNames) {
      console.log(referencesOfId(snapshot, currId, true))
      var ref = referencesOfId(snapshot, currId, true).find(ea => ea.id === nextId) || {key: "????"};
      strings.push(ref.key);
    }
    result.push(strings.join(':'));
  }
  if (showPath)
    result = '.' + result.join('.');
  return result;
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import cytoscape from "http://js.cytoscape.org/js/cytoscape.js";
import coseBilkentLayout from "https://cdn.rawgit.com/cytoscape/cytoscape.js-cose-bilkent/1.0.5/cytoscape-cose-bilkent.js";
import { connect } from "lively.bindings";
coseBilkentLayout(cytoscape);


// var viz = await ObjectGraphVisualizer.renderSnapshotAndOpen(window.snapshot)

export class ObjectGraphVisualizer extends HTMLMorph {

  static renderSnapshotAndOpen(snapshot) {
    var viz = this.renderSnapshot(snapshot);
    viz.openInWindow({title: "object graph visualizer"});
    return viz
  }

  static renderSnapshot(snapshot) {
    return new this({snapshot});
  }

  constructor(props = {}) {
    super({
      draggable: true,
      ...obj.dissoc(props, ["snapshot"])
    });
    this.state = {cy: null, snapshot: props.snapshot};
    connect(this, 'extent', this, 'updateDebounced', {updater: ($upd, x, y) => window.inspect({x,y}) && $upd()});
    this.update();
  }

  cleanup() {
    this.html = "";
    if (this.state.cy) {
      this.state.cy.destroy();
      this.state.cy = null;
    }
  }

  update() {
    this.cleanup();
    if (this.state.snapshot)
      this.renderSnapshot(this.state.snapshot).catch(err => this.showError(err));
  }

  updateDebounced() {
    fun.debounceNamed("updateDebounced-" + this.id, 100, () => this.update())();
  }

  get snapshot() { return this.state.snapshot; }
  set snapshot(x) { this.state.snapshot = x; this.updateDebounced(); }

  async renderSnapshot(snapshot) {
    this.cleanup();

    var i = new SnapshotInspector(snapshot);
    var g = i.referenceGraph();
    var reverseG = graph.invert(g);
    var morphIds = Object.keys(g).filter(id => !!Path("props.submorphs").get(snapshot[id]));

    var nodes = Object.keys(g).map(id => {
      // fixme
      var objectSnapshot = snapshot[id];
      var label = string.truncate(i.explainId(id), 20);
      var classes = "", parent;

      var isMorph = morphIds.includes(id),
          className = objectSnapshot["lively.serializer-class-info"]
                   && objectSnapshot["lively.serializer-class-info"].className;

      if (isMorph && className !== "ListItemMorph") {
        classes = "Morph " + className;
        label += "\n" + (Path("props.name.value").get(objectSnapshot) || "");
        // parent = "morph";
        // var refs = Object.keys(g).filter(otherId => g[otherId].includes(id))
        // var owner = refs.find(ref =>
        //   (path(`props.submorphs.value`).get(snapshot[ref]) || []).some(ea => ea.id === id));
        // if (owner) parent = owner
      }
      // else {
      //
      //   // trying to find a morph parent to group in the graphs
      //   var remaining = reverseG[id] || [], seen = {}, maxIterations = 1000, counter = 0;
      //   while (true) {
      //     if (counter++ > maxIterations) break;
      //     var id = remaining.shift();
      //     if (!id) break;
      //     if (id in seen) continue;
      //     seen[id] = true;
      //     var pointersToMe = reverseG[id] || [];
      //     var morphId = pointersToMe.find(id => morphIds.includes(id));
      //     if (morphId) { parent = morphId; break; }
      //     remaining.push(...pointersToMe);
      //   }
      //   if (parent) show(`${id} => ${parent}`)
      // }

      return {
        group: "nodes",
        autounselectify: true,
        data: {id, parent, label, snapshot: objectSnapshot},
        classes
      }
    });


    // nodes.push({group: "nodes", data: {id: "morph"}})


    var edges = arr.flatmap(Object.keys(g), id => g[id].map(id2 => {
      return {group: "edges", data: {source: id, target: id2}};
    }));


    var cy = this.state.cy = cytoscape({
      // container: iframeMorph.innerWindow.document.body,
      container: this.domNode,

      autoungrabify: true,
      // boxSelectionEnabled: false,
      // autounselectify: true,

      layout: {
        name: "spread",
        // idealEdgeLength: 3,
        // nodeOverlap: 2
      },

      layout: {
        name: "cose-bilkent",
        idealEdgeLength: 50,
        numIter: 2500,
        // edgeElasticity: 0.2,
        // gravity: .5
        // padding: 50,
        nodeRepulsion: 45000,
        animate: "end",
      },

      // layout: {
      //   name: "concentric"
      // },

      style: [

        {
          selector: "",
          style: {
            	"active-bg-color": "#ccc",
            	"active-bg-opacity": 0.333
          }
        },

        {
          selector: "node",
          style: {
            padding: 10,
            "background-color": "#999",
            "background-opacity" : ".5",
            width: "label", height: 20,
            "label": "data(label)",
            "text-valign": "center",
            "text-halign": "center",
            "font-size": "10px",
            "color": "#666",
            shape: "roundrectangle",
            "text-wrap": "wrap",
            "text-outline-color": "#666",
            "text-outline-width": 3,
            "text-outline-opacity": 1,
            "color": "white",
          }
        },

        {
          selector: "node.Morph",
          style: {
            width: "label", height: "label",
            "background-color": "#666",
            "background-opacity" : ".3",
            "font-size": "18px",
            "text-outline-color": "#666",
            "text-outline-width": 3,
            "text-outline-opacity": 1,
          }
        },

        {
          selector: "edge",
          style: {
            "width": 4,
            "line-color": "#666",
            "curve-style": "bezier",
            "target-arrow-shape": "triangle"
          }
        },

        {
          selector: "edge:selected",
          style: {
            "line-color": "blue"
          }
        }
      ],

      elements: nodes.concat(edges)
    });

    this.onDrag = function(evt) {
      var thing = cy.$(":active")[0];
      if (!thing) return;
      var {x,y} = evt.positionIn(this);
      thing.renderedPosition("x", x);
      thing.renderedPosition("y", y);
    };

    this.onMouseUp = function(evt) {
      // show("draaaag" + cy.$(":active").length);
      var node = cy.$("node:active")[0];
      var edge = cy.$("edge:active")[0];
      node && inspect({id: node.data().id, snapshot: node.data().snapshot});
      edge &&  this.setStatusMessage(i.findPathFromToId(edge.data().source, edge.data().target));
    };

    return this;
  }


}