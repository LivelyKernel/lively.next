#!/bin/bash

function lively_next_env {
    lv_next_dir=$1
    export NODE_OPTIONS="--max_old_space_size=8192 --loader $lv_next_dir/flatn/resolver.mjs"
    export PUPPETEER_CACHE_DIR=$lv_next_dir/.puppeteer-browser-cache
    export PATH=$lv_next_dir/flatn/bin:$PATH
    export FLATN_PACKAGE_DIRS=
    export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules:$lv_next_dir/custom-npm-modules
    mkdir -p $lv_next_dir/lively.next-node_modules
    mkdir -p $lv_next_dir/custom-npm-modules
    mkdir -p $lv_next_dir/local_projects
    mkdir -p $lv_next_dir/esm_cache
    read -r -d '' SETUP_FLATN_DEV_PACKAGE_DIRS <<- EOM
        const fs = require("fs");
        const packageConfig = fs.readFileSync("$lv_next_dir/lively.installer/packages-config.json");
        const packageDirs = JSON.parse(packageConfig).map(ea => "$lv_next_dir/" + ea.name);
        const localProjects = fs.existsSync("$lv_next_dir/local_projects")
            ? fs.readdirSync("$lv_next_dir/local_projects", { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => "$lv_next_dir/local_projects/" + dirent.name)
            : [];
        packageDirs.concat(localProjects).join(":");
EOM
    export FLATN_DEV_PACKAGE_DIRS=$(node -p "${SETUP_FLATN_DEV_PACKAGE_DIRS}")
    export lv_next_dir=$lv_next_dir
}
