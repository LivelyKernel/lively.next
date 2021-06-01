/* global require, __dirname */

import * as lang from 'lively.lang';
import { signatureOf, pluck, safeToString, printSymbol } from './util.js';

// helper

export function getObjectForCompletion (evalFunc, stringToEval) {
  let startLetters = '';
  return Promise.resolve().then(() => {
    // thenDo = function(err, obj, startLetters)
    let idx = stringToEval.lastIndexOf('.');
    if (idx >= 0) {
      startLetters = stringToEval.slice(idx + 1);
      stringToEval = stringToEval.slice(0, idx);
    } else {
      startLetters = stringToEval;
      stringToEval = '(typeof window === "undefined" ? global : window)';
    }
    return evalFunc(stringToEval);
  })
    .then(evalResult => ({
      evalResult: evalResult,
      startLetters: startLetters,
      code: stringToEval
    }));
}

function propertyExtract (excludes, obj, extractor) {
  return Object.getOwnPropertyNames(obj)
    .concat(Object.getOwnPropertySymbols(obj).map(printSymbol))
    .filter(key => excludes.indexOf(key) === -1)
    .map(extractor)
    .filter(ea => !!ea)
    .sort((a, b) => a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));
}

function getMethodsOf (excludes, obj) {
  return propertyExtract(excludes, obj, function (key) {
    if ((obj.__lookupGetter__ && obj.__lookupGetter__(key)) || typeof obj[key] !== 'function') return null;
    return { name: key, completion: signatureOf(key, obj[key]) };
  });
}

function getAttributesOf (excludes, obj) {
  return propertyExtract(excludes, obj, function (key) {
    if ((obj.__lookupGetter__ && !obj.__lookupGetter__(key)) && typeof obj[key] === 'function') return null;
    return { name: key, completion: key };
  });
}

function getProtoChain (obj) {
  let protos = []; let proto = obj;
  while (obj) { protos.push(obj); obj = obj.__proto__; }
  return protos;
}

function getDescriptorOf (originalObj, proto) {
  function shorten (s, len) {
    if (s.length > len) s = s.slice(0, len) + '...';
    return s.replace(/\n/g, '').replace(/\s+/g, ' ');
  }

  if (originalObj === proto) {
    if (typeof originalObj !== 'function') return shorten(safeToString(originalObj), 50);
    let funcString = originalObj.toString();
    let body = shorten(funcString.slice(funcString.indexOf('{') + 1, funcString.lastIndexOf('}')), 50);
    return signatureOf(originalObj.displayName || originalObj.name || 'function', originalObj) + ' {' + body + '}';
  }

  let klass = proto.hasOwnProperty('constructor') && proto.constructor;
  if (!klass) return 'prototype';
  if (typeof klass.type === 'string' && klass.type.length) return shorten(klass.type, 50);
  if (typeof klass.name === 'string' && klass.name.length) return shorten(klass.name, 50);
  return 'anonymous class';
}

// FIXME unused?
function getCompletionsOfObj (obj, thenDo) {
  let err, completions;
  try {
    let excludes = [];
    completions = getProtoChain(obj).map(function (proto) {
      let descr = getDescriptorOf(obj, proto);
      let methodsAndAttributes = getMethodsOf(excludes, proto)
        .concat(getAttributesOf(excludes, proto));
      excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
      return [descr, pluck(methodsAndAttributes, 'completion')];
    });
  } catch (e) { err = e; }
  thenDo(err, completions);
}

function descriptorsOfObjAndProtoProperties (obj) {
  let excludes = [];
  let completions = getProtoChain(obj)
    .map(function (proto) {
      let descr = getDescriptorOf(obj, proto);
      let methodsAndAttributes = getMethodsOf(excludes, proto)
        .concat(getAttributesOf(excludes, proto));
      excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
      return [descr, pluck(methodsAndAttributes, 'completion')];
    });
  return completions;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// the main deal
function getCompletions (evalFunc, string, thenDo) {
  // thendo = function(err, completions/*ARRAY*/)
  // eval string and for the resulting object find attributes and methods,
  // grouped by its prototype / class chain
  // if string is something like "foo().bar.baz" then treat "baz" as start
  // letters = filter for properties of foo().bar
  // ("foo().bar.baz." for props of the result of the complete string)
  let promise = getObjectForCompletion(evalFunc, string)
    .then(evalResultAndStartLetters => {
      let evalResult = evalResultAndStartLetters.evalResult;
      let value = evalResult && evalResult.isEvalResult ? evalResult.value : evalResult;
      let result = {
        completions: descriptorsOfObjAndProtoProperties(value),
        startLetters: evalResultAndStartLetters.startLetters,
        code: evalResultAndStartLetters.code
      };

      if (evalResult && evalResult.isPromise) {
        if (evalResult.promiseStatus === 'fulfilled') { result.promiseResolvedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue); } else if (evalResult.promiseStatus === 'rejected') { result.promiseRejectedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue); }
      }
      return result;
    });
  if (typeof thenDo === 'function') {
    promise.then(result => thenDo(null, result)).catch(err => thenDo(err));
  }
  return promise;
}

export { getCompletions };
