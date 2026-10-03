export function installShallowDeepEqual (chai) {
  if (chai.__livelyContextShallowDeepEqual) return;
  chai.__livelyContextShallowDeepEqual = true;

  const eql = chai.util.eql;

  function shallowDeepEqual (actual, expected) {
    if (eql(actual, expected)) return true;
    if (!expected || typeof expected !== 'object') return false;
    if (!actual || typeof actual !== 'object') return false;
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual) || actual.length !== expected.length) return false;
      return expected.every((ea, i) => shallowDeepEqual(actual[i], ea));
    }
    return Object.keys(expected)
      .every(key => shallowDeepEqual(actual[key], expected[key]));
  }

  function print (value) {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }

  chai.Assertion.addMethod('shallowDeepEqual', function (expected) {
    const actual = this._obj;
    this.assert(
      shallowDeepEqual(actual, expected),
      `expected ${print(actual)} to shallow-deep equal ${print(expected)}`,
      `expected ${print(actual)} not to shallow-deep equal ${print(expected)}`
    );
  });
}
