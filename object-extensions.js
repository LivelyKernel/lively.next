// extensions to native JS objects to support serialization


Object.defineProperty(Symbol.prototype, "__serialize__", {
  configurable: true,
  value: (() => {
    const knownSymbols = (() =>
      Object.getOwnPropertyNames(Symbol)
        .filter(ea => typeof Symbol[ea] === "symbol")
        .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))();
    const symMatcher = /^Symbol\((.*)\)$/;

    return function() {
      // turns a symbol into a __expr__ object.
      if (Symbol.keyFor(this)) return {__expr__: `Symbol.for("${Symbol.keyFor(this)}")`};
      if (knownSymbols.get(this)) return {__expr__: knownSymbols.get(this)};
      var match = String(this).match(symMatcher)
      return {__expr__: match ? `Symbol("${match[1]}")` : "Symbol()"};
    }
  })()
});

Object.defineProperty(System, "__serialize__", {
  configurable: true,
  value: () => ({__expr__: "System"})
});

