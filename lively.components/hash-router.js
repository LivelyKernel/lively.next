import { signal } from 'lively.bindings';
export class HashRouter {
  constructor (props) {
    const { prefix, debugMode } = props;
    this.prefix = prefix;
    this.debugMode = debugMode;
    // reacts to all changes of the URL that take place **inside** of the browser
    // this means changes to the URL that are triggered via pushState do not trigger this!
    window.addEventListener('popstate', () => {
      this.route(document.location.hash);
    });
  }

  route (hash, external = false) {
    if (!hash || hash === '#') hash = '';
    if (hash.startsWith('#')) hash = hash.replace('#', '');

    const loc = window.location;
    const currentURLWithoutHash = loc.origin + loc.pathname + loc.search;
    if (external) {
      if (this.prefix || hash) window.history.pushState(null /* state */, null /* unused */, `${currentURLWithoutHash}#${this.prefix || ''}` + hash /* url */);
      else window.history.pushState(null /* state */, null /* unused */, `${currentURLWithoutHash}` /* url */);
    }

    signal(this, 'routed', hash);
  }
}
