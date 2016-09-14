export default class CommandHandler {

  constructor() {
    this.history = [];
    this.maxHistorySize = 300;
  }

  addToHistory(cmdName) {;
    this.history.push(cmdName);
    if (this.history.length > this.maxHistorySize)
      this.history.splice(0, this.history.length - this.maxHistorySize);
  }

  exec(commandOrName, morph, args, count, evt) {
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

    name && this.addToHistory(name);

    var result;
    if (command && typeof command.exec === "function") {
      result = command.exec(morph, args, command.handlesCount ? count : undefined, evt);
    }

    // to not swallow errors
    if (result && typeof result.catch === "function") {
      result.catch(err => {
        console.error(`Error in interactive command ${name}: ${err.stack}`);
        throw err;
      });
    }

    // handle count by repeating command
    if (result && typeof count === "number" && count > 1 && !command.handlesCount) {
      return typeof result.then === "function" ?
        result.then(() => this.exec(command, morph, args, count-1, evt)) :
        this.exec(command, morph, args, count-1, evt);
    }

    return result;
  }

}
