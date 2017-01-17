/*global describe, it, beforeEach, afterEach*/
import { expect } from "mocha-es6";

import { connect } from "lively.bindings";



describe('clone test', function() {

  it("clone", function() {
    var obj1 = {}, obj2 = {};
    connect(obj1, 'a', obj2, 'a');
    var orig = obj1.attributeConnections[0];
    var clone = orig.clone();
    expect().assert(clone.isSimilarConnection(orig));
    expect(orig).deep.equals(clone);
  });

});


xdescribe('connection json serialization test', function() {

  it("obj connected to method deserialization", function() {
    var obj1 = {m: function m(arg) { this.b = arg }.asScript()},
      obj2 = {a: 5, ref: obj1};
    connect(obj2, 'a', obj1, 'm')
    obj2.a = 12;
    this.assertEquals(12, obj2.ref.b, 'connection not working');

    var jso = lively.persistence.Serializer.serialize(obj2),
      newObj2 = lively.persistence.Serializer.deserialize(jso);
    newObj2.a = 23;
    this.assertEquals(23, newObj2.ref.b, 'connection not working after deserialization');
  });
// 

  it("garbage collect attribute connection refs", function() {
    var objs = [{}, {}];
    connect(objs[0], 'foo', objs[1], 'bar');

    objs[0].foo = 15;
    this.assertEquals(15, objs[1].bar, "connection?");

    var serializer = lively.persistence.Serializer.createObjectGraphLinearizerForCopy();
    var copied = serializer.copy(objs[0]);

    this.assert(!copied.attributeConnections || !copied.attributeConnections.length,
    "attribute connections existing?!");

    this.assert(!objs[1][lively.persistence.ObjectGraphLinearizer.prototype.idProperty],
    "removed object not cleaned up!");
    // no error...
    copied.foo = 10;
  });
// 

  it("b garbage collect multiple attribute connection refs", function() {
    var objs = [{}, {}];
    connect(objs[0], 'foo', objs[1], 'bar');
    connect(objs[0], 'foo', objs[1], 'baz');

    objs[0].foo = 15;
    this.assertEquals(15, objs[1].bar, "connection?");

    var serializer = lively.persistence.Serializer.createObjectGraphLinearizerForCopy();
    var copied = serializer.copy(objs[0]);

    this.assert(!copied.attributeConnections, "attribute connections existing?!");
    // no error...
    copied.foo = 10;
  });
// 

  it("dont garbage collect attribute connection when direct ref exists", function() {
    var objs = [{}, {}];
    connect(objs[0], 'foo', objs[1], 'bar');

    objs[0].ref = objs[1];
    objs[0].foo = 15;
    this.assertEquals(15, objs[1].bar, "connection?")

    var serializer = lively.persistence.Serializer.createObjectGraphLinearizerForCopy();
    var copied = serializer.copy(objs[0]);

    this.assertIdentity(copied.ref, copied.attributeConnections[0].targetObj, "obj 2 is gone!");
    // no error...
    copied.foo = 10;
    this.assertEquals(10, copied.ref.bar, "connection of copy?")
  });
// 

  it("b dont garbage collect attribute connection when its flagged", function() {
    var objs = [{}, {}];
    connect(objs[0], 'foo', objs[1], 'bar', {garbageCollect: false});
    objs[0].foo = 15;
    var serializer = lively.persistence.Serializer.createObjectGraphLinearizerForCopy();
    var copied = serializer.copy(objs[0]);
    this.assert(!!lively.PropertyPath("attributeConnections.0.targetObj").get(copied), "obj 2 is gone!");
  });
// 
});


