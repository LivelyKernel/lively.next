/* global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout */

import { expect } from 'mocha-es6';
import { tableFromObjects, getRow, getCol, get, create, set, setCol, setRow, map, forEach, toObjects, mapCreate, addRow, addCol, removeRow, removeCol } from '../grid.js';

describe('grid', function () {
  it('creates a grid', function () {
    let result = create(2, 3, 'foo');
    let expected = [
      ['foo', 'foo', 'foo'],
      ['foo', 'foo', 'foo']];
    expect(expected).to.eql(result);
  });

  it('creates grid with distinct columns', function () {
    let result = create(2, 3, 'foo');
    let expected = [
      ['foo', 'bar', 'foo'],
      ['foo', 'foo', 'foo']];
    result[0][1] = 'bar';
    expect(expected).to.eql(result);
  });

  it('enumerates', function () {
    let result = [];
    let expected = [[0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2]];
    forEach(create(2, 3), function (_, row, col) {
      result.push([row, col]);
    });
    expect(expected).to.eql(result);
  });

  it('maps', function () {
    let result = map(create(2, 3), function (_, row, col) {
      return row + col;
    });
    let expected = [[0, 1, 2],
      [1, 2, 3]];
    expect(expected).to.eql(result);
  });

  it('gridMapCreate', function () {
    let result = mapCreate(2, 3, function (row, col) {
      return row + col;
    });
    let expected = [[0, 1, 2],
      [1, 2, 3]];
    expect(expected).to.eql(result);
  });

  it('converts toObjects', function () {
    expect([{ a: 1, b: 2 }, { a: 3, b: 4 }]).to.eql(toObjects([['a', 'b'], [1, 2], [3, 4]]));
  });

  it('creates grid from objects', function () {
    let objects = [{ x: 1, y: 2 }, { x: 3 }, { z: 4 }];
    var expected = [['x', 'y', 'z'], [1, 2, null], [3, null, null], [null, null, 4]];
    expect(expected).to.eql(tableFromObjects(objects));

    // gracefully handle non-arrays
    let object = { x: 1, y: 2 };
    var expected = [['x', 'y'], [1, 2]];
    expect(expected).to.eql(tableFromObjects(object));
  });

  it('index access', function () {
    let g = mapCreate(3, 3, function (i, j) { return [i, j]; });
    expect(get(g, 0, 0)).eql([0, 0]);
    expect(get(g, 0, 1)).eql([0, 1]);
    expect(get(g, 2, 2)).eql([2, 2]);
    expect(get(g, 2, 3)).equal(undefined);
    expect(get(g, 3, 2)).equal(undefined);
    set(g, 0, 1, 'foo');
    expect(get(g, 0, 1)).equal('foo');
  });

  it('row access', function () {
    let g = mapCreate(3, 3, function (i, j) { return [i, j]; });
    expect(getRow(g, 1)).eql([[1, 0], [1, 1], [1, 2]]);
    setRow(g, 1, [1, 2, 3]);
    expect(g).eql([
      [[0, 0], [0, 1], [0, 2]],
      [1, 2, 3],
      [[2, 0], [2, 1], [2, 2]]]);
  });

  it('col access', function () {
    let g = mapCreate(3, 3, function (i, j) { return [i, j]; });
    expect(getCol(g, 1)).eql([[0, 1], [1, 1], [2, 1]]);
    setCol(g, 1, [1, 2, 3]);
    expect(g).eql([
      [[0, 0], 1, [0, 2]],
      [[1, 0], 2, [1, 2]],
      [[2, 0], 3, [2, 2]]]);
  });

  it('adds and removes columns', function () {
    let g = create(3, 3, 'foo');
    addRow(g, ['bar', 'bar', 'bar']);
    expect(g).eql([
      ['foo', 'foo', 'foo'],
      ['foo', 'foo', 'foo'],
      ['foo', 'foo', 'foo'],
      ['bar', 'bar', 'bar']
    ]);
    removeRow(g, 1);
    expect(g).eql([
      ['foo', 'foo', 'foo'],
      ['foo', 'foo', 'foo'],
      ['bar', 'bar', 'bar']
    ]);
  });

  it('adds and removes rows', function () {
    let g = create(3, 3, 'foo');
    addCol(g, ['bar', 'bar', 'bar']);
    expect(g).eql([
      ['foo', 'foo', 'foo', 'bar'],
      ['foo', 'foo', 'foo', 'bar'],
      ['foo', 'foo', 'foo', 'bar']
    ]);
    removeCol(g, 1);
    expect(g).eql([
      ['foo', 'foo', 'bar'],
      ['foo', 'foo', 'bar'],
      ['foo', 'foo', 'bar']
    ]);
  });
});
