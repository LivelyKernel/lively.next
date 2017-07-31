/*global System*/
import { show } from "lively.halos/markers.js";
import textCommands from 'lively.morphic/text/commands.js';
import worldCommands from 'lively.morphic/world-commands.js';
import { arr } from "lively.lang";
import { completionCommands } from "./text/completion.js";

async function lazyInspect(obj) {
  // lazy load
  var {inspect: realInspect} = await System.import("lively.ide/js/inspector.js")
  inspect = realInspect;
  return realInspect(obj);
}

export var inspect = lazyInspect;

export const ideCommands = [
  {
  name: "open object inspector",
  exec: async (world, args = {target: null}) => {
      if (!args.target) {
        world.setStatusMessage("no target for Inspector");
        return null;
      }
      return inspect(args.target);
    }
  },
  {
    name: "install global inspect and show",
    exec: world => {
      window.show = show;
      window.inspect = inspect;
      world.setStatusMessage(`inspect() and show() are now globally available`);
      return true;
    }
  }
];

textCommands.push(...arr.filter([...completionCommands], haloCmd =>
  !textCommands.find(worldCmd => worldCmd.name == haloCmd.name)))

worldCommands.push(...arr.filter([...ideCommands], haloCmd =>
  !worldCommands.find(worldCmd => worldCmd.name == haloCmd.name)))
