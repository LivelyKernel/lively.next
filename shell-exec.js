import { exec as node_exec } from "child_process";

export async function exec(cmdString, opts) {
  opts = Object.assign({cwd: undefined, log: []}, opts)

  opts.log && opts.log.push(`$ ${cmdString}\n`);
  
  if (System.get("@system-env").node) {
    var proc, e, o;
    await new Promise((resolve, reject) =>
      proc = node_exec(cmdString, {cwd: opts.cwd},
      (err, out) => { e = err; o = out; resolve(); }));
    var cmd = {
      code: proc.exitCode,
      output: (o || "") + (e ? "\n"+String(e) : "")};
  } else {
    var cmd = lively.shell.run(cmdString, {cwd: opts.cwd});
    if (opts.log) {
      lively.bindings.connect(cmd, 'stdout', opts.log, 'push', {updater: ($upd, x) => $upd(x)});
      lively.bindings.connect(cmd, 'stderr', opts.log, 'push', {updater: ($upd, x) => $upd(x)});
    }
  }

  return cmd;
}
