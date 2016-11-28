import ServerCommand from "lively.shell/server-command.js";

export default class ShellPlugin {

  get pluginId() { return "shell" }

  get after() { return ["l2l"]; }

  setup(livelyServer) {  
    var l2lTracker = livelyServer.findPlugin("l2l").l2lTracker;
    ServerCommand.installLively2LivelyServices(l2lTracker)
  }

  close() {}
}