#!/bin/bash

target_dir="lively.morphic/examples/initial"

function diff_files {
  diff -u {${target_dir}/,}fix-links.js
  diff -u {${target_dir}/,}index.html
  diff -u {${target_dir}/,}index.js
  diff -u {${target_dir}/,}package.json
  diff -u {${target_dir}/,}start.sh
  diff -u {${target_dir}/,}update.sh
  diff -u {${target_dir}/,}backup.sh
  diff -u {${target_dir}/,}rebuild.sh
}

function install {
  cp {,${target_dir}/}fix-links.js
  cp {,${target_dir}/}index.html
  cp {,${target_dir}/}index.js
  cp {,${target_dir}/}package.json
  cp {,${target_dir}/}start.sh
  cp {,${target_dir}/}update.sh
  cp {,${target_dir}/}backup.sh
  cp {,${target_dir}/}rebuild.sh
}

diff_files

while true; do
    read -p "Copy to $target_dir?" yn
    case $yn in
        [Yy]* ) install; break;;
        [Nn]* ) exit;;
        * ) echo "Please answer yes or no.";;
    esac
done
