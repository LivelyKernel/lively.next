function lively_next_flatn_env {
    lv_next_dir=$1
    echo "Setting env vars for FLATN_PACKAGE_DIRS, FLATN_PACKAGE_COLLECTION_DIRS, FLATN_DEV_PACKAGE_DIRS for lively.next"
    export PATH=$lv_next_dir/flatn/bin:$PATH
    export FLATN_PACKAGE_DIRS=
    export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules:$lv_next_dir/custom-npm-modules
    read -r -d '' SETUP_FLATN_DEV_PACKAGE_DIRS <<- EOM
        const packageConfig = require("fs").readFileSync("$lv_next_dir/lively.installer/packages-config.json");
        const packageDirs = JSON.parse(packageConfig).map(ea => "$lv_next_dir/" + ea.name);
        packageDirs.join(":")
EOM
    export FLATN_DEV_PACKAGE_DIRS=$(node -p "${SETUP_FLATN_DEV_PACKAGE_DIRS}")
}
