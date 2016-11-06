import * as escodegen from "escodegen";

var es = escodegen.escodegen || escodegen;

export { es as escodegen }

export default function stringify(node, opts) {
  return es.generate(node, opts);
}
