## array-projection.js

Accessor to sub-ranges of arrays. This is used, for example, for rendering
 large lists or tables in which only a part of the items should be used for
 processing or rendering. An array projection provides convenient access and
 can apply operations to sub-ranges.

<!--*no toc!*-->

#### <a name="create"></a>create(array, length, optStartIndex)

 

```js
arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 1)
// => { array: [/*...*/], from: 1, to: 5 }
```

#### <a name="toArray"></a>toArray(projection)



#### <a name="originalToProjectedIndex"></a>originalToProjectedIndex(projection, index)

 Maps index from original Array to projection.
 

```js
var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  arrayProjection.originalToProjectedIndex(proj, 1) // => null
  arrayProjection.originalToProjectedIndex(proj, 3) // => 0
  arrayProjection.originalToProjectedIndex(proj, 5) // => 2
```

#### <a name="projectedToOriginalIndex"></a>projectedToOriginalIndex(projection, index)

 Inverse to `originalToProjectedIndex`.
 

```js
var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
  arrayProjection.projectedToOriginalIndex(proj, 1) // => 4
```

#### <a name="transformToIncludeIndex"></a>transformToIncludeIndex(projection, index)

 Computes how the projection needs to shift minimally (think "scroll"
 down or up) so that index becomes "visible" in projection.
 

```js
var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
arrayProjection.transformToIncludeIndex(proj, 1)
// => { array: [/*...*/], from: 1, to: 5 }
```