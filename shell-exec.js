import { exec as node_exec } from "child_process";

export async function exec(cmdString, opts) {
  opts = Object.assign({cwd: undefined, log: []}, opts)

  opts.log && opts.log.push(`$ ${cmdString}\n`);
  
  if (System.get("@system-env").node) {
    var proc, e, stdout, stderr;
    await new Promise((resolve, reject) =>
      proc = node_exec(cmdString, {cwd: opts.cwd},
      (err, _stdout, _stderr) => { e = err; stdout = _stdout, stderr = _stderr; resolve(); }));
    var cmd = {
      code: proc.exitCode,
      output: (e ? "\n"+String(e) : "") + stdout + "\n" + stderr,
      stdout: stdout };
    opts.log.push(cmd.output);
  } else {
    let { runCommand } = await System.import("lively.morphic/ide/shell/shell-interface.js");
    var cmd = await runCommand(cmdString, {cwd: opts.cwd});
    if (opts.log) {
      cmd.on("stdout", out => opts.log.push(out));
      cmd.on("stderr", out => opts.log.push(out));
    }
    await cmd.whenDone();
  }
  return cmd;
}
