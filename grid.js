import { withN as arrayWithN } from "./array.js";
import { timeToRunN } from "./function.js";

// show-in-doc
// A grid is a two-dimaensional array, representing a table-like data

function get(grid, nRow, nCol) {
  var row = grid[nRow];
  return row ? row[nCol] : undefined;
}

function set(grid, nRow, nCol, obj) {
  var row = grid[nRow];
  if (row) row[nCol] = obj;
  return obj;
}

function getRow(grid, nRow) {
  return grid[nRow];
}

function setRow(grid, nRow, newRow) {
  return grid[nRow] = newRow;
}


function getCol(grid, nCol) {
  return grid.reduce(function(col, row) {
    col.push(row[nCol]); return col; }, []);
}

function setCol(grid, nCol, newCol) {
  return grid.map(function(row, i) {
    return row[nCol] ? row[nCol] = newCol[i] : undefined;
  });
}

function create(rows, columns, initialObj) {
  // Example:
  // grid.create(3, 2, "empty")
  // // => [["empty","empty"],
  // //     ["empty","empty"],
  // //     ["empty","empty"]]
  var result = new Array(rows);
  while (rows > 0) result[--rows] = arrayWithN(columns, initialObj);
  return result;
}

function mapCreate(rows, cols, func, context) {
  // like `grid.create` but takes generator function for cells
  var result = new Array(rows);
  for (var i = 0; i < rows; i++) {
    result[i] = new Array(cols);
    for (var j = 0; j < cols; j ++) {
      result[i][j] = func.call(context || this, i, j);
    }
  }
  return result;
}

function forEach(grid, func, context) {
  // iterate, `func` is called as `func(cellValue, i, j)`
  grid.forEach(function(row, i) {
    row.forEach(function(val, j) {
      func.call(context || this, val, i, j);
    });
  })
}

function map(grid, func, context) {
  // map, `func` is called as `func(cellValue, i, j)`
  var result = new Array(grid.length);
  grid.forEach(function(row, i) {
    result[i] = new Array(row.length);
    row.forEach(function(val, j) {
      result[i][j] = func.call(context || this, val, i, j);
    });
  });
  return result;
}

function toObjects(grid) {
  // The first row of the grid defines the propNames
  // for each following row create a new object with those porperties
  // mapped to the cells of the row as values
  // Example:
  // grid.toObjects([['a', 'b'],[1,2],[3,4]])
  // // => [{a:1,b:2},{a:3,b:4}]
  var props = grid[0], objects = new Array(grid.length-1);
  for (var i = 1; i < grid.length; i++) {
    var obj = objects[i-1] = {};
    for (var j = 0; j < props.length; j++) obj[props[j]] = grid[i][j];
  }
  return objects;
}

function tableFromObjects(objects, valueForUndefined) {
  // Reverse operation to `grid.toObjects`. Useful for example to convert objectified
  // SQL result sets into tables that can be printed via Strings.printTable.
  // Objects are key/values like [{x:1,y:2},{x:3},{z:4}]. Keys are interpreted as
  // column names and objects as rows.
  // Example:
  // grid.tableFromObjects([{x:1,y:2},{x:3},{z:4}])
  // // => [["x","y","z"],
  // //    [1,2,null],
  // //    [3,null,null],
  // //    [null,null,4]]

  if (!Array.isArray(objects)) objects = [objects];
  var table = [[]], columns = table[0],
    rows = objects.reduce(function(rows, ea) {
      return rows.concat([Object.keys(ea).reduce(function(row, col) {
        var colIdx = columns.indexOf(col);
        if (colIdx === -1) { colIdx = columns.length; columns.push(col); }
        row[colIdx] = ea[col];
        return row;
      }, [])]);
    }, []);
  valueForUndefined = arguments.length === 1 ? null : valueForUndefined;
  rows.forEach(function(row) {
    // fill cells with no value with null
    for (var i = 0; i < columns.length; i++)
      if (!row[i]) row[i] = valueForUndefined;
  });
  return table.concat(rows);
}

function benchmark() {
  // ignore-in-doc
  var results = [], t;

  var g = create(1000, 200, 1),
      addNum = 0;
      t = lively.lang.fun.timeToRunN(function() {
  forEach(g, function(n) { addNum += n; }) }, 10);
  results.push(`forEach: ${t.toFixed(2)}ms`);

  var mapResult;
  t  = timeToRunN(function() {
    mapResult = map(g, function(n, i, j) {
      return i+j + Math.round(Math.random() * 100); });
  }, 10);
  results.push(`map: ${t.toFixed(2)}ms`);

  var mapResult2 = create(1000, 2000);
  t  = timeToRunN(function() {
    mapResult2 = new Array(1000);
    for (var i = 0; i < 1000; i++) mapResult2[i] = new Array(2000);
    forEach(g, function(n, i, j) { mapResult2[i][j] = i+j + Math.round(Math.random() * 100); });
  }, 10);

  results.push('map with forEach: ' + t + 'ms');

  results.push('--= 2012-09-22 =--\n'
        + "forEach: 14.9ms\n"
        + "map: 19.8ms\n"
        + "map with forEach: 38.7ms\n");
  return results.join('\n');
}


export {
  get,
  set,
  getRow,
  setRow,
  getCol,
  setCol,
  create,
  mapCreate,
  forEach,
  map,
  toObjects,
  tableFromObjects
}
