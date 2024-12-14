/* global process, require, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';

import { parse } from '../lib/parser.js';

describe('es6', function () {
  it('arrow function', function () {
    let code = '() => 23;';
    let parsed = parse(code);
    expect(parsed).has.nested.property('body[0].expression.type')
      .equals('ArrowFunctionExpression');
  });
});
