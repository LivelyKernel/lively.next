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

  exec(command, morph, args, count, evt) {
    let name = !command || typeof command === "string" ? command : command.command,
        cmd = command && morph.commands.find(ea => ea.name === name);

    this.addToHistory(name);

    var result;
    if (cmd && typeof cmd.exec === "function") {
      result = cmd.exec(morph, args, cmd.handlesCount ? count : undefined, evt);
    }

    // to not swallow errors
    if (result && typeof result.catch === "function") {
      result.catch(err => {
        console.error(`Error in interactive command ${name}: ${err.stack}`);
        throw err;
      });
    }

    // handle count by repeating command
    if (result && typeof count === "number" && count > 1 && !cmd.handlesCount) {
      return typeof result.then === "function" ?
        result.then(() => this.exec(command, morph, args, count-1, evt)) :
        this.exec(command, morph, args, count-1, evt);
    }

    return result;
  }

}
