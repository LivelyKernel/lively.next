/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { startRecording, stopRecording, clearRecord, emit, getNotifications } from "../index.js";

describe("record", () => {
  
  beforeEach(() => {
    clearRecord();
    startRecording();
  });

  afterEach(() => {
    stopRecording();
  });
  
  it("notifications", () => {
    emit("@test", {payload: 23});
    expect(getNotifications()).to.containSubset([{type: "@test", payload: 23}]);
  });
  
  it("notifications unless stopped", () => {
    stopRecording();
    emit("@test", {payload: 23});
    expect(getNotifications().length).to.deep.equal(0);
  });

  it("multiple notifications", () => {
    emit("@test", {payload: 23});
    emit("@test", {payload: 42});
    expect(getNotifications().length).to.deep.equal(2);
  });

  it("multiple notifications unless limit", () => {
    getNotifications().limit = 1;
    emit("@test", {payload: 23});
    emit("@test", {payload: 42});
    expect(getNotifications().length).to.deep.equal(1);
  });
});
