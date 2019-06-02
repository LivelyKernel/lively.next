export var defaultActions = {

  "l2l-ping": (tracker, {sender, data: {timestamp}}, ackFn, socket) => {
    let t = Date.now();
    typeof ackFn === "function" && ackFn({timestamp: t});
    tracker.debug && console.log(`[${this}] got ping from ${sender}, time: ${t-timestamp}ms`);
  },

  "remote-eval": (tracker, {sender, data: {source}}, ackFn, socket) => {
    Promise.resolve().then(() => eval(source))
      .then(result => ackFn({value: result}))
      .catch(err => {
        // in case SystemJS wraps the error:
        if (err.originalErr) err = err.originalErr;
        console.error("eval error: " + err);
        typeof ackFn === "function" && ackFn({isError: true, value: String(err.stack || err)})
      });
  },

  "remote-eval-2": (tracker, {sender, data: {source}}, ackFn, socket) => {
    Promise.resolve().then(() => {
      let result = eval(source);
      if (!(result instanceof Promise)) {
        console.error("unexpected eval result:" + result)
        throw new Error("unexpected eval result:" + result);
      }
      return result;
    })
    .then(evalResult => ackFn(evalResult))
    .catch(err => {
      console.error("eval error: " + err);
      if (err.originalErr) err = err.originalErr;
      typeof ackFn === "function" && ackFn({isError: true, value: String(err.stack || err)})
    });
  }

}


export var defaultTrackerActions = {

  async "[broadcast] send"(tracker, {sender, data}, ackFn, socket) {
    let {
          action, broadcast, room, namespace,
          isSystemBroadcast, isMultiServerBroadcast
        } = data,
        broadcasters = [];

    if (isMultiServerBroadcast) {
      // FIXME... this invites snowballing again... needs to be implemented differently...!
      console.log(".......isMultiServerBroadcast")
      let {id} = tracker, trackers = tracker.getTrackerList();
      console.log(trackers)
      broadcasters = trackers.map(ea =>
        ea.id != id ? ea.io.nsps["/" + ea.namespace] : socket.broadcast);

    } else {
      if (isSystemBroadcast) namespace = tracker.namespace;
      broadcasters.push(namespace ?
        tracker.io.nsps["/" + namespace] :
        socket.broadcast);
    }

    broadcasters.forEach(ea =>
      ea.to(room).emit({
        action, sender, broadcast: true,
        data: broadcast}))

    if (ackFn && typeof ackFn === 'function') {
      let status = 'message broadcasted to ' + room;
      if (namespace) status += " in namespace " + namespace;
      if (broadcasters.length > 1)
        status += " " + broadcasters.length + " trackers";
      console.log(status);
      ackFn({status});
    }
  },

  async "[broadcast] join room"(tracker, {sender, data: {room}}, ackFn, socket) {
    let status, joined = false,
        rooms = tracker.io.nsps["/" + tracker.namespace].adapter.rooms,
        isInRoom = rooms[room] && rooms[room].sockets && rooms[room].sockets[socket.id];

    if (isInRoom) {
      status = `${sender} already in ${room}`;

    } else {
      await new Promise((resolve, reject) =>
        socket.join(room, err => err ? reject(err) : resolve()));
      status = `${sender} joined ${room}`;
      joined = true;
    }
    if (ackFn && typeof ackFn === "function") ackFn({status, joined});
  },

  async "[broadcast] leave room"(tracker, {sender, data: {room}}, ackFn, socket) {
    let status, left = false,
        rooms = tracker.io.nsps["/" + tracker.namespace].adapter.rooms,
        isInRoom = rooms[room] && rooms[room].sockets && rooms[room].sockets[socket.id];

    if (!isInRoom) {
      status = `${sender} not in ${room}`;

    } else {
      await new Promise((resolve, reject) =>
        socket.leave(room, err => err ? reject(err) : resolve()));
      status = `${sender} left room ${room}`;
      left = true;
    }

    console.log(status);
    if (ackFn && typeof ackFn === "function") ackFn({left, status});
  },

  "[broadcast] my rooms"(tracker, {}, ackFn, socket) {
    ackFn(socket.rooms);
  },

  "[broadcast] all rooms"(tracker,{sender},ackFn,socket){
    ackFn(tracker.io.nsps["/" + tracker.namespace].adapter.rooms);
  },

  "[broadcast] list room members"(tracker, {sender, data: {room}}, ackFn, socket) {
    var {io} = tracker, contents;
    if (!room) { ackFn({isError: true, error: "`room` paramerter missing!"}); return; }
    contents = io.nsps["/" + tracker.namespace].adapter.rooms[room];
    ackFn({
      room,
      sockets: contents ? contents.sockets : {},
      length: contents ? contents.length : 0
    });
  },

  getClients(tracker, {trackerId}, ackFn) {
    tracker.removeDisconnectedClients();
    ackFn(Array.from(tracker.clients));
  }
}


export var defaultClientActions = {

  async "getRoomList"({client,ackFn}){
    var result = client._socketioClient.rooms
    ackFn(result)
  },

  async "ask for"(tracker, {sender, data: {query}}, ackFn, socket) {
    var promptMethod = query.match(/password|sudo/i) ? 'passwordPrompt' : 'prompt',
        answer = await $world[promptMethod](query);
    typeof ackFn === "function" && ackFn({answer});
    tracker.debug && console.log(`[${this}] message 'ask for' from ${sender}, query: ${query}`);
  },

  async "open editor"(tracker, {sender, data: {args}}, ackFn, socket) {
    if (!args.length) {
      ackFn({error: 'no file specified'});
      return;
    }
    // "saved" || "aborted"
    var status = await $world.execCommand("open file for EDITOR", {url: args[0]});
    typeof ackFn === "function" && ackFn(status === "aborted" ? {error: String(status)} : {status})
  },

  async "changeWorkingDirectory"(tracker, {sender, data: {args}}, ackFn, socket) {
    var [dir, commandMorphId] = args || [];
    var status = "OK";

    try {
      if (!dir) status = "[changeWorkingDirectory] No directory received";
      else if (!commandMorphId) status = "[changeWorkingDirectory] No command morph";
      else {
        var morph = $world.getMorphWithId(commandMorphId);
        if (morph) {
          if (morph.__lookupSetter__("cwd")) morph.cwd = dir;
          else if (typeof morph.changeWorkingDirectory === "function") morph.changeWorkingDirectory(dir);
          else if (typeof morph.pluginFind === "function") {
            var shellPlugin = morph.pluginFind(ea => ea.isShellEditorPlugin)
            if (shellPlugin) shellPlugin.cwd = dir;
          } else {
            status = "[changeWorkingDirectory] cannot figure pout how to set dir";
          }

        }
      }
    } catch (e) { status = String(e); }

    if (status !== "OK") console.warn(status);
    typeof ackFn === "function" && ackFn(status);
  }

}
