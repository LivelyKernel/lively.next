/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { subscribe, emit, unsubscribeAll } from "../index.js";

describe("notifications", () => {
  
  let messages;
  
  beforeEach(() => {
    messages = [];
  });

  afterEach(() => {
    unsubscribeAll("@test");
  });
  
  it("calls event handler for type", () => {
    subscribe("@test", data => messages.push(data));
    emit("@test", {payload: 23});
    expect(messages).to.containSubset([{type: "@test", payload: 23}]);
  });

});
