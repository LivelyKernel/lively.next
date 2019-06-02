## object.js


* Utility functions that help to inspect, enumerate, and create JS objects


<!--*no toc!*-->

#### <a name="isArray"></a>isArray(obj)



#### <a name="isElement"></a>isElement(object)



#### <a name="isFunction"></a>isFunction(object)



#### <a name="isBoolean"></a>isBoolean(object)



#### <a name="isString"></a>isString(object)



#### <a name="isNumber"></a>isNumber(object)



#### <a name="isUndefined"></a>isUndefined(object)



#### <a name="isRegExp"></a>isRegExp(object)



#### <a name="isObject"></a>isObject(object)



#### <a name="isPrimitive"></a>isPrimitive(obj)



#### <a name="isEmpty"></a>isEmpty(object)



#### <a name="equals"></a>equals(a, b)

 Is object `a` structurally equivalent to object `b`? Deep comparison.

#### <a name="values"></a>values(object)

 

```js
var obj1 = {x: 22}, obj2 = {x: 23, y: {z: 3}};
obj2.__proto__ = obj1;
obj.values(obj1) // => [22]
obj.values(obj2) // => [23,{z: 3}]
```

#### <a name="select"></a>select(obj, keys)

 return a new object that copies all properties with `keys` from `obj`

#### <a name="extend"></a>extend(destination, source)

 Add all properties of `source` to `destination`.
 

```js
var dest = {x: 22}, src = {x: 23, y: 24}
obj.extend(dest, src);
dest // => {x: 23,y: 24}
```

#### <a name="clone"></a>clone(object)

 Shallow copy

#### <a name="extract"></a>extract(object, properties, mapFunc)

 Takes a list of properties and returns a new object with those
 properties shallow-copied from object

#### <a name="inspect"></a>inspect(object, options, depth)

 Prints a human-readable representation of `obj`. The printed
 representation will be syntactically correct JavaScript but will not
 necessarily evaluate to a structurally identical object. `inspect` is
 meant to be used while interactivively exploring JavaScript programs and
 state.

 `options` can be {
   printFunctionSource: BOOLEAN,
   escapeKeys: BOOLEAN,
   maxDepth: NUMBER,
   customPrinter: FUNCTION
 }

#### <a name="inspect"></a>inspect(object, options, depth)

 print function

#### <a name="inspect"></a>inspect(object, options, depth)

 print "primitive"

#### <a name="merge"></a>merge(objs)

 `objs` can be a list of objects. The return value will be a new object,
 containing all properties of all objects. If the same property exist in
 multiple objects, the right-most property takes precedence.

 Like `extend` but will not mutate objects in `objs`.

#### <a name="merge"></a>merge(objs)

 if objs are arrays just concat them
 if objs are real objs then merge propertdies

#### <a name="deepMerge"></a>deepMerge(objA, objB)

 `objs` can be a list of objects. The return value will be a new object,
 containing all properties of all objects. If the same property exist in
 multiple objects, the right-most property takes precedence.

 Like `extend` but will not mutate objects in `objs`.

#### <a name="deepMerge"></a>deepMerge(objA, objB)

 if objs are arrays just concat them
 if objs are real objs then merge propertdies

#### <a name="valuesInPropertyHierarchy"></a>valuesInPropertyHierarchy(obj, name)

 Lookup all properties named name in the proto hierarchy of obj.
 

```js
var a = {foo: 3}, b = Object.create(a), c = Object.create(b);
c.foo = 4;
obj.valuesInPropertyHierarchy(c, "foo") // => [3,4]
```

#### <a name="mergePropertyInHierarchy"></a>mergePropertyInHierarchy(obj, propName)

 like `merge` but automatically gets all definitions of the value in the
 prototype chain and merges those.
 

```js
var o1 = {x: {foo: 23}}, o2 = {x: {foo: 24, bar: 15}}, o3 = {x: {baz: "zork"}};
o2.__proto__ = o1; o3.__proto__ = o2;
obj.mergePropertyInHierarchy(o3, "x");
// => {bar: 15, baz: "zork",foo: 24}
```

#### <a name="deepCopy"></a>deepCopy(object)

 Recursively traverses `object` and its properties to create a copy.

#### <a name="isMutableType"></a>isMutableType(obj)

 Is `obj` a value or mutable type?

#### <a name="safeToString"></a>safeToString(obj)

 Like `toString` but catches errors.