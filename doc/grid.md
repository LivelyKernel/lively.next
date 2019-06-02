## grid.js

A grid is a two-dimaensional array, representing a table-like data

<!--*no toc!*-->

#### <a name="create"></a>create(rows, columns, initialObj)

 

```js
grid.create(3, 2, "empty")
// => [["empty","empty"],
//     ["empty","empty"],
//     ["empty","empty"]]
```

#### <a name="mapCreate"></a>mapCreate(rows, cols, func, context)

 like `grid.create` but takes generator function for cells

#### <a name="forEach"></a>forEach(grid, func, context)

 iterate, `func` is called as `func(cellValue, i, j)`

#### <a name="map"></a>map(grid, func, context)

 map, `func` is called as `func(cellValue, i, j)`

#### <a name="toObjects"></a>toObjects(grid)

 The first row of the grid defines the propNames
 for each following row create a new object with those porperties
 mapped to the cells of the row as values
 

```js
grid.toObjects([['a', 'b'],[1,2],[3,4]])
// => [{a:1,b:2},{a:3,b:4}]
```

#### <a name="tableFromObjects"></a>tableFromObjects(objects, valueForUndefined)

 Reverse operation to `grid.toObjects`. Useful for example to convert objectified
 SQL result sets into tables that can be printed via Strings.printTable.
 Objects are key/values like [{x:1,y:2},{x:3},{z:4}]. Keys are interpreted as
 column names and objects as rows.
 

```js
grid.tableFromObjects([{x:1,y:2},{x:3},{z:4}])
// => [["x","y","z"],
//    [1,2,null],
//    [3,null,null],
//    [null,null,4]]
```