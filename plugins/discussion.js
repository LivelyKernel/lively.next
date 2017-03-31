import { DiscussionServices } from "lively.2lively/discussion.js";

export default class DiscussionPlugin {

  get pluginId() { return "discussion" }

  get after() { return ["l2l"]; }

  setup(livelyServer) {  
    var l2lTracker = livelyServer.findPlugin("l2l").l2lTracker;
    Object.keys(DiscussionServices).forEach(name =>
      l2lTracker.addService(name,
        async (tracker, msg, ackFn) => DiscussionServices[name](tracker, msg, ackFn)))
  }

  close() {}
}