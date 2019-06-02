# lively.bindings

## Attribute connections

The principle behind the data binding mechanism in Lively is quite simple due to the dynamic nature of JavaScript.  Each call on connect() declaratively defines a dataflow connection between a source and a target object.

The simplest connection can be built by connecting two attributes with each other:

```js
// create source and target objects
var source = {sourceData: null}
var target = {targetData: null}
// connect source.sourceData -> target.targetData
connect(source, 'sourceData', target, 'targetData');
source.sourceData = 3;
target.targetData // returns 3
```

What happens when the connection is established is that the "sourceData" slot in source is replaced with a JavaScript getter/setter (see the ECMAScript Language Specification)


### Getters

When we inspect the source object we find out that:

```js
source.__lookupGetter__('sourceData')
returns:
function () {
    return sourceObj[newAttrName];
}
```

When reading `sourceData` the getter function is triggered. It has the real value (3) stored in a renamed slot:
`source.$$sourceData // returns 3` -- this is where the real data is stored.


### Setters
`source.__lookupSetter__('sourceData')`
returns

```js
function (newVal) {
    var oldVal = sourceObj[newAttrName];
    sourceObj[newAttrName] = newVal;
    if (sourceObj.attributeConnections === undefined)
        throw new Error('Sth wrong with sourceObj, has no attributeConnections');
    var conns = sourceObj.attributeConnections.clone();
    for (var i = 0; i < conns.length; i++) {
        var c = conns[i];
        if (c.getSourceAttrName() === sourceAttrName)
            c.update(newVal, oldVal);
    }
    return newVal;
}
```

The setter does two things:

1. Set the new value in the renamed slot (`$$sourceData`)
2. Iterate over the attributeConnections collection stored in the source object and find matching connections.  Matching means that the slot name specified in the connection matches the slot name the setter was triggered for.  On those connections the "update" method is called.  This method handles the real update of the connection.

The disconnect method can be used to remove such  a connection and will also redo the changes regarding slots, as you can see in `AttributeConnection.removeSourceObjGetterAndSetter()`, when no other attributeConnection uses this property as source.

This means that each source object needs an attributeConnections collection. We can inspect this:

```js
source.attributeConnections
  // AttributeConnection([object Object].sourceData-->[object Object].targetData)
```

## Configuration

There is  an optional fifth parameter for connect that is a JS object with the optional properties converter, updater and removeAfterUpdate. When the converter property exists it should be a function that gets the value from the sourceObj as input and returns a value that is used for updating the target.

### Converter:

```js
obj1 = {x: 'foo'}
obj2 = {y: '123'}
connect(obj1, 'x', obj2, 'y', {converter: function(val) { return val % 7 }})
obj1.x = 10
obj2.y //  3
```

Note! If functions passed to connect (converter, updater) are closures, i.e. they reference variables in their lexical scope, they need to declare those variables in a varMapping attribute. See below.

### Updater:

Sometimes just converting a value is not enough. When you want more control over the connection and decide for yourself if the connection should be updated, use an updater function. Besides the new value that is fed into the connection there is also an updater function (`$upd`) that will trigger the update when it is called:

```js
obj = {}
connect(obj, 'x', $world, 'alert', {
    updater: function($upd, val) { for (var i=0; i<val; i++) $upd(i) }})
obj.x = 3 // alerts 3 times
obj.x = 0 // no alert, we don't trigger anything
```

### Disconnecting

Since the connection is stored and implemented in the source object of the connection, the connection is removed when you delete the source object. It won't get automatically removed when you remove the target object of a connection. Therefore, you have to disconnect connection sometimes.

`disconnect(source, 'sourceData', target, 'targetData');`
or
`disconnectAll(source)`

will remove the attribute connection. Three things are happening:
1. The getter and setter is replaced by the original object of the slot (if there are no other connections that have the slot as a source attribute defined)
2. The connection object is removed from source.attributeConnections
3. If source.attributeConnections is empty it is removed.

### Additional options

The lively.bindings.connect call accepts additional arguments to customize the connection (besides converter and updater):

`removeAfterUpdate: Boolean`
  Default value is false. Only update the connection once and then remove it. Note that when an updater exists and it decides not to call $upd, the connection is not considered to have been activated.

`varMapping: Object`
  Object to capture variables in the lexical scope of converter and updaters.

`signalOnAssignment: Boolean`
  Default is true.

