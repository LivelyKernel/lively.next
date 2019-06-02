# lively.ast [![Build Status](https://travis-ci.org/LivelyKernel/lively.ast.svg)](https://travis-ci.org/LivelyKernel/lively.ast)

Parsing JS code into ASTs and tools to query and transform these trees.

## API

### main interface

- `ast.printAst`
- `ast.compareAst`
- `ast.pathToNode`
- `ast.stringify`
- `ast.parse`
- `ast.parseFunction`
- `ast.fuzzyParse`
- `ast.nodesAt`
- `ast.withMozillaAstDo`

### Visitors

- `ast.MozillaAST.BaseVisitor`
- `ast.MozillaAST.PrinterVisitor`
- `ast.MozillaAST.ComparisonVisitor`
- `ast.MozillaAST.ScopeVisitor`

### query ast nodes

- `ast.query.knownGlobals`
- `ast.query.scopes`
- `ast.query.nodesAtIndex`
- `ast.query.scopesAtIndex`
- `ast.query.scopeAtIndex`
- `ast.query.scopesAtPos`
- `ast.query.nodesInScopeOf`
- `ast.query.topLevelDeclsAndRefs`
- `ast.query.findGlobalVarRefs`
- `ast.query.findNodesIncludingLines`
- `ast.query.findReferencesAndDeclsInScope`
- `ast.query.findDeclarationClosestToIndex`

### transform asts

- `ast.transform.replace`
- `ast.transform.replaceTopLevelVarDeclAndUsageForCapturing`
- `ast.transform.oneDeclaratorPerVarDecl`
- `ast.transform.oneDeclaratorForVarsInDestructoring`
- `ast.transform.returnLastStatement`
- `ast.transform.wrapInFunction`

### comment parsing

- `ast.comments.extractComments`

### code categorizer, scan code for known constructs

- `ast.codeCategorizer.findDecls`

<!---=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--->

## Usage

### node.js

```js
require('lively.lang')
var ast = require('lively.ast'),
    parsed = ast.parse("1 + 2");
ast.printAst(parsed);
// =>
// :Program
// \-.body[0]:ExpressionStatement
//   \-.body[0].expression:BinaryExpression
//     |-.body[0].expression.left:Literal
//     \-.body[0].expression.right:Literal
...
```

### browser

HTML:
```html
<script src="node_modules/dist/lively.lang.js"></script>
<script src="dist/lively.ast.js"></script>
```

JS: like above

<!---=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--->

## Development

### build dist

`npm run build`

### Testing

`npm test`

<!---=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--->

## LICENSE

MIT
