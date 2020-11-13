import { Color } from 'lively.graphics';

class DefaultTheme {
  static get instance () { return this._instance || (this._instance = new this()); }

  get background () { return Color.white; }

  get default () { return { fontColor: '#333' }; }

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

  get 'keyword' () { return { fontColor: '#708' }; }
  get 'atom' () { return { fontColor: '#219' }; }
  get 'number' () { return { fontColor: '#174' }; }
  get 'def' () { return { fontColor: '#22c' }; }
  get 'variable' () { return { fontColor: '#05a' }; }
  get 'punctuation' () { return { fontColor: '#05a' }; }
  get 'property' () { return { fontColor: '#222' }; }
  get 'operator' () { return { fontColor: '#05a' }; }
  get 'variable-2' () { return { fontColor: '#05a' }; }
  get 'variable-3' () { return { fontColor: '#085' }; }
  get 'comment' () { return { fontColor: '#666' }; }
  get 'string' () { return { fontColor: '#181' }; }
  get 'string-2' () { return { fontColor: '#0B2' }; }
  get 'meta' () { return { fontColor: '#555' }; }
  get 'qualifier' () { return { fontColor: '#555' }; }
  get 'builtin' () { return { fontColor: '#30a' }; }
  get 'bracket' () { return { fontColor: '#997' }; }
  get 'tag' () { return { fontColor: '#170' }; }
  get 'attribute' () { return { fontColor: '#333' }; }

  get 'error' () { return { backgroundColor: '#ff4c4c' }; }
  get 'invalidchar' () { return { backgroundColor: '#ff4c4c' }; }

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

export default DefaultTheme;
