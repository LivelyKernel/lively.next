import { fun, obj, arr, num, string, graph, Path } from "lively.lang";

import { ObjectPool } from "lively.serializer2";
import { lookupPath, referenceGraph, findPathFromToId } from "./snapshot-navigation.js";
import ClassHelper from "./class-helper.js";
import { HTMLMorph, inspect } from "lively.morphic";

/*

import { serializeMorph, deserializeMorph } from "lively.morphic/serialization.js";


var snap = serializeMorph($world)
num.humanReadableByteSize(JSON.stringify(snap).length)
that.textString = JSON.stringify(snap, null, 2)

var snap = serializeMorph($world.get("text editor").getWindow())
num.humanReadableByteSize(JSON.stringify(snap).length)
that.fontFamily = "monospace"
that.textString = JSON.stringify(snap, null, 2)


var b2 = deserializeMorph(snap, {reinitializeIds: true});

var t = Date.now(); var snap = serializeMorph($world); Date.now() - t;
var t = Date.now(); var snap = serializeMorph($world.get("browser")); Date.now() - t;

var i = SnapshotInspector.forSnapshot(snap.snapshot);
i.findPathFromToId(snap.id, "BF4B7B7B-DEE0-4971-ACEA-9F8A6A02941A")
i

var t = Date.now(); var g = referenceGraph(snap.snapshot); Date.now() - t;
var t = Date.now(); var g = referenceGraph(snap.snapshot); Date.now() - t;
var t = Date.now(); graph.hull(g, snap.id); Date.now() - t;
var t = Date.now(); graph.subgraphReachableBy(g, snap.id); Date.now() - t;

graph.hull(g2, snap.id).length
Object.keys(g).length
Object.keys(g2).length

obj.equals(Object.keys(g), Object.keys(g2))
var diff = Object.keys(g).map(key => !obj.equals(g[key], g2[key]) && key).filter(Boolean);

referencesOfId(snap.snapshot, "0002972B-C7FE-4765-A806-D90E11E44654", true)
referencesOfId(snap.snapshot, "0002972B-C7FE-4765-A806-D90E11E44654", true)
snap.snapshot[snap.id]

i.findPathFromToId(snap.id, "0002972B-C7FE-4765-A806-D90E11E44654")

g

$world.execCommand("diff and open in window", {a: x1, b: g})




var a = {bar: 15}; a.b = {foo: 23};
var p = new ObjectPool(); p.add(a)
var i = SnapshotInspector.forSnapshot(p.snapshot())

var ids = p.objectRefs().map(ea => ea.id);
i.findIdReferencePathFromToId(ids[0], ids[1]);

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// var viz = await ObjectGraphVisualizer.renderSnapshotAndOpen(snap.snapshot)
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
    var {classes, snapshot, expressions} = this;
    if (snapshot.snapshot) snapshot = snapshot.snapshot;
    let pool = ObjectPool.fromSnapshot(snapshot);

    pool.objectRefs().forEach(ref => {
      let snap = ref.currentSnapshot,
          {className} = snap[ClassHelper.classMetaForSerializationProp] || {};

      let propNames = Object.keys(snap.props);
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
        let value = snap.props[key].value;
        if (!value || typeof value !== "string"
         || !pool.expressionSerializer.isSerializedExpression(value)) return;

        let {__expr__} = pool.expressionSerializer.exprStringDecode(value),
            expr = expressions[__expr__];
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
    let s = this.snapshot;
    if (s.snapshot) s = s.snapshot;

    var ref = s[id];
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
    let s = this.snapshot;
    if (s.snapshot) s = s.snapshot;
    return findPathFromToId(s, fromId, toId, options)
  }

  referenceGraph() {
    let s = this.snapshot;
    if (s.snapshot) s = s.snapshot;
    return referenceGraph(s);
  }

  referenceCounts() {
    var invertedG = graph.invert(this.referenceGraph()), counts = {};
    Object.keys(invertedG).forEach(key => counts[key] = invertedG[key].length);
    return counts;
  }

  lookupPath(fromId, path) {
    // given a path like "submorphs.1.submorphs.0" and a starting id (root
    // object), try to resolve the path, returning the serialized object of
    // this.snapshot
    let s = this.snapshot;
    if (s.snapshot) s = s.snapshot;
    return lookupPath(s, fromId, path);
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import cytoscape from "https://cdn.rawgit.com/cytoscape/cytoscape.js/v2.7.15/dist/cytoscape.js";
import coseBilkentLayout from "https://cdn.rawgit.com/cytoscape/cytoscape.js-cose-bilkent/1.0.5/cytoscape-cose-bilkent.js";
import { connect } from "lively.bindings";
coseBilkentLayout(cytoscape);

export class ObjectGraphVisualizer extends HTMLMorph {

  static renderSnapshotAndOpen(snapshot) {
    var viz = this.renderSnapshot(snapshot);
    viz.openInWindow({title: "object graph visualizer"});
    return viz;
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
    connect(this, 'extent', this, 'updateDebounced', {updater: ($upd, x, y) => $upd()});
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
