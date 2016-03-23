// import { escodegen } from "escodegen";
import * as escodegen from "escodegen";

var es = escodegen.escodegen || escodegen;

export default function stringify(node, opts) {
  return es.generate(node, opts);
}

export { es as escodegen }