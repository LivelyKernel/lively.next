import { Color } from 'lively.graphics';

class DarkTheme {
  static get instance () { return this._instance || (this._instance = new this()); }

  get background () { return Color.rgb(44, 62, 80); }

  get cursorColor () { return Color.gray; }

  get default () { return { fontColor: '#abb2bf' }; }

  get header () { return { fontSize: '110%', fontColor: '#6b94ee' }; }
  get 'header-1' () { return { fontSize: '135%', fontColor: '#6b94ee' }; }
  get 'header-2' () { return { fontSize: '125%', fontColor: '#6b94be' }; }
  get 'header-3' () { return { fontSize: '120%', fontColor: '#6b94be' }; }
  get quote () { return { fontColor: '#090' }; }
  get negative () { return { fontColor: '#d44' }; }
  get positive () { return { fontColor: '#292' }; }
  get strong () { return { fontWeight: 'bold' }; }
  get em () { return { fontStyle: 'italic' }; }
  get link () { return { textDecoration: 'underline' }; }
  get strikethrough () { return { textDecoration: 'line-through' }; }
  get 'hr' () { return { fontColor: '#999' }; }
  get 'link' () { return { textDecoration: 'underline', fontColor: '#2c2cff' }; }
  get 'url' () { return { textDecoration: 'underline', fontColor: '#2c2cff' }; }

  get 'keyword' () { return { fontColor: Color.rgb(204, 109, 243) }; }
  get 'atom' () { return { fontColor: '#d19a66' }; }
  get 'number' () { return { fontColor: Color.orange }; }
  get 'def' () { return { fontColor: '#e5c07b' }; }
  get 'variable' () { return { fontColor: '#d19a66' }; }
  get 'punctuation' () { return { fontColor: '#05a' }; }
  get 'property' () { return { fontColor: Color.rgb(33, 150, 243) }; }
  get 'operator' () { return { fontColor: '#abb2bf' }; }
  get 'variable-2' () { return { fontColor: '#e06c75' }; }
  get 'variable-3' () { return { fontColor: '#085' }; }
  get 'comment' () { return { fontColor: '#7F848E' }; }
  get 'string' () { return { fontColor: '#98c378' }; }
  get 'string-2' () { return { fontColor: '#98c378' }; }
  get 'meta' () { return { fontColor: '#555' }; }
  get 'qualifier' () { return { fontColor: '#d19a66' }; }
  get 'builtin' () { return { fontColor: '#30a' }; }
  get 'bracket' () { return { fontColor: '#515a6b' }; }
  get 'brace' () { return { fontColor: '#abb2bf' }; }
  get 'tag' () { return { fontColor: '#170' }; }
  get 'attribute' () { return { fontColor: '#d19a66' }; }

  get 'error' () { return { backgroundColor: Color.rgba(255, 76, 76, 0.8) }; }
  get 'invalidchar' () { return { backgroundColor: '#ff4c4c' }; }
  get 'warning' () { return { 'border-bottom': '2px dotted orange' }; }

  get 'diff-file-header' () {
    return {
      fontColor: Color.white,
      fontWeight: 'bold',
      backgroundColor: Color.rgba(136, 136, 136, 0.7)
    };
  }

  get 'diff-hunk-header' () {
    return {
      backgroundColor: Color.rgba(204, 204, 204, 0.4),
      fontWeight: 'bold'
    };
  }

  get 'coord' () { return { backgroundColor: Color.rgba(204, 204, 204, 0.4), fontWeight: 'bold' }; }
  get 'inserted' () { return { backgroundColor: 'rgba(108,255,108, .3)' }; }
  get 'deleted' () { return { backgroundColor: 'rgba(255,108,108, .3)' }; }
}

export default DarkTheme;
