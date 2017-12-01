import { resource } from "lively.resources";
import { string, grid } from "lively.lang";

export class SQLEvaluator {

  static fixOpts(opts) {
    if (!opts.connectionString) throw new Error("needs connection string");
    return opts;
  }

  static ensure(opts) {
    opts = this.fixOpts(opts);
    let instances = this._instances || (this._instances = {}),
        id = opts.connectionString;
    return instances[id] || (instances[id] = new this(opts));
  }

  constructor(opts = {}) {
    opts = this.constructor.fixOpts(opts);
    this.connectionString = opts.connectionString;
    this.taskQueue = [];
    this.taskInProgress = null;
    this.debug = false;
  }

  async runEval(source) {
    return this.queryViaSubserver(this.connectionString, source);
  }

  async complete(source, row, column, file) {
    throw new Error("nyi");
    return null;
  }

  async httpReq(opts, endpoint, serverURL = document.location.origin) {
    let r = resource(serverURL).withPath(`subserver/SQLConnector/${endpoint}`).noErrorOnHTTPStatusCodes(),
        result = await r.post(opts);
    if (result.error) throw result.error;
    return result;
  }

  async queryViaSubserver(connectionString, query, args, serverURL = document.location.origin) {
    let r = resource(serverURL).withPath("subserver/SQLConnector/query").noErrorOnHTTPStatusCodes(),
        result = await r.post({connectionString, query, args});
    if (result.error) return {isError: !!result.error, value: result.error};
    if (result.rows) return {value: string.printTable(grid.tableFromObjects(result.rows))};
    if (result.output) return {value: result.output};
    return {value: result};
  }

}
