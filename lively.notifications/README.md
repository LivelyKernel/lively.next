Lively Notifications
====================

A shared event bus for subscribing to and emitting system-wide notifications.

Example Use:

```js
import { subscribe, emit } from "lively.notifications";

subscribe("mymessage", data => console.log(data));
emit("mymessage", {payload: 23});

// prints {type:"mymessage",time:1469576148746,payload:23}
```
