export var defaultActions = {

  "l2l-ping": (tracker, {sender, data: {timestamp}}, ackFn, socket) => {
    var t = Date.now();
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
  }

}


export var defaultTrackerActions = {

  async "broadcast": (tracker, {sender, data: {broadcastMessage, roomName}}, ackFn, socket) => { 
    socket.broadcast.to(roomName).emit(broadcastMessage)
    if(ackFn && typeof ackFn === 'function'){ackFn({status: 'Message delivered to ' + roomName})}    
  },
  async "systemBroadcast": (tracker, {sender, data: {broadcastMessage, roomName}}, ackFn, socket) => {
     var io = tracker.io;     
    io.nsps["/" + tracker.namespace].to(roomName).emit(broadcastMessage)
    if(ackFn && typeof ackFn === 'function'){ackFn({status: 'System Broadcast Message delivered to ' + roomName})}
  },
  async "multiServerBroadcast": (tracker, {sender, data: {broadcastMessage, roomName}}, ackFn, socket) =>{
      
      var id = tracker.id
      var trackers = tracker.getTrackerList()
      trackers.forEach(function(tracker){
        var io = tracker.io;
        if (tracker.id != id){
            io.nsps["/" + tracker.namespace].to(roomName).emit(broadcastMessage)
        } else {
            socket.broadcast.to(roomName).emit(broadcastMessage)
        }
        if(ackFn && typeof ackFn === 'function'){ackFn({status: 'System Broadcast Message delivered to ' + roomName})}
      })
  
  },  
  async "getClients": (tracker, {trackerId},ackFn) => {    
    ackFn(Array.from(tracker.clients))
  },
   async "joinRoom": (tracker, {sender, data: {roomName}}, ackFn, socket) => {
      await socket.join(roomName)
      if(ackFn && typeof ackFn === 'function'){ackFn({status: 'Joined ' + roomName})}      
      console.log(sender + ' joined room ' + roomName)
  },
  async "leaveRoom": (tracker, {sender, data: {roomName}}, ackFn, socket) => {
      socket.leave(roomName)
      if(ackFn && typeof ackFn === 'function'){ackFn({status: 'Left ' + roomName})}
      console.log(sender + ' left room ' + roomName)
  },
  async "clientRoomList": (tracker, {}, ackFn, socket) => {    
   (ackFn && (typeof ackFn == 'function')) ? ackFn(socket.rooms) : console.log('Error: missing or invalid ack function')
    
  },
  async "listRoom": (tracker, {sender, data: {roomName}}, ackFn, socket) => {
      var io = tracker.io
      var contents
      if (roomName){
        contents = io.nsps["/" + tracker.namespace].adapter.rooms[roomName]
        if(ackFn && typeof ackFn === 'function'){ackFn({roomName: roomName, sockets: contents.sockets,length: contents.length})}        
        
      } else {
        contents = io.nsps["/" + tracker.namespace].adapter.rooms
        if(ackFn && typeof ackFn === 'function'){ackFn({roomList: contents})}        
      }
               
      
  }
}


export var defaultClientActions = {
  async "getServers": (ackFn) => {
    if (!(ackFn && typeof ackFn =='function')){
      console.log('Bad or Missing Ack Function')
    }
    var response = Array.from(LivelyServer.servers).map(function(ea){
                      return ea[1]
                   })
    typeof ackFn === "function" && ackFn(response);
  },

  async "getRoomList": ({client,ackFn}) =>{
    var result = client._socketioClient.rooms
    ackFn(result)
  },
  async "ask for": (tracker, {sender, data: {query}}, ackFn, socket) => {
    var promptMethod = query.match(/password|sudo/i) ? 'passwordPrompt' : 'prompt',
        answer = await $$world[promptMethod](query);
    typeof ackFn === "function" && ackFn({answer});
    tracker.debug && console.log(`[${this}] message 'ask for' from ${sender}, query: ${query}`);
  },

  async "open editor": (tracker, {sender, data: {args}}, ackFn, socket) => {
    if (!args.length) {
      ackFn({error: 'no file specified'});
      return;
    }
    // "saved" || "aborted"
    var status = await $$world.execCommand("open file for EDITOR", {url: args[0]});
    typeof ackFn === "function" && ackFn(status === "aborted" ? {error: String(status)} : {status})
  },

  async "changeWorkingDirectory": (tracker, {sender, data: {args}}, ackFn, socket) => {
    var [dir, commandMorphId] = args || [];
    var status = "OK";

    try {  
      if (!dir) status = "[changeWorkingDirectory] No directory received";
      else if (!commandMorphId) status = "[changeWorkingDirectory] No command morph";
      else {
        var morph = $$world.getMorphWithId(commandMorphId);
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
