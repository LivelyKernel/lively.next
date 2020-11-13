import JavaScriptEditorPlugin from '../js/editor-plugin.js';
import JSONChecker from './checker.js';
import { getMode } from '../editor-modes.js';
import { query } from 'lively.ast';
import { PackageJSONCompleter } from './completers.js';

export default class JSONEditorPlugin extends JavaScriptEditorPlugin {
  constructor () {
    super();
    this.checker = new JSONChecker();
  }

  parse (astType = null) {
    if (this._ast && this._ast._astType === astType) { return this._ast; }
    let {
      parser,
      textMorph: { textString: src }
    } = this;
    if (!parser) { return null; }
    const options = {
      withComments: true,
      allowReturnOutsideFunction: true
    };
    if (astType) { options.type = astType; }
    if (src.startsWith('#!')) {
      const firstLineEnd = src.indexOf('\n');
      src = ' '.repeat(firstLineEnd) + src.slice(firstLineEnd);
    }
    src = `(${src})`; // wrap in braces for valid js statemnet
    const parsed = parser.fuzzyParse(src, options);
    parsed._astType = astType;
    this._ast = parsed;
    return parsed;
  }

  tokenAt (pos) {
    return query.nodesAt(this.textMorph.positionToIndex(pos) - 1, this._ast);
  }

  get isJSONEditorPlugin () { return true; }
  get shortName () { return 'json'; }
  get longName () { return 'json'; }

  codeMirrorMode (textMorph) {
    const config = this.defaultCodeMirrorModeConfig(textMorph);
    return getMode(config, { name: 'javascript', json: true });
  }

  getCompleters (otherCompleters) {
    return [...super.getCompleters(otherCompleters), new PackageJSONCompleter()];
  }
}
