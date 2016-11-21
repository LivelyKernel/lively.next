import { string, arr } from "lively.lang";
import { runCommand } from "./shell-interface.js";

export async function spellCheckWord(word) {
  // await spellCheckWord("hrlp")
  // for input "hrlp" aspell returns the output:
  // @(#) International Ispell Version 3.1.20 (but really Aspell 0.60.6.1)
  // & hrlp 5 0: help, harelip, helper, Harold, herald

  word = word.trim();
  if (!word) return [];

  var cmd = runCommand('aspell -a', {stdin: word});
  await cmd.whenDone()

  if (cmd.exitCode)
    throw new Error("Spell checking failed:\n" + cmd.stderr);

  var result = string.lines(cmd.stdout)[1];
  // if there are suggestions they come after a ":"
  if (!result || !result.length || !result.includes(':')) return [];
  var suggestions = arr.last(result.split(':')).trim().split(/,\s?/);
  return suggestions
}