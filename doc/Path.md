## Path.js

-=-=-=-=-=-=-=-=-=-=-=-=-=-
js object path accessor
-=-=-=-=-=-=-=-=-=-=-=-=-=-

- [Path.prototype](#Path.prototype)
  - [parts](#Path.prototype-parts)
  - [size](#Path.prototype-size)
  - [slice](#Path.prototype-slice)
  - [isIn](#Path.prototype-isIn)
  - [equals](#Path.prototype-equals)
  - [isParentPathOf](#Path.prototype-isParentPathOf)
  - [relativePathTo](#Path.prototype-relativePathTo)
  - [withParentAndKeyDo](#Path.prototype-withParentAndKeyDo)
  - [set](#Path.prototype-set)
  - [defineProperty](#Path.prototype-defineProperty)
  - [get](#Path.prototype-get)
  - [concat](#Path.prototype-concat)
  - [watch](#Path.prototype-watch)

#### <a name="Path.prototype-parts"></a>Path>>parts()

key names as array

#### <a name="Path.prototype-size"></a>Path>>size()



#### <a name="Path.prototype-slice"></a>Path>>slice(n, m)



#### <a name="Path.prototype-isIn"></a>Path>>isIn(obj)

 Does the Path resolve to a value when applied to `obj`?

#### <a name="Path.prototype-equals"></a>Path>>equals(obj)

 

```js
var p1 = Path("foo.1.bar.baz"), p2 = Path(["foo", 1, "bar", "baz"]);
// Path's can be both created via strings or pre-parsed with keys in a list.
p1.equals(p2) // => true
```

#### <a name="Path.prototype-isParentPathOf"></a>Path>>isParentPathOf(otherPath)

 

```js
var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1.bar");
p2.isParentPathOf(p1) // => true
p1.isParentPathOf(p2) // => false
```

#### <a name="Path.prototype-relativePathTo"></a>Path>>relativePathTo(otherPath)

 

```js
var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1");
p2.relativePathTo(p1) // => Path(["bar","baz"])
p1.relativePathTo(p2) // => undefined
```

#### <a name="Path.prototype-withParentAndKeyDo"></a>Path>>withParentAndKeyDo(obj, ensure, doFunc)

 Deeply resolve path in `obj`, not fully, however, only to the parent
 element of the last part of path. Take the parent, the key (the last
 part of path) and pass it to `doFunc`. When `ensure` is true, create
 objects along path it path does not resolve

#### <a name="Path.prototype-set"></a>Path>>set(obj, val, ensure)

 Deeply resolve path in `obj` and set the resulting property to `val`. If
 `ensure` is true, create nested structure in between as necessary.
 

```js
var o1 = {foo: {bar: {baz: 42}}};
var path = Path("foo.bar.baz");
path.set(o1, 43)
o1 // => {foo: {bar: {baz: 43}}}
var o2 = {foo: {}};
path.set(o2, 43, true)
o2 // => {foo: {bar: {baz: 43}}}
```

#### <a name="Path.prototype-defineProperty"></a>Path>>defineProperty(obj, propertySpec, ensure)

 like `Path>>set`, however uses Objeect.defineProperty

#### <a name="Path.prototype-get"></a>Path>>get(obj, n)



#### <a name="Path.prototype-concat"></a>Path>>concat(p, splitter)



#### <a name="Path.prototype-watch"></a>Path>>watch(options)

 React or be notified on reads or writes to a path in a `target`. Options:
 ```js
 {
   target: OBJECT,
   uninstall: BOOLEAN,
   onGet: FUNCTION,
   onSet: FUNCTION,
   haltWhenChanged: BOOLEAN,
   verbose: BOOLEAN
 }
 ```
 

```js
// Quite useful for debugging to find out what call-sites change an object.
var o = {foo: {bar: 23}};
Path("foo.bar").watch({target: o, verbose: true});
o.foo.bar = 24; // => You should see: "[object Object].bar changed: 23 -> 24"
```