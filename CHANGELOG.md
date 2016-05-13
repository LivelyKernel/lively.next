# lively.modules changelog

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