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
      output: (e ? "\n"+String(e) : "") + stdout + "\n" + stderr};
    opts.log.push(cmd.output);
  } else {
    var cmd = lively.shell.run(cmdString, {cwd: opts.cwd});
    if (opts.log) {
      lively.bindings.connect(cmd, 'stdout', opts.log, 'push', {updater: function ($upd, x) { return $upd(this.targetObj, x); }});
      lively.bindings.connect(cmd, 'stderr', opts.log, 'push', {updater: function ($upd, x) { return $upd(this.targetObj, x); }});
    }
  }
  return cmd;
}
