import { CodeMirrorEnabledEditorPlugin } from "../editor-plugin.js";
import "./mode.js";
import { obj, string, grid } from "lively.lang";
import { resource } from "lively.resources";
import { SQLEvaluator } from "./eval.js";
import { Snippet } from "../text/snippets.js";
import { snippets as sqlSnippets } from "./snippets.js";


// await SQLConnect.connect();
// await SQLConnect.current();
// await SQLConnect.connections();

class SQLConnect {

  static connect() { return new this().interactivelyPromptForConnection(); }
  static current() { return new this().lastConnection(); }
  static connections() { return new this().knownConnections(); }

  knownConnections() {
    try {
      return JSON.parse(localStorage["lively.ide-sql-connections"]);
    } catch (err) { return []; }
  }

  addConnection(connection) {
    let connections = [
      connection,
      ...this.knownConnections().filter(ea => !obj.equals(connection))
    ];
    localStorage["lively.ide-sql-connections"] = JSON.stringify(connections);
    return connection;
  }

  lastConnection() { return this.knownConnections()[0]; }

  async interactivelyAddConnection() {
    let connectionString = await $world.prompt("connection string", {
      historyId: "lively-ide-sql-add-connection"
    });
    return connectionString ? this.addConnection(connectionString) : null;
  }

  async interactivelyPromptForConnection() {
    let connections = this.knownConnections(),
        items = connections.map(ea => ({isListItem: true, string: ea, value: ea}));
    items.unshift("add...");
    let preselect = connections.indexOf(this.lastConnection()) + 1;
    if (preselect === -1) preselect = 0;
    let {selected: [choice]} = await $world.filterableListPrompt("select SQL connections", items, {
      preselect,
      historyId: "lively-ide-sql-connections",
    });
    if (!choice) return null;
    if (choice === "add...") return this.interactivelyAddConnection();
    return choice;
  }
}


export default class SQLEditorPlugin extends CodeMirrorEnabledEditorPlugin {

  constructor() {
    super();
    this.evalEnvironment = {sqlConnection: null};
  }

  get isSQLEditorPlugin() { return true; }
  get shortName() { return "sql"; }
  get longName() { return "sql"; }

  // getNavigator() { return new HTMLNavigator(); }

  getSnippets() {
    return sqlSnippets.map(([trigger, expansion]) =>
      new Snippet({trigger, expansion}));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // js related stuff

  // getCompleters(otherCompleters) { return jsCompleters.concat(otherCompleters); }

  getCommands(otherCommands) {
    return [
      ...otherCommands,
      {
        name: "[sql] connect",
        exec: async () => {
          this.evalEnvironment.connectionString = await SQLConnect.connect();
          return true;
        }
      },
      
      {
        name: "[sql] list databases",
        exec: async () => {
          let {connectionString} = this.evalEnvironment,
              dbs = await this.systemInterface().httpReq({connectionString}, "dbs"),
              printed = string.printTable(grid.tableFromObjects(dbs));
          return $world.execCommand("open text window", {
            title: `Databases of ${connectionString}`,
            content: printed,
            fontFamily: "monospace"
          });
        }
      },
      
      {
        name: "[sql] list tables",
        exec: async () => {
          let {connectionString} = this.evalEnvironment,
              tables = await this.systemInterface().httpReq({connectionString}, "tables"),
              printed = string.printTable(grid.tableFromObjects(tables));
          return $world.execCommand("open text window", {
            title: `Tables of ${connectionString}`,
            content: printed,
            fontFamily: "monospace"
          });
        }
      }
    ];
  }

  // getKeyBindings(other) {
  //   return [
  //     ...other,
  //     {command: "[HTML] cleanup", keys: "Shift-Tab"},
  //     {command: "[HTML] select open and close tag", keys: "Ctrl-Shift-'"},
  //     {command: "[HTML] render in iframe", keys: "Alt-G"},
  //     {command: "[HTML] interactively select HTML node", keys: "Alt-J"},
  //   ];
  // }

  // async getMenuItems(items) {
  //   var editor = this.textMorph,
  //       htmlItems = [];
  //   return htmlItems.concat(items);
  // }

  systemInterface(env) {
    return SQLEvaluator.ensure({...this.evalEnvironment, ...env});
  }

  runEval(code, opts) {
    var endpoint = this.systemInterface();
    return endpoint.runEval(code, this.evalEnvironment);
  }

}