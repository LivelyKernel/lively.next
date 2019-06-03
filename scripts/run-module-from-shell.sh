#!/bin/bash

# call like
#   ./run-module-from-shell.sh --packages lively.installer lively.resources --script ./git-status-fancy.js#
#
# call with --packages to load packages required to run script
# use --script to specify a script in lively.modules format that should be
# loaded after packages are registersed

lv_next_dir=$PWD

. $lv_next_dir/lively.installer/assets/lively-next-flatn-env.sh
lively_next_flatn_env $lv_next_dir

# ln -sf $lv_next_dir/mocha-es6/bin/{mocha-es6.js,mocha-es6}
# export PATH=$lv_next_dir/mocha-es6/bin:$PATH

# node \
#     -e "global.babel = require('/home/robert/projects/lively/l2l-node/node_modules/babel-standalone'); global.System = require('/home/robert/projects/lively/l2l-node/node_modules/systemjs'); require('./l2l-node/lively.modules.js'); require('./l2l-node/lively.modules.js');" \
#     -i

read -r -d '' CODE <<- EOM
     const args = "${@}".split(" ");
     const scriptIdx = args.indexOf("--script");
     const script = scriptIdx > -1 ? args[scriptIdx+1] : null;
     if (!script || !require('fs').existsSync('./git-status-fancy.js')) {
     	console.error('script not existing: ' + script);
     	console.error('Specify a script (in lively module format) to be executed with --script');
     	process.exit(1);
     }

     let packages = [];
     const packagesStart = args.indexOf("--packages");
     let packagesEnd = args.length;
     if (packagesStart > -1) {
     	for (let i = packagesStart+1; i < args.length; i++) {
	    if (args[i].startsWith("--")) {
	       packagesEnd = i;
	       break;
	    }
	}
	packages = args.slice(packagesStart+1, packagesEnd);
	args.splice(packagesStart, packagesEnd - packagesStart);
     }
     global.babel = require('${lv_next_dir}/lively.installer/deps/babel.min.js');
     global.System = require('${lv_next_dir}/lively.installer/deps/system.src.js');
     require('${lv_next_dir}/lively.installer/deps/lively.modules.js');
     Promise.all(packages.map(p => lively.modules.registerPackage(p)))
       .then(() => lively.modules.module(script).load())
       .catch(err => console.error(err));
EOM

node -e "${CODE}"
