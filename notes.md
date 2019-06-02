# tasks

## writing the lib

- [ ] comments
- [ ] source maps
- [X] lively.ast.query
- [X] lively.ast.transform
- [ ] create documentation

## lively integration

- [ ] map lib objects to lively interface

## extracting the VM part

- make own lib?
- [ ] lively.lang.VM

<!---=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--->

# lib stuff

## core

/home/lively/LivelyKernel/core/lively/ast/acorn.js
/home/lively/LivelyKernel/core/lively/ast/AstHelper.js
/home/lively/LivelyKernel/core/lively/ast/MozillaAST.js
/home/lively/LivelyKernel/core/lively/ast/tests/AstTests.js
/home/lively/LivelyKernel/core/lively/ast/tests/AcornTests.js

## comments

/home/lively/LivelyKernel/core/lively/ast/Comments.js
/home/lively/LivelyKernel/core/lively/ast/tests/Comments.js

## source maps
/home/lively/LivelyKernel/core/lively/ast/SourceMap.js
/home/lively/LivelyKernel/core/lively/ast/tests/SourceMapTests.js
=> lib/source-map.js, tests/source-map-test.js [ ]

## responsibilities

### env.js

- sets up `lively.ast`, for lively and non-lively envs

### index.js

- imports acorn
- implements parsing interface:
    - `lively.ast.acorn`
    - `lively.ast.parse`
    - `lively.ast.parseFunction`
    - `lively.ast.parseLikeOMeta`
    - `lively.ast.fuzzyParse`
    - `lively.ast.nodesAt`

### lib/acorn-extension.js

- extends `acorn.walk` 
  - `acorn.walk.forEachNode`
  - `acorn.walk.matchNodes`
  - `acorn.walk.findNodesIncluding`
  - `acorn.walk.addSource`
  - `acorn.walk.inspect`
  - `acorn.walk.withParentInfo`
  - `acorn.walk.toLKObjects`
  - `acorn.walk.copy`
  - `acorn.walk.findSiblings`
  - `acorn.walk.visitors`
  - `acorn.walk.findNodeByAstIndex`
  - `acorn.walk.findStatementOfNode`
  - `acorn.walk.addAstIndex`

### lib/mozilla-ast-visitors.js, lib/mozilla-ast-visitor-interface.js

- definition of various ast visitors, not a public interface
  - `lively.ast.MozillaAST.BaseVisitor`
  - `lively.ast.MozillaAST.PrinterVisitor`
  - `lively.ast.MozillaAST.ComparisonVisitor`
  - `lively.ast.MozillaAST.ScopeVisitor`

- interface for traversing mozilla-like ASTs
  - `acorn.withMozillaAstDo`
  - `acorn.printAst`
  - `acorn.compareAst`
  - `acorn.pathToNode`
  - `acorn.rematchAstWithSource`
  - `acorn.stringify`

### lib/query.js

- retrieve information from ASTs, defines JS scopes and provides scope-based queries
- partly very specific methods, e.g. to gather top level var declarations, globals
- uses mozilla visitors, acorn interface
- interface
    - `query.scopes`
    - `query.nodesAtIndex`
    - `query.scopesAtIndex`
    - `query.scopeAtIndex`
    - `query.scopesAtPos`
    - `query.nodesInScopeOf`
    - `query.topLevelDeclsAndRefs`
    - `query.findGlobalVarRefs`
    - `query.findNodesIncludingLines`
    - `query.findReferencesAndDeclsInScope`
    - `query.findDeclarationClosestToIndex`

### lib/transform.js

- transforming, rewriting ASTs, e.g. for injection of instrumentation code
- interface
    - `transform.replace`
    - `transform.replaceTopLevelVarDeclAndUsageForCapturing`
    - `transform.oneDeclaratorPerVarDecl`
    - `transform.returnLastStatement`
    - `transform.wrapInFunction`

## tests cover

- acorn-extension-test.js
  - seems to cover stuff from index.js, lib/mozilla-ast-visitors.js, lib/acorn-extension.js
  - `lively.ast.parse`
  - `ast.acorn.rematchAstWithSource`
  - `ast.acorn.withMozillaAstDo`
  - `acorn.walk.findStatementOfNode`
  - `acorn.walk.findNodeByAstIndex`
  - `acorn.walk.findSiblings`

- tests/interface-test.js
  - `lively.ast.parse`

- tests/query.js
  - `lively.ast.query`

- tests/transform.js
  - `lively.ast.transform`

<!---=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--->

# lively only, for now
/home/lively/LivelyKernel/core/lively/ast/StackReification.js
/home/lively/LivelyKernel/core/lively/ast/Rewriting.js
/home/lively/LivelyKernel/core/lively/ast/tests/RewriterTests.js

/home/lively/LivelyKernel/core/lively/ast/Debugging.js

/home/lively/LivelyKernel/core/lively/ast/Visualization.js

/home/lively/LivelyKernel/core/lively/ast/AcornInterpreter.js
/home/lively/LivelyKernel/core/lively/ast/tests/InterpreterTests.js

<!---=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=--->

# deprecated

## JS Parser, OMeta based

/home/lively/LivelyKernel/core/lively/ast/LivelyJSParser.ometa
/home/lively/LivelyKernel/core/lively/ast/LivelyJSParser.js
/home/lively/LivelyKernel/core/lively/ast/Parser.js
/home/lively/LivelyKernel/core/lively/ast/generated/Translator.ometa
/home/lively/LivelyKernel/core/lively/ast/generated/Translator.js
/home/lively/LivelyKernel/core/lively/ast/generated/Nodes.js

## Interpreter

/home/lively/LivelyKernel/core/lively/ast/DeprecatedInterpreter.js
/home/lively/LivelyKernel/core/lively/ast/tests/DeprecatedJSParserTests.js

## Debugging, cschuster

/home/lively/LivelyKernel/core/lively/ast/IDESupport.js
/home/lively/LivelyKernel/core/lively/ast/DeprecatedMorphic.js
/home/lively/LivelyKernel/core/lively/ast/DebugExamples.js
/home/lively/LivelyKernel/core/lively/ast/tests/OldDebuggerTests.js
