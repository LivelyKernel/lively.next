import worldCommands from 'lively.morphic/world-commands.js';
import { commands as morphCommands } from 'lively.morphic/morph.js';
import Halo from "./morph.js";
import { StatusMessage, StatusMessageForMorph, show } from "./markers.js";
import { arr } from "lively.lang";

export const haloCommands = [
  {
    name: 'open halo',
    exec: (_, args) => {
      return new Halo(args);
    }
  },
   {
    name: 'create status message',
    exec: (world, args) => {
      return new StatusMessage(args)
    }
  },
  {
    name: 'create status message for morph',
    exec: (world, args) => {
      return new StatusMessageForMorph(args)
    }
  },
  {
    name: 'show marker',
    exec: (_, obj) => {
       show(obj)
    }
  }
];

export {StatusMessage, Halo, show, StatusMessageForMorph};

morphCommands.push(...arr.filter(haloCommands, haloCmd =>
  !morphCommands.find(morphCmd => morphCmd.name == haloCmd.name)))

worldCommands.push(...arr.filter(haloCommands, haloCmd =>
  !worldCommands.find(worldCmd => worldCmd.name == haloCmd.name)))
