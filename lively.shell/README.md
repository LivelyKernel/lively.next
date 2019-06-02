# lively.shell

Supports command execution via node.js' `child_process` facilities. Provides a
client interface to connect to spawn and control commands. This allows remote
shell control.

Remote messaging is based on [lively.2lively](https://github.com/LivelyKernel/lively.2lively).


## Example

Server side:

```js
ServerCommand.installLively2LivelyServices(l2lTracker);
```

On client (works in both browser + node.js):

```js
ClientCommand.installLively2LivelyServices(l2lClient);
  
var client = new ClientCommand(l2lClient);
await client.spawn({command: "echo hello"});
await client.whenDone();
client.stdout // => "hello\n"
```


## LICENSE

[MIT](LICENSE)
