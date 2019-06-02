## Group.js

A Grouping is created by arr.groupBy and maps keys to Arrays.

- [<error: no object found for method>](#<error: no object found for method>)
  - [fromArray](#<error: no object found for method>-fromArray)
  - [toArray](#<error: no object found for method>-toArray)
  - [forEach](#<error: no object found for method>-forEach)
  - [forEachGroup](#<error: no object found for method>-forEachGroup)
  - [map](#<error: no object found for method>-map)
  - [mapGroups](#<error: no object found for method>-mapGroups)
  - [keys](#<error: no object found for method>-keys)
  - [reduceGroups](#<error: no object found for method>-reduceGroups)
  - [count](#<error: no object found for method>-count)

#### <a name="<error: no object found for method>-fromArray"></a><error: no object found for method>.fromArray(array, hashFunc, context)

 

```js
Group.fromArray([1,2,3,4,5,6], function(n) { return n % 2; })
// => {"0": [2,4,6], "1": [1,3,5]}
```

#### <a name="<error: no object found for method>-toArray"></a><error: no object found for method>.toArray()

 

```js
var group = arr.groupBy([1,2,3,4,5], function(n) { return n % 2; })
group.toArray(); // => [[2,4],[1,3,5]]
```

#### <a name="<error: no object found for method>-forEach"></a><error: no object found for method>.forEach(iterator, context)

 Iteration for each item in each group, called like `iterator(groupKey, groupItem)`

#### <a name="<error: no object found for method>-forEachGroup"></a><error: no object found for method>.forEachGroup(iterator, context)

 Iteration for each group, called like `iterator(groupKey, group)`

#### <a name="<error: no object found for method>-map"></a><error: no object found for method>.map(iterator, context)

 Map for each item in each group, called like `iterator(groupKey, group)`

#### <a name="<error: no object found for method>-mapGroups"></a><error: no object found for method>.mapGroups(iterator, context)

 Map for each group, called like `iterator(groupKey, group)`

#### <a name="<error: no object found for method>-keys"></a><error: no object found for method>.keys()



#### <a name="<error: no object found for method>-reduceGroups"></a><error: no object found for method>.reduceGroups(iterator, carryOver, context)

 Reduce/fold for each group, called like `iterator(carryOver, groupKey, group)`

#### <a name="<error: no object found for method>-count"></a><error: no object found for method>.count()

 counts the elements of each group