xdescribe('connection serialization test', function() {
// 
//   setUp: function($super) {
//     $super();
//     this.worldMorph = new lively.morphic.World();
//     this.worldMorph.addHandMorph();
//   },
// 
//   createAndAddMorphs: function() {
//     this.textMorph1 = new lively.morphic.Text(new Rectangle(20,400, 100, 30), 'abc');
//     this.textMorph2 = new lively.morphic.Text(new Rectangle(20,400, 100, 30), 'xyz');
//     this.worldMorph.addMorph(this.textMorph1);
//     this.worldMorph.addMorph(this.textMorph2);
//   },
// 
//   doSave: function() {
//     var stored = lively.persistence.Serializer.serialize(this.worldMorph), // WorldMorph is test specific
//       newWorld = lively.persistence.Serializer.deserialize(stored);
//     this.worldMorph = newWorld;
//     this.newTextMorph1 = newWorld.submorphs[0];
//     this.newTextMorph2 = newWorld.submorphs[1];
//   },
// 

  it("helper attribute is not serialized", function() {
    this.createAndAddMorphs();

    connect(this.textMorph1, 'textString', this.textMorph2, 'textString');
    this.textMorph1.setTextString('foo');
    this.assertEquals(this.textMorph1.textString, this.textMorph2.textString, 'connect not working');

    this.doSave();

    this.assertEquals(this.newTextMorph1.textString, 'foo', 'morph serialization problem');
    this.newTextMorph1.setTextString('bar');
    this.assertEquals(this.newTextMorph1.textString, this.newTextMorph2.textString, 'connect not working after deserialization');
    // ensure that serialization has cleaned up
    var c = this.newTextMorph1.attributeConnections[0];
    var setter1 = c.__lookupSetter__('sourceObj');
    var setter2 = c.__lookupSetter__('targetObj');
    this.assert(!setter1, 'serialization cleanup failure 1');
    this.assert(!setter2, 'serialization cleanup failure 2');
  });
// 

  it("converter is serialzed", function() {
    this.createAndAddMorphs();

    connect(this.textMorph1, 'textString', this.textMorph2, 'textString', {converter: function(v) { return v + 'foo' }});
    this.textMorph1.setTextString('foo');
    this.assertEquals('foofoo', this.textMorph2.textString, 'connect not working');

    this.doSave();

    this.assertEquals(this.newTextMorph1.textString, 'foo', 'morph serialization problem');
    this.newTextMorph1.setTextString('bar');
    this.assertEquals('barfoo', this.newTextMorph2.textString, 'connect not working after deserialization');
  });
// 

  it("updater is serialzed", function() {
    this.createAndAddMorphs();

    connect(this.textMorph1, 'textString', this.textMorph2, 'textString',
      {updater: function(proceed, newV, oldV) { proceed(oldV + newV) }});
    this.textMorph1.setTextString('foo');
    this.assertEquals('abcfoo', this.textMorph2.textString, 'updater not working');

    this.doSave();

    this.assertEquals(this.newTextMorph1.textString, 'foo', 'morph serialization problem');
    this.newTextMorph1.setTextString('bar');
    this.assertEquals('foobar', this.newTextMorph2.textString, 'connect not working after deserialization');
  });
//   xtest04DOMNodeIsSerialized: function() {
//     this.createAndAddMorphs();
//     var node = XHTMLNS.create('input');
//     this.worldMorph.rawNode.appendChild(node);
//     connect(this.textMorph1, 'textString', node, 'value')
//     this.textMorph1.setTextString('test');
//     this.assertEquals('test', node.value, 'node connection not working');
//     this.doSave();
//     // this.assert(node.getAttribute('id'), 'node hasnt gotten any id assigned');
//     var nodeAfter = this.worldMorph.rawNode.getElementsByTagName('input')[0];
//     this.assert(nodeAfter, 'cannot find node in DOM')
//     this.newTextMorph1.setTextString('test2');
//     this.assertEquals('test2', nodeAfter.value, 'connect not working after deserialization');
//   },

  it("method to method connection is serialized", function() {
    this.createAndAddMorphs();

    connect(this.textMorph1, 'getTextString', this.textMorph2, 'setTextString');
    this.textMorph1.setTextString('foo');
    this.textMorph1.getTextString(); // invoke connection
    this.assertEquals('foo', this.textMorph1.textString, 'connect not working 1');
    this.assertEquals('foo', this.textMorph2.textString, 'connect not working 2');

    this.doSave();

    this.newTextMorph1.setTextString('bar');
    this.newTextMorph1. getTextString(); // invoke connection
    this.assertEquals('bar', this.newTextMorph1.textString, 'connect not working after deserialize 1');
    this.assertEquals('bar', this.newTextMorph2.textString, 'connect not working after deserialize 2');
  });

  it("script to script connection is serialized", function() {
    this.createAndAddMorphs();

    this.textMorph1.addScript(function someScript1() { return 1 });
    this.textMorph2.addScript(function someScript2() { return 2 });

    connect(this.textMorph1, 'someScript1', this.textMorph2, 'someScript2');

    this.assertEquals(2, this.textMorph1.someScript1(), 'connect not working')
    this.doSave();

    this.assert(this.newTextMorph1.someScript1, 'script of source was not serialized');
    this.assertEquals(2, this.newTextMorph1.someScript1(), 'connect not working after deserialization');
  });

  it("empty spec properties not serialized", function() {
    this.createAndAddMorphs();
    connect(this.textMorph1, 'textString', this.textMorph2, 'textString');
    this.textMorph1.setTextString('foo');

    this.doSave();

    var c = this.newTextMorph1.attributeConnections[0];
    this.assert(!c.hasOwnProperty('converter'));
    this.assert(!c.hasOwnProperty('converterString'));
    this.assert(!c.hasOwnProperty('updater'));
    this.assert(!c.hasOwnProperty('updaterString'));
    this.assert(!c.hasOwnProperty('removeAfterUpdate'));
  });
});
