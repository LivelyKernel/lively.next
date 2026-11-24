/* global System, describe, xdescribe, it, window */
import { expect } from 'mocha-es6';
import { localInterface } from 'lively-system-interface';
import { doSearch } from '../code-search.cp.js';
// code-search-probe-4b1e: the line that the search below finds

let describeInBrowser = System.get('@system-env').browser
  ? describe
  : (title, fn) => { console.warn(`Test "${title}" is currently only supported in a browser`); return xdescribe(title, fn); }; // eslint-disable-line no-console

describeInBrowser('global code search', function () {
  this.timeout(60 * 1000);

  it('searches unloaded modules with one request to the server', async () => {
    const requests = [];
    const { fetch } = window;
    window.fetch = function (url, opts = {}) {
      requests.push(`${(opts.method || 'GET').toUpperCase()} ${String(url)}`);
      return fetch.apply(this, arguments);
    };
    let items;
    try {
      // As the code search window searches "in loaded and unloaded modules", in lively.ide only.
      items = await doSearch(localInterface, 'code-search-probe-' + '4b1e', undefined,
        [url => !url.endsWith('/lively.ide')], true);
    } finally { window.fetch = fetch; }
    expect(requests.filter(req => req.startsWith('PROPFIND'))).deep.equals([]);
    expect(requests.filter(req => req.includes('__CODE_SEARCH__'))).to.have.length(1);
    const probe = items.find(item => item.value.line === 5);
    expect(probe.value).to.containSubset({
      moduleId: System.decanonicalize('lively.ide/tests/code-search-test.js'),
      packageName: 'lively.ide',
      pathInPackage: 'tests/code-search-test.js',
      column: 3
    });
    expect(probe.string).equals('lively.ide/tests/code-search-test.js:5// code-search-probe-4b1e: the line that the search below finds');
  });
});
