var dir = "/Users/tvsmith/Documents/HARC/InstallerTest/LivelyKernel"
var branch = "new-module-system";

// await updateDirectoryFromGit(dir, branch)


var output = `Updating 3573567..9d7264d
From file:///Users/robert/Lively/LivelyKernel2/test-git-2
 * branch            master     -> FETCH_HEAD
error: The following untracked working tree files would be overwritten by merge:
	bar.txt
	bar2.txt
Please move or remove them before you can merge.
Aborting`

async function tryPullWithoutUntrackedFiles(originalPullOutput, dir, branch) {
  var untrackedRe = /untracked working tree files would be overwritten/;
  if (!originalPullOutput.match(untrackedRe)) return;
  var lines = lively.lang.string.lines(originalPullOutput);
  var index = lines.findIndex((line) => line.match(untrackedRe));
  var overwrittenFiles = lines.slice(index+1)
                          .filter(line => line.match(/^\s/))
                          .map(line => line.trim());
  await lively.shell.run(`mkdir -p .lively-git-helper; mv ${overwrittenFiles.join(" ")}; .lively-git-helper;`, {cwd: dir})
  var {code, output: gitPullOut} = await lively.shell.run(`git pull`, {cwd: dir});
  await lively.shell.run(`mv ${overwrittenFiles.map(f => ".lively-git-helper/" + f).join(" ")}; .;`, {cwd: dir});
  if (code !== 0) throw new Error(gitPullOut);
}

async function updateDirectoryFromGit(dir, branch) {
  if (!await hasRemoteChanges(dir, branch)) return;
  var answer = await $world.confirm(`Do you want to update the package in ${dir}?`);
  if (!answer) return;
  var {output, code} = await lively.shell.run(`git status --short -uno`, {cwd: dir});
  if (code !== 0) throw new Error(output);
  var stashed = false;
  if (output.trim().length) {
    stashed = true;
    var {code} = await lively.shell.run(`git stash`, {cwd: dir});
    if (code !== 0) throw new Error(output);
  }
  var {code} = await lively.shell.run(`git pull`, {cwd: dir});
  if (code !== 0) throw new Error(output);

  if (stashed) {
    var {code} = await lively.shell.run(`git stash pop`, {cwd: dir});
    if (code !== 0) throw new Error(output);
  }
}



async function hasRemoteChanges(repoDir, branch) {
  var {local, remote} = await getRemoteAndLocalHeadRef(dir, branch);
  return local !== remote;
}

async function getRemoteAndLocalHeadRef(repoDir, branch) {
  var cmdString = 'if [[ ! -d ' + repoDir + ' ]]; then echo \'does not exist\'; else ' + 'cd ' + repoDir + '; remote=`git ls-remote origin ' + branch + '`;\n' + 'local=`git show-ref --hash ' + branch + ' | tail -n 1`;\n' + 'echo "{\\"remote\\": \\"$remote\\", \\"local\\": \\"$local\\"}"; fi;';
  return Promise.resolve().then(() =>
    lively.shell.run(cmdString, {}).then(cmd => {
      if (cmd.output.match(/does not exist/))
          return {
              remote: '',
              local: repoDir + ' does not exist'
          };
      var out;
      try {
          out = JSON.parse(cmd.output.replace(/\s/g, ' '));
      } catch (e) {
          show('cd ' + repoDir + '\n' + cmdString + '\n' + cmd.output);
          throw e;
      }
      var remoteRef = (out.remote || '').trim().split(' ').first(), localRef = (out.local || '').trim().split(' ').first(), result = {
              remote: remoteRef,
              local: localRef
          };
      return result
    }))
  ;
}