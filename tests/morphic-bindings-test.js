/*global declare, it, describe, beforeEach, afterEach, before, after*/

import { expect } from "mocha-es6";
import { pt, rect, Color } from "lively.graphics";
import { morph } from "lively.morphic";
import { connect } from "lively.bindings";

var sut;

describe("morphic bindings", function() {

  beforeEach(function() {
    sut = morph({bounds: rect(100,100,100,50)});
    
    sut.text = morph({type: "text", bounds: rect(100,100,100,50)});
    sut.addMorph(sut.text);

    connect(sut, 'position', sut.text, 'textString', {
      converter: pos => String(pos)}).update(pt(0,0));

    connect(sut, 'position', sut.text, 'fill', {
      converter: pos => Color.red,
      updater: ($proceed, newVal, oldVal) =>
        newVal.x > 200 ? $proceed(newVal, oldVal) : null
    }).update(pt(0,0));
  });

  afterEach(() => sut.remove());

  it("binding works", function() {
    var p = pt(50,50);
    sut.position = p;
    expect(sut.text.textString).equals(String(p))
  });

  it("duplicate binding", function() {
    var p = pt(50,50);
    var copy = sut.copy();
    expect(copy.attributeConnections.length)
      .equals(sut.attributeConnections.length, " number of attributes connections is broken");
    expect().assert(copy.attributeConnections[1].getTargetObj(), "no source object in copy");
    expect().assert(copy.attributeConnections[1].getTargetObj(), "no taget object in copy");
    expect(copy.submorphs[0]).not.equals(sut.text, "text object did not change");

    expect(copy.attributeConnections[1].getTargetObj()).equals(copy.submorphs[0], "no target object in copy");
    copy.position = p;
    expect(copy.submorphs[0].textString).equals(String(p));
  });

  it("attribute connections are duplicated", function() {
    var copy = sut.copy();
    expect().assert(sut.attributeConnections, "original has no connections");
    expect().assert(copy.attributeConnections, "copy has no connections");
    expect().assert(copy.attributeConnections !== sut.attributeConnections, "cconnections are not copied");
  });

  it("copy has observers", function() {
    expect().assert(sut.__lookupGetter__('position'), "original as no observer")
    var copy = sut.copy();
    expect().assert(copy.__lookupGetter__('position'), "copy as no observer")

  });

  it("updater is copied", function() {
    expect().assert(sut.attributeConnections[1].getUpdater(), "no update in fillConnection");
    var copy = sut.copy();
    expect().assert(copy.attributeConnections[1].getUpdater(), "no update in fillConnection copy");
  });

});
