/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { subscribe, emit, unsubscribe, unsubscribeAll } from "../index.js";

describe("subscriptions", () => {
  
  let messages;
  
  beforeEach(() => {
    messages = [];
  });

  afterEach(() => {
    unsubscribeAll("@test");
  });
  
  it("call handlers for emitted notifications", () => {
    subscribe("@test", data => messages.push(data));
    emit("@test", {payload: 23});
    expect(messages).to.containSubset([{type: "@test", payload: 23}]);
  });
  
  it("can be unsubscribed", () => {
    const handler = data => messages.push(data);
    subscribe("@test", handler);
    unsubscribe("@test", handler);
    emit("@test", {payload: 23});
    expect(messages).to.containSubset([]);
  });
  
  it("for all handlers can be unsubscribed", () => {
    const handler = data => messages.push(data);
    subscribe("@test", handler);
    unsubscribeAll("@test");
    emit("@test", {payload: 23});
    expect(messages).to.containSubset([]);
  });

});
