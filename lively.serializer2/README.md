# lively.serializer 2.0

Provides an object registry that continously tracks objects and is able to
snapshot the object graph or parts of it to serialize objects and their state.

Similarly, can re-create object (graphs) based on snapshots or update exising
registered object graphs when parts change.

These features provide the base for persistent lively.next workspaces and are
needed by [lively.sync](https://github.com/LivelyKernel/lively.sync).



## How the serializer works

For serialization, the pool starts with a single root object for which it creates an object ref.  The object ref then traverses all its properties and recursively adds non-primitive objects to the pool, building a snapshot (a serializable copy) of the objects it encounters.  A snapshot is a simple JS map/object whose keys are ids if the serialized objects and whose values are the snapshot representation of those objects.


Example:

```js
ObjectPool.withObject({foo: {bar: 23}}).snapshot(); // =>
{
  A1CB461E-9187-4711-BEBA-B9E3D1B6D900: {
    props: {
      bar: {key: "bar",value: 23}
    },
    rev: 0
  },
  EDF8404A-243A-4858-9C98-0BFEE7DB369E: {
    props: {
      foo: {
        key: "foo",
        value: {__ref__: true, id: "A1CB461E-9187-4711-BEBA-B9E3D1B6D900", rev: 0}
      }
    },
    rev: 0
  }
}
```

For deserialization the process is reversed, i.e. object refs are created from a snapshot which then re-instantiate objects.  Object properties are hooked up so that a copy of the original object graph is re-created.



## API

### ObjectRef

ObjectRefs manage the translation of "real objects" and their serialized version. The objects being managed are special in that they are required to have a property `_rev`, a version counter that is used to recognize new "versions" of that object.

An ObjectRef has the properties

```
id: STRING
realObj: {_rev, ...}
snapshotVersions: [...revs]
snapshots: {} mapping revs to snapshots
```

### ObjectPool

The object pool manages object refs and is the interface to the serialization process for the outside world.

Methods:

- `knowsId(id)` => has the pool the ref with id?
- refForId(id) => finds the object ref with id
- resolveToObj(id) => returns the object for the object ref with id
- ref(obj) => returns the object ref for object

- add(obj)
- snapshot() => produces a JSON object
- jsonSnapshot() => produces a stringified JSON object
- readSnapshot()

Internal pool state:
- `_obj_ref_map` maps real objects to refs
- `_id_ref_map` map ids to object ref instances

additional
- `classHelper`
- `uuidGen`
- `expressionEvaluator`


### real object

Here is what's expected / supported of the objects to be serialized

- `_rev`
version number

- `__serialize__` function
Method of real object that produces a custom snapshot representation of real object. If no such method is present the default serialization approach is used.

- `__dont_serialize__`: [STRING]
Property names of real object to not snapshot


## Serialization algorithm

### serialization

A snapshot can either be a manually produced representation of real object if real object implements a `__serialize__` method (see below). If not then the standard serialization approach is:

- Let snapshot be: `{rev, props: []}`
- Get all the property names of real object
  - *excluding* those in `realObj.__dont_serialize__` (merged with hierarchy) – priority 1
  - or *only* those properties in `realObj.__only_serialize__` – priority 2
- For each property let seraliized value be
  - if its a function ignore **FIXME**
  - if its a "primitive" use that verbatim
  - if its an Array: snapshot all elements
  - if it has a __serialize__ function use the output of that
- let the class plugin add meta data to the object ref **FIXME**
- add the value to the object pool => produces either an object ref or an Array of refs
  a ref can be either a real object ref or an entry into serialized map: {__ref__: true, id, rev}

### deserialization

An ObjectRef can deserialize an object from a snapshot {rev, __exprs__, props}.

- If `__expr__` is defined then use the expression evaluator (fancy eval) to get a new object.
- If its a serialized class instance then instantiate the class
- Otherwise create a new empty object

- Assign ObjectRef>>rev as _rev to the object.

- Make sure ObjectRef is known by the pool so that updates of the real object are directed to it.

- for each property in `props`
  - if Array: recreate all elements
  - if __expr__: expression evaluator
  - otherwise try to find the ref for prop.id or create a new ObjectRef for it
    use ref.realObj (which recursively deserializes the property) as result.





# License

[MIT](LICENSE)
