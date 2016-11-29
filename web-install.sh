#!/usr/bin/env bash

{ # this ensures the entire script is downloaded #
  

if [ -z "$LIVELY_INSTALLER_REPO" ]; then
  LIVELY_INSTALLER_REPO="https://github.com/LivelyKernel/lively.installer"
fi

if [ -z "$LIVELY_INSTALLER_VERSION" ]; then
  LIVELY_INSTALLER_VERSION=master
fi

if [ -z "$LIVELY_INSTALLER_DIR" ]; then
  LIVELY_INSTALLER_DIR="$PWD/lively.installer"
fi

install_from_git() {
  if [ -d "$LIVELY_INSTALLER_DIR/.git" ]; then
    echo "=> lively.installer is already installed in $LIVELY_INSTALLER_DIR, trying to update using git"
    printf "\r=> "
    cd "$LIVELY_INSTALLER_DIR" && (command git fetch 2> /dev/null || {
      echo >&2 "Failed to update lively.installer, run 'git fetch' in $LIVELY_INSTALLER_DIR yourself." && exit 1
    })
    git pull 2> /dev/null

  else

    # Cloning to $LIVELY_INSTALLER_DIR
    echo "=> Downloading lively.installer from git to '$LIVELY_INSTALLER_DIR'"
    printf "\r=> "
    mkdir -p "$LIVELY_INSTALLER_DIR"
    command git clone $LIVELY_INSTALLER_REPO "$LIVELY_INSTALLER_DIR"
  fi
  # cd "$LIVELY_INSTALLER_DIR" && command git checkout --quiet "$LIVELY_INSTALLER_VERSION"
  cd "$LIVELY_INSTALLER_DIR" && command git checkout "$LIVELY_INSTALLER_VERSION"
  if [ ! -z "$(cd "$LIVELY_INSTALLER_DIR" && git show-ref refs/heads/master)" ]; then
    if git branch --quiet 2>/dev/null; then
      cd "$LIVELY_INSTALLER_DIR" && command git branch --quiet -D master >/dev/null 2>&1
    fi
  fi
  return
}

npm_install() {
  cd $LIVELY_INSTALLER_DIR;
  npm install;
  cd ..
  return
}


install_installer() {
  
  which git >/dev/null 2>&1;
  if [[ $? -ne 0 ]]; then
    echo >&2 "git is not installed, cannot install Lively!"
    exit 1
  fi

  which node >/dev/null 2>&1;
  if [[ $? -ne 0 ]]; then
    echo >&2 "node.js is not installed, cannot install Lively!"
    exit 1
  fi

  export NPM_VERSION=$(npm -v)

node -e "$(cat <<'EOF'
var version = process.env.NPM_VERSION,
    match = version.match(/([0-9]+)\.([0-9]+)\.([0-9]+)/);
if (!match || Number(match[1]) > 2) {
  console.log('npm version 2 is required, you have version ' + version);
  process.exit(1);
}
EOF
)";

  if [[ $? -ne 0 ]]; then
    echo >&2 "stopping, unsupported npm version"
    exit 1
  fi


  install_from_git
  npm_install

  echo "=> lively.installer sucessfully downloaded & intialized"
}

install_rest() {
  cd $LIVELY_INSTALLER_DIR
  node install-with-node.js "$LIVELY_INSTALLER_DIR/.."
  cd ..
  return
}

install_installer
install_rest

} # this ensures the entire script is downloaded #