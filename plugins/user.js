import { UserServices } from "lively.user/authserver.js";

export default class UserPlugin {

  get pluginId() { return "user" }

  get after() { return ["l2l"]; }

  setup(livelyServer) {  
    var l2lTracker = livelyServer.findPlugin("l2l").l2lTracker;
    Object.keys(UserServices).forEach(name =>
      l2lTracker.addService(name,
        async (tracker, msg, ackFn) => UserServices[name](tracker, msg, ackFn)))
  }

  close() {}
}