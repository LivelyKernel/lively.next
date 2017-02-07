/*global Map, System*/
// extensions to native JS objects to support serialization


Object.defineProperty(Symbol.prototype, "__serialize__", {
  configurable: true,
  value: (() => {
    const knownSymbols = (() =>
            Object.getOwnPropertyNames(Symbol)
              .filter(ea => typeof Symbol[ea] === "symbol")
              .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))(),
          symMatcher = /^Symbol\((.*)\)$/;

    return function() {
      // turns a symbol into a __expr__ object.
      var sym = typeof this[Symbol.toPrimitive] === "function" ?
                  this[Symbol.toPrimitive]() : this,
          symKey = Symbol.keyFor(sym);
      if (symKey) return {__expr__: `Symbol.for("${symKey}")`};
      if (knownSymbols.get(sym)) return {__expr__: knownSymbols.get(sym)};
      var match = String(sym).match(symMatcher)
      return {__expr__: match ? `Symbol("${match[1]}")` : "Symbol()"};
    }
  })()
});

Object.defineProperty(System, "__serialize__", {
  configurable: true,
  value: () => ({__expr__: "System"})
});

Object.defineProperty(System.global, "__serialize__", {
  configurable: true,
  value: () => ({__expr__: "System.global"})
});
