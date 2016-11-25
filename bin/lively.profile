# sourced for lively commands

function normalize_path {
  echo $(cd "$1"; pwd);
}

function cd! {
  DIR=$(normalize_path "$1")
  send-to-lively.sh \
    changeWorkingDirectory \
    $DIR \
    $LIVELY_COMMAND_OWNER > /dev/null;
  cd $DIR
}
