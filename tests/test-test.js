import { expect } from "chai";

describe("test-test", function() {
  
  this.timeout(4000);

  it("runs 1", () =>
    expect(true).to.equal(true));

  it("runs 2", () =>
    new Promise((resolve, reject) => setTimeout(resolve, 2800))
      .then(() => show("runs 2") && expect(false).to.equal(true)));

  describe("inner", () => {
  
    it("runs 3", () =>
      expect(true).to.equal(true));
  
    it("runs 5", () =>
      new Promise((resolve, reject) => setTimeout(resolve, 2400)));
  
  });

  it("runs 6", () =>
    new Promise((resolve, reject) => setTimeout(resolve, 2400)));

});