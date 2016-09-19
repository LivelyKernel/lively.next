import { obj, arr } from "lively.lang";

function printArg(x) {
  return obj.inspect(x, {maxDepth: 1}).replace(/\n/g, "").replace(/\s+/g, " ");
}

export default class CommandHandler {

  constructor() {
    this.history = [];
    this.maxHistorySize = 300;
  }

  addToHistory(cmdName) {
    this.history.push(cmdName);
    if (this.history.length > this.maxHistorySize)
      this.history.splice(0, this.history.length - this.maxHistorySize);
  }

  printHistory() {
    return this.history.map(({name, target: {string: targetName}, args, count}) =>
      `${name} ${args ? printArg(args) : ""}${typeof count === "number" ? ` x${count}` : ""} ${targetName}`)
        .join("\n");
  }

  exec(commandOrName, morph, args, count, evt, afterExecFn) {
    // commandOrName can be
    // 1. a string, naming a command in morphs.commands
    // 2. a spec object like {command: "cmd name", args: {...}, handlesCount: BOOL, }
    // 3. a proper command object {name: STRING, exec: FUNCTION, ....}

    var name, command;

    if (!commandOrName) return null;

    if (typeof commandOrName === "string") name = commandOrName;
    if (typeof commandOrName.command === "string") name = commandOrName.command;

    if (commandOrName.exec) {
      command = commandOrName;
      name = command.name;
    }

    if (!command) command = morph.commands.find(ea => ea.name === name);

    if (!command) {
      console.warn(`Cannot find command ${name}`);
      return null;
    }

    name && this.addToHistory({name, target: {string: String(morph), id: morph.id}, args, count, time: Date.now()});

    var world = morph.world(), result;

    if (command && typeof command.exec === "function") {
        try {
          result = command.exec(morph, args, command.handlesCount ? count : undefined, evt);
        } catch(err) {
          result = err;
          var msg = `Error in interactive command ${name}: ${err.stack || err}`;
          world ? world.logError(msg) : console.error(msg);
        }
    }

    // to not swallow errors
    if (result && typeof result.catch === "function") {
      result.catch(err => {
        var msg = `Error in interactive command ${name}: ${err.stack || err}`;
        world ? world.logError(msg) : console.error(msg);
        throw err;
      });
    }

    // handle count by repeating command
    if (result && typeof count === "number" && count > 1 && !command.handlesCount) {
      result = typeof result.then === "function" ?
        result.then(() => this.exec(command, morph, args, count-1, evt, null)) :
        this.exec(command, morph, args, count-1, evt, null);
    }

    if (result && typeof afterExecFn === "function") {
      typeof result.then === "function" ?
        result.then(result => afterExecFn(result, command, morph, args, count, evt)) :
        afterExecFn(result, command, morph, args, count, evt);
    }

    return result;
  }

}
