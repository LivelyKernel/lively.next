# changelog lively.ast

## 0.7.3
* adding ast.evalSupport.evalCodeTransform + ast.transform.transformSingleExpression from lively.vm

## 0.7.2

* made some performance improvements in query and capturing

## 0.7.1

* wrapInStartEndCall transformer, preparation for async eval
* improvement for returnLastStatement, now really using ast
* cleanup and *interface change*!!! of capturing.rewriteToCaptureTopLevelVariables It should now run more efficient...
* improving replacing nodes in capturing
* removing parseLikeOMeta

### 0.6.9

* fixing scope computation for default destrcutured params
* adding node creation helpers

## 0.6.8

* build with babel
* query.topLevelFuncDecls
* Parsing async / await code (including acorn walk AwaitExpression patch)
* visitors based on estree-visitor
* capturing exported vars – fixes
* fix printAst
* query.statementOf

## 0.6.7

* capture computed prop in object literal
* support capturing of object destrucuring var declarations a la var {x: [a,b,...c]} = foo
* fixes export default class and function capturing
* query.statementOf (3 minutes ago) <Robert Krahn>
