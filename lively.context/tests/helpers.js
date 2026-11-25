/** Adds `shallowDeepEqual`: every property of `expected` (arrays: every element, same length) matches `actual`. */
export function installShallowDeepEqual (chai) {
  const matches = (actual, expected) => chai.util.eql(actual, expected) || !!expected && typeof expected === 'object' &&
    !!actual && typeof actual === 'object' && (!Array.isArray(expected) || Array.isArray(actual) && actual.length === expected.length) &&
    Object.keys(expected).every(key => matches(actual[key], expected[key]));
  chai.Assertion.addMethod('shallowDeepEqual', function (expected) {
    this.assert(matches(this._obj, expected), 'expected #{this} to shallow-deep equal #{exp}',
      'expected #{this} not to shallow-deep equal #{exp}', expected);
  });
}

/** Runs several garbage collections; retention cases need `globalThis.gc` (node --expose-gc, the headless TestRunner). */
export async function collectGarbage () {
  if (typeof globalThis.gc !== 'function') throw new Error('retention tests require the GC-enabled headless TestRunner');
  for (let i = 0; i < 5; i++) { await new Promise(resolve => setTimeout(resolve, 0)); globalThis.gc(); }
}
