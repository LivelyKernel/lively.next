import CommandHandler from './command-handler.js';

let defaultCommandHandler = new CommandHandler();

let CommandTrait = {
  get commands () { return this._commands || []; },

  set commands (cmds) {
    if (this._commands) this.removeCommands(this._commands);
    this.addCommands(cmds);
  },

  get commandsIncludingOwners () {
    return lively.lang.arr.flatmap([this].concat(this.ownerChain()), morph =>
      lively.lang.arr.sortByKey(morph.commands, 'name')
        .map(command => ({ target: morph, command })));
  },

  addCommands (cmds) {
    this.removeCommands(cmds);
    this._commands = (this._commands || []).concat(cmds);
  },

  removeCommands (cmdsOrNames) {
    let names = cmdsOrNames.map(ea => typeof ea === 'string' ? ea : ea.name);
    let commands = (this._commands || []).filter(({ name }) => !names.includes(name));
    if (!commands.length) delete this._commands;
    else this._commands = commands;
  },

  get commandHandler () {
    return this._commandHandler || defaultCommandHandler;
  },

  lookupCommand (commandOrName) {
    let result = this.commandHandler.lookupCommand(commandOrName, this);
    return result && result.command ? result : null;
  },

  execCommand (command, args, count, evt) {
    return this.commandHandler.exec(command, this, args, count, evt);
  }
};

export default CommandTrait;
