# lively.modules changelog

## 0.5.1

* don't re-execute modules once a dependant changes, just update the module bindings(!)
* instrument System.register setters to capture (and update) module bindings
* don't freeze modules by default to allow adding new exports without reloading dependent modules
* export fixes for async transformation. babel async transformer is
  surprisingly fragile as to where async functions are placed, in lively.ast and
  lively.modules we have some manual "hoisting" now to work around these issues
* support systemjs 0.19.30 + systemjs-babel-plugin for using babel@6
* fix wrapping nodejs modules as es6 modules
* replacing System["__lively.modules__"] with System.get("@lively-env")
* - dont rewrite "fetch" as it is a function that apparently cannot be called as a method from a dereived global

## 0.4.1

* removing runEval (!) – es6 aware eval resides now in lively.vm also removing
  lively.vm dependency, evalCodeTrasnform() that is needed for code
  instrumentation lives now in lively.ast and is loaded from there
* adding lively.modules.getPackages
* removing lively.modules.knownPackages
* fetch_lively_protocol fix
* adding tests/run-tests.html for browser-based testing outside of Lively
* adding dist/lively.modules-with-lively.vm.js

## 0.3.5

* async / await support!
* requiring babel-regenerator-runtime
* fetch lively:// protocol for lively workspaces ("virtual modules", not backed by files)
* runEval fix for setting this (via options.context)

## 0.2.2

* capturing improvements (computed prop in object literal, capturing of object
  destructuring var decls, fixes export default class and function capturing)

## 0.2.1

* notifications and logging of module changes and doits, see src/notify.js
* dist build compiled via babel
* better support for modifying + evaluating in modules in global format (there are still issues when automatically reloading and re-distributing exports, though)

## 0.2.0

* First offical release, proper readme, doc and examples

## 0.1.7

* recording fixes (properties not writable, non-enumerable)
* fix importsAndExportsOf

## 0.1.6

* mocha test fix

## 0.1.0

* basics: instrument and modify SystemJS' System object
* package support via package.json convention, package based mapping and name resolution
* instrumentation of module code for maintaining internal state
* hooks to customize System object
* ...