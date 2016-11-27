# changelog lively.ast

## 0.8.0
 - remove old lively globals from default known globals.
    This is a BREAKING CHANGE i.e. this will break use of lively.ast in
    LivelyKernel. From this point on forward this lively.ast package is only
    suitable for usage in lively.next packages!!!
- fix recogizing vars that are default args in function params

## 0.7.46
- better code categorizer

## 0.7.44
- improved parser error messages

## 0.7.42
- improve how export vars are captured

## 0.7.41
- fix scope visitor for new.target
## 0.7.40
- switching to new version of escodegen that fixes lively.vm/issues#6

## 0.7.38
- class transform: only use class holder for class declarations
- don't report export froms as undeclared refs
- add declaration wrapper to class def
- add declaration wrapper to assignment

## 0.7.37
- acorn@4

## 0.7.36

- don't capture destructured vars in for loops, such as "for (let x [a,b] of ...) ..."

## 0.7.35
 - properly transforming super access in static methods

## 0.7.34
- fixing acorn.walk usage


## 0.7.33
- dont use arguments access when initializing class

## 0.7.32
- more class transform fixes

## 0.7.31
- fixing lookup of existing classes to not overwrite globals accidentally

## 0.7.30
- alternative class-to-function-transform that supports super getters and setters and doesn't require injecting the class object into methods

## 0.7.29
- transforming es6 classes so that declaring class gets passed into function when super call is needed (+ making sure that magic "arguments" array is properly fixed in those cases)



## 0.7.27
- objectSpreadTransform
- fixing class tests
- scope query: ensure resolveMap
- acorn-object-spread
- estree: obj spread support
- es6 classes: assign name to methods


## 0.7.26
- scope resolve references fix for export stmt with source
- safeResolveReferences -> resolveReferences
- query: finding decls for references without AST modifications
- class transform: optionally producing reference info that is passed into createOrExtendClass in order to track module context state via subscription to module changes
- query: safeResolveReferences
- node creation helpers: logical, ifStmt
- Merge pull request #6 from LivelyKernel/exports-not-resolved-by-default (only resolve exports when asked to)

## 0.7.24
- reverting to old knownGlobals for now as the removal of lively Globals causes trouble with the ObjectEditor

## 0.7.23
- build for fixing the freeze issues
- remove deepCopy because tree could have cycles


## 0.7.22

- Merge pull request #4 from LivelyKernel/capture-shorthand-object-properties
  - ensure keys of shorthand properties are not renamed while capturing
- code-categorizer: initial implementation for categorizing es6 classes, proper differentiation between method/property types is still missing
- report both declarations and ids for bindings
- added imported name of re-exported variables to exports()
- exports now return local declaration and identifier node
- added imports/exports from lively.modules
- changed API to improve finding refs by position
- resolve references to their declarations
- fix cycle bug by not re-using AST nodes
- updating acorn to 3.2.0


## 0.7.21
- removing "module" as a global
- class transform: adds module accessor expression + only capture class in module varRecorder if class is a top-level declaration
- findReferencesAndDeclsInScope: find this
- findReferencesAndDeclsInScope: find classes

## 0.7.20
- manual imports and exports (for eval) capture correctly

## 0.7.18
- don't shadow lexical bindings in class methods

## 0.7.17
- automatically applying classToFunction transform on rewriteToCaptureTopLevelVariables
- making class-to-function-transform work for export default + adding var decls automatically for class declarations
- moving eval support over to lively.vm

## 0.7.16
- capturing class expressions in assignments
- objectliteral creation helpr
- class to function transform
- objectLiteral helper

## 0.7.13
- disabling keeping values of var declarations for now (don't merge arbitrary expressions...!)
- fix capturing export functions
- capturing: fix wrapping destrucured vars
- eval transform wrap in func: pass last var decl into function as result

- 0.7.12
- fix rewriting classes (in combination with declaration wrappers)
- moving declarationWrapper logic and options.keepPreviouslyDeclaredValues processing from lively.vm into  eval-support.js

## 0.7.11
- fix for rewriteToRegisterModuleToCaptureSetters
- hoisting func decls and their catpures to the top of a scope

## 0.7.10
- ensure existing variables won't get undefined

## 0.7.8
- adding the ability to add an declarationWrapper to captured declarations, to inject a function call, e.g. for allowing lazy initialization. Works for classes, vars, and functions.

## 0.7.6
- replacing reduces with for loops for efficiency
- query/capturing: ignoring class expressions when gathering scope + rewriting, fixes LivelyKernel/lively.modules#8
- special transform for 'export default async function', fixes LivelyKernel/lively.modules#9
- correctly capturing export default function statements

## 0.7.4

fixing capturing issue: var x = {..}; export default x; (5 months ago) <Robert Krahn>

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
