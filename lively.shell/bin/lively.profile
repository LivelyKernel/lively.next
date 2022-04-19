# sourced for lively commands

eval $( node -e 'let pathParts = process.env.PATH.split(":"); let found = pathParts.findIndex(ea => ea.endsWith("flatn/bin")); if (found > 0) { console.log("export PATH=" + [...pathParts.splice(found, 1), ...pathParts].join(":").replace(/([ ])/g, "\\$1"));}' )

function normalize_path {
  echo $(builtin cd "$1"; pwd);
}

function cd {
  DIR=$(normalize_path "$1")
  send-to-lively.sh \
    changeWorkingDirectory \
    $DIR \
    $LIVELY_COMMAND_OWNER > /dev/null;
  builtin cd "${DIR}"
}

function em {
  # lively-as-editor.sh "$1" 2&> /dev/null
  lively-as-editor.sh "$1" &> /dev/null
}

function find_in_lively {
  builtin cd "$LIVELY"
  FILE_MATCH=${1:-'*.js'}
  # -print0
  PRINT=${2:--print}
  find . \( \
    -name node_modules \
    -o -name bower_components \
    -o -name .module_cache \
    -o -name lively.next-node_modules \
    -o -name lively.app \
    -o -name livelify-web.js \
    -o -name dist \
  \) -prune -o \
  -iname "$FILE_MATCH" -type f $PRINT
}

function grep_in_lively {
  FILE_MATCH=${2:-'*.js'}
  builtin cd "$LIVELY";
  find_in_lively "$FILE_MATCH" -print0 | xargs -0 grep -nH $1
}

