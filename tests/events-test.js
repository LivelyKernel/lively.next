/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import { makeEmitter } from "../events.js";

describe('events', function() {

  it('allows to add event interface to objects', function() {
    var obj = makeEmitter({});
    expect(typeof obj.on).to.equal('function');
    expect(typeof obj.once).to.equal('function');
    expect(typeof obj.removeListener).to.equal('function');
    expect(typeof obj.removeAllListeners).to.equal('function');
    expect(typeof obj.emit).to.equal('function');
  });

  it('emits events', function() {
    var obj = makeEmitter({});
    var emittedData = "";
    obj.on("test", function(evt) { emittedData += evt; });
    obj.emit("test", "Hello");
    obj.emit("test", "World");
    expect(emittedData).to.equal("HelloWorld");
  });

  it('emits events once', function() {
    var obj = makeEmitter({});
    var emittedData = "";
    obj.once("test", function(evt) { emittedData += evt; });
    obj.emit("test", "Hello");
    obj.emit("test", "World");
    expect(emittedData).to.equal("Hello");
  });

  it('allows to remove a specific handler', function() {
    var obj = makeEmitter({});
    var emittedData1 = "", emittedData2 = "";
    function listener1(evt) { emittedData1 += evt; }
    function listener2(evt) { emittedData2 += evt; }
    obj.on("test", listener1);
    obj.on("test", listener2);
    obj.emit("test", "Hello");
    obj.removeListener("test", listener1);
    obj.emit("test", "World");
    expect(emittedData1).to.equal("Hello");
    expect(emittedData2).to.equal("HelloWorld");
  });

  it('allows to remove all handlers', function() {
    var obj = makeEmitter({});
    var emittedData1 = "", emittedData2 = "";
    obj.on("test", function(evt) { emittedData1 += evt; });
    obj.on("test", function(evt) { emittedData2 += evt; });
    obj.emit("test", "Hello");
    obj.removeAllListeners("test");
    obj.emit("test", "World");
    expect(emittedData1).to.equal("Hello");
    expect(emittedData2).to.equal("Hello");
  });

  it('multiple makeEmitter calls have no unwanted effect', function() {
    var obj = makeEmitter({});
    var emittedData = "";
    obj.on("test", function(evt) { emittedData += evt; });
    makeEmitter(obj);
    obj.emit("test", "Hello");
    expect(emittedData).to.equal("Hello");
  });

  // it('invokes identical handler only once even if added multiple times', function() {
  //   var obj = makeEmitter({});
  //   var emittedData = "";
  //   function listener(evt) { emittedData += evt; }
  //   obj.on("test", listener);
  //   obj.on("test", listener);
  //   obj.emit("test", "Hello");
  //   expect(emittedData).to.equal("Hello");
  // });

});
