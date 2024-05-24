import { signal } from 'lively.bindings';
export class HashRouter {
  constructor () {
    // reacts to all changes of the URL that take place **inside** of the browser
    // this means changes to the URL that are triggered via pushState do not trigger this!
    window.addEventListener('popstate', () => {
      this.route(document.location.hash);
    });
  }

  /**
   * @param {string} hash - Hash to navigate to
   * @param {boolean} fromApplication - If set to true, the router is set from within the lively application.
   * By default, this is set to false, so the routing happens as a result of a URL change.
   * If the routing happens from inside of the application, we need to update the URL via `pushState`,
   * which we do not need to do if the URL change already took place to trigger the routing.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/History/pushState| pushState on MDN docs}
   */
  route (hash, fromApplication = false) {
    if (!hash || hash === '#') hash = '';
    if (hash.startsWith('#')) hash = hash.replace('#', '');

    const loc = window.location;
    const currentURLWithoutHash = loc.origin + loc.pathname + loc.search;
    if (fromApplication) {
      if (hash) window.history.pushState(null /* state */, null /* unused */, `${currentURLWithoutHash}#` + hash /* url */);
      else window.history.pushState(null /* state */, null /* unused */, `${currentURLWithoutHash}` /* url */);
    }

    signal(this, 'routed', hash);
  }
}
