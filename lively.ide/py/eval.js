/*global WebSocket*/
import { promise } from "lively.lang";
import serverConfig from 'config.js'

// let p = PyEvaluator.ensure({hostname: "127.0.0.1", port: 9942})
// await p.connect()
// await p.runEval("1+2")
// p.disconnect()

// source = "import pip\npip."; row = 2; column = 4; file = 'example.py'
// completions = await p.complete(source, row, column, file)

// source = "def x(   ):\n  return 23 +    3"
// formatted = await p.formatCode(source)
// formatted = await p.formatCode(source, 0,0)


// PyEvaluator._instances["ws://127.0.0.1:9942/"].disconnect("x")

export class PyEvaluator {

  static urlFor(opts) {
    let {ssl, hostname, port, path} = opts;
    return `ws${ssl ? "s" : ""}://${hostname}${port ? ":" + port : ""}${path}`;
  }

  static fixOpts(opts) {
    return {
      ...serverConfig.pythonServer,
      onData: (data) => console.log("data received from python - data is not being handled"),
      ...opts
    };
  }

  static ensure(opts) {
    opts = this.fixOpts(opts);
    const instances = this._instances || (this._instances = {}),
          url = this.urlFor(opts),
          existing = instances[url];
    return existing ? existing.assignOpts(opts) : (instances[url] = new this(opts));
  }

  constructor(opts = {}) {
    opts = this.constructor.fixOpts(opts);
    this.assignOpts(opts);
    this._websocket = null;
    this.taskQueue = [];
    this.taskInProgress = null;
    this.debug = false;
  }

  assignOpts(opts) {
    this.port = opts.port;
    this.hostname = opts.hostname;
    this.ssl = opts.ssl;
    this.path = opts.path;
    this.onData = opts.onData;
    return this;
  }

  get isConnected() {
    let ws = this._websocket;
    return ws && ws.readyState === ws.OPEN;
  }

  get url() { return this.constructor.urlFor(this); }

  async connect() {
    if (this.isConnected) {
      this.debug && console.log("[PyEvaluator] already connected")
      return Promise.resolve(this);
    }

    this.disconnect();
    let ws = this._websocket = new WebSocket(this.url);
    this.debug && console.log(`[PyEvaluator] connecting to ${this.url}`);
    return new Promise((resolve, reject) => {
      ws.onopen = () => {
        this.debug && console.log(`[PyEvaluator] connected to ${this.url}`);
        resolve();
      }
      ws.onerror = err => {
        this.debug && console.log(`[PyEvaluator] connection to ${this.url} errored`);
        reject(err);
      }
      ws.onclose = () => {
        this.debug && console.log(`[PyEvaluator] connection to ${this.url} closed while starting`);
        reject("closed");
      }
      ws.onmessage = evt => this.onMessage(evt);
    }).then(() => {
      ws.onopen = null;
      ws.onerror = evt => this.onError(evt);
      ws.onclose = () => {
        this.debug && console.log(`[PyEvaluator] connection to ${this.url} closed`);
        this.disconnect();
      }
    }).then(() => this);
  }

  disconnect(reason) {
    let ws = this._websocket;
    if (!ws) return;
    this.debug && console.log(`[PyEvaluator] disconnected`);
    this._websocket = null;
    ws.close();

    if (!reason) reason = "disconnected from python server";
    if (this.taskInProgress) {
      let {deferred: {reject}} = this.taskInProgress
      this.taskInProgress = null;
      reject(reason);
    }
    let task;
    while ((task = this.taskQueue.shift())) {
      let {deferred: {reject}} = task;
      reject(reason);
    }
  }

  onMessage(evt) {
    this.debug && console.log(`[PyEvaluator] got message ${evt.data}`);
    let answer;
    const isDataTransfer = evt.data instanceof window.Blob;
    if (isDataTransfer) {
      answer = evt.data;
    } else {
      try {
        answer = JSON.parse(evt.data);
      } catch (err) {
        console.warn(`PyEvaluator recived strange websocket answer: ${evt.data}`);
        return;
      }
    }
    this.processAnswer(answer, isDataTransfer);
  }

  processAnswer(msg, isDataTransfer) {
    if (isDataTransfer) {
      if (typeof this.onData === 'function') {
        this.onData(msg);
      }
      return;
    }

    let {taskInProgress} = this;
    if (!taskInProgress) {
      console.warn(`PyEvaluator received answer but no task is in progress! ${JSON.stringify(msg)}`);
      return;
    }

    this.taskInProgress = null;
    let {deferred: {resolve}, messages} = taskInProgress;
    messages.push(msg);
    taskInProgress.result = msg;
    resolve(msg);

    this._workTaskQueue();
  }

  _workTaskQueue() {
    if (this.taskInProgress || !this.taskQueue.length) return Promise.resolve(this.taskInProgress);
    if (!this.isConnected) return this.connect().then(() => this._workTaskQueue());
    let task = this.taskInProgress = this.taskQueue.shift();
    if (task.type === "eval") {
      let {source} = task;
      this.debug && console.log(`[PyEvaluator] sending eval ${source}`);
      this._websocket.send(JSON.stringify({action: "eval", data: {source}}));
    }
    if (task.type === "completion") {
      let {source, row, column, file} = task;
      this.debug && console.log(`[PyEvaluator] sending completion req ${row}/${column} in ${file}`);
      this._websocket.send(JSON.stringify({action: "completion", data: {source, row, column, file}}));
    }
    if (task.type === "code_format") {
      let {source, file, fromRow, toRow, config} = task,
          data = {source, file, config};
      if (fromRow !== undefined && toRow !== undefined) {
        data.lines = [[fromRow + 1, toRow + 1]]
      }
      this.debug && console.log(`[PyEvaluator] sending code_format req ${file}`);
      this._websocket.send(JSON.stringify({action: "code_format", data}));
    }
    if (task.type === "fetchData") {
      let { source } = task;
      this.debug && console.log(`[PyEvaluator] fetching data ${source}`);
      this._websocket.send(JSON.stringify({ action: "fetchData", data: { source } }));
    }
    return Promise.resolve(task);
  }

  async runEval(source) {
    let deferred = promise.deferred();
    this.taskQueue.push({type: "eval", source, deferred, messages: [], result: undefined});
    this._workTaskQueue();
    return deferred.promise;
  }

  async complete(source, row, column, file) {
    let deferred = promise.deferred();
    this.taskQueue.push({type: "completion", source, row, column, file, deferred, messages: [], result: undefined});
    this._workTaskQueue();
    return deferred.promise;
  }

  async formatCode(source, fromRow, toRow, config, file) {
    let deferred = promise.deferred();
    this.taskQueue.push({type: "code_format", source, file, fromRow, toRow, config, deferred, messages: [], result: undefined});
    this._workTaskQueue();
    return deferred.promise;
  }

  async fetchData(source) {
    // 2019-07-07 currently unused and not implemented server side
    // server can trigger data send an this.onData is called in that case
    let deferred = promise.deferred();
    this.taskQueue.push({type: "fetchData", source, deferred, messages: [], result: undefined});
    this._workTaskQueue();
    return deferred.promise;
  }
}
