import { obj } from 'lively.lang';
import * as escodegen from 'escodegen';

const es = escodegen.escodegen || escodegen;

export { es as escodegen };

export default function stringify (node, opts = {}) {
  const optsIndent = (opts && opts.format && opts.format.indent) || {};
  const indent = {
    style: '  ',
    base: 0,
    adjustMultilineComment: false,
    optsIndent
  };

  const optsFormat = (opts && opts.format) || {};
  const format = {
    indent,
    quotes: 'double',
    ...obj.dissoc(optsFormat, ['indent'])
  };

  opts = {
    format,
    comment: false,
    ...obj.dissoc(opts, ['format'])
  };

  return es.generate(node, opts);
}
