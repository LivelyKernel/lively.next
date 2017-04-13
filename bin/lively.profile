# sourced for lively commands

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
