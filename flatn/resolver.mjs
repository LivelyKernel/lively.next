/*global process, URL */
import path from 'path';
import { flatnResolve } from './module-resolver.js';

process.execPath = process.argv[0] = path.join(import.meta.url, 'bin/node');

// implements a custom resolver for node.js ESM modules.

export async function resolve(request, parent, originalResolve) {
  let result;
  try {
    result = await originalResolve(request, parent, originalResolve);
    return result;
  } catch (err) {
    if (result = flatnResolve(request, new URL(parent.parentURL).pathname)) {
      return { url: 'file://' + result };
    }
    throw err;
  }
}