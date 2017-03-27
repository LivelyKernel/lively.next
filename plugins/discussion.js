import { L2LServices } from "lively.2lively/discussion.js";

export default class DiscussionPlugin {

  get pluginId() { return "discussion" }

  get after() { return ["l2l"]; }

  setup(livelyServer) {  
    var l2lTracker = livelyServer.findPlugin("l2l").l2lTracker;
    Object.keys(L2LServices).forEach(name =>
      l2lTracker.addService(name,
        async (tracker, msg, ackFn) => L2LServices[name](tracker, msg, ackFn)))
  }

  close() {}
}