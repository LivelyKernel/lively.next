import { Database } from "lively.storage";
import {date, arr, obj} from 'lively.lang';
import { hashCode } from "lively.lang/string.js";
import { newUUID } from "lively.lang/string.js";

const topicDB = Database.ensureDB("lively.discussion.storage", {adapter: "memory"});

export class CommentData {
  constructor({
    hash, author, date, content, comments, lastChanged
  }) {
    this.hash = hash;
    this.author = author;
    this.date = date;
    this.content = content;
    this.lastChanged = lastChanged;
    this.comments = comments.map(c => new CommentData(c));
  }

  update({hash, author, date, lastChanged, content, comments}) {
    this.hash = hash;
    this.author = author;
    this.date = date;
    this.content = content;
    this.lastChanged = lastChanged;
    arr.zip(this.comments, comments).forEach(([o, n]) => {
      if (n) o.update(n);
    })
    let remainingComments = arr.drop(comments, this.comments.length);
    this.comments = [...this.comments, ...remainingComments.map(c => new CommentData(c))];
  }

  mergeUpdated(updatedComment, user) {
    if (updatedComment.author == user.email) {
      this.content = updatedComment.content;
      this.lastChanged = date.format(new Date(), 'h:MM TT, dd mmmm yyyy');
    }
    this.mergeUpdatedComments(updatedComment.comments, user);
  }

  mergeUpdatedComments(updatedComments, user) {
    if (!this.ensureChronologicalOrder(updatedComments))
      throw Error('Invalid order of comments!');
    for (let [c1, c2] of arr.zip(this.comments, updatedComments)) {
      c1.mergeUpdated(c2, user);
    }
    this.comments = [...this.comments, ...arr.drop(updatedComments, this.comments.length)];
  }

  ensureChronologicalOrder(comments) {
    var h = this.hash;
    for (var c of comments) {
      if (c.hash == hashCode(h.toString() + c.author)) {
        h = c.hash;
      } else {
        return false;
      }
    }
    return true;
  }
}


export class TopicData extends CommentData {
  constructor(args) {
     super(args);
     this.title = args.title;
     this.client = args.tracker;
     this.user = args.user;
  }

  async sendRequest(name) {
    var payload = {
      ...obj.dissoc(this, ['client', 'user']),
      user: {token: this.user.token, email: this.user.email}
    }
    return (await this.client.sendToAndWait(
       this.client.trackerId, name, payload)).data;
  }

  update(opts) {
     super.update(opts);
     this.title = opts.title;
  }

  mergeUpdated(updatedTopic, user) {
    if (updatedTopic.author == user.email) {
      this.title = updatedTopic.title;
      this.content = updatedTopic.content;
      this.lastChanged = date.format(new Date(), 'h:MM TT, dd mmmm yyyy');
    }
    this.mergeUpdatedComments(updatedTopic.comments, user);
  }

  

  async pullUpdate() {
    let topicData = await this.sendRequest('fetchTopic');
    if (topicData) {
      this.update(topicData);
      return true;
    } else {
      return false;
    }
  }

  broadcastUpdate() {
    var ackFn, msg = {
        target: this.client.id,
        action: "updateTopic",
        data: {hash: this.hash},
        messageId: "update: " + this.hash
    };
    [msg, ackFn] = this.client.prepareSend(msg);
    this.client.sendTo(this.client.trackerId,"systemBroadcast", {broadcastMessage: msg, roomName: 'defaultRoom'})       
  }

  async pushUpdate() {
    await this.sendRequest('updateTopic');
    this.broadcastUpdate();
  }

  async create() {
    this.hash = await this.sendRequest('createTopic');
    this.broadcastUpdate();
    return this.hash;
  }
}

export async function listTopics() {
  return await topicDB.getAll();
}

export async function fetchTopic(data) {
  return await topicDB.get(data.hash);
}

export async function createTopic(topicData) {
  topicData.hash = newUUID();
  await topicDB.set(topicData.hash, topicData);
  return topicData.hash;
}

/*
An updated topic is scanned for changes in existing
and newly added comments.
The order of comments may never change (new comments are appended to existing arrays)
No new comments may be inserted or their hashes changed.
Authors of comments and topic can not change.
Only comments that have been authored by the provided authenticated user,
can be changed, all other changes (if present) are discarded by default.
*/
export async function updateTopic(updatedTopic, user) {
   let topic = new TopicData(await topicDB.get(updatedTopic.hash));
   if (topic) {
     topic.mergeUpdated(updatedTopic, user);
     await topicDB.set(topic.hash, topic);
   }
}

export var DiscussionServices = {

  async updateTopic(tracker, {sender, data}, ackFn) {
     var answer;     
     data = new TopicData(data);
     if (await verify(data.user)) {
        if (await fetchTopic(data)) {
          await updateTopic(data, data.user);
          answer = {status: 'updated'};
        } else {
          answer = {status: 'No topic to update found for hash: ' + data.hash}
        }
     } else {
        answer = {status: 'Invalid user token provided!'}
     }
     typeof ackFn === "function" && ackFn(answer);
  },

  async createTopic(tracker, {sender, data}, ackFn) {
    var answer = await createTopic(new TopicData(data));
    typeof ackFn === "function" && ackFn(answer);
  },

  async fetchTopic(tracker, {sender, data}, ackFn) {
    var answer = await fetchTopic(data);
    typeof ackFn === "function" && ackFn(answer);
  },

  async listTopics(tracker, {sender, data}, ackFn) {
    var answer = {topics: await listTopics()};
    typeof ackFn === "function" && ackFn(answer);
  },

  // async deleteTopic(data) {
  //   // Not Yet Implemented
  // }
}
