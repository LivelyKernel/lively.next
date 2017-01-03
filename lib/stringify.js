import { obj } from "lively.lang";
import * as escodegen from "escodegen";

var es = escodegen.escodegen || escodegen;

export { es as escodegen }

export default function stringify(node, opts = {}) {
  var optsIndent = (opts && opts.format && opts.format.indent) || {}
  var indent = {
    style: "  ",
    base: 0,
    adjustMultilineComment: false,
    optsIndent
  }

  var optsFormat = (opts && opts.format) || {}
  var format = {
    indent,
    quotes: "double",
    ...obj.dissoc(optsFormat, ["indent"])
  }

  opts = {
    format,
    comment: false,
    ...obj.dissoc(opts, ["format"])
  };

  return es.generate(node, opts);
}
