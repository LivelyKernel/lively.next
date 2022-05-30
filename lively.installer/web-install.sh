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

LIVELY_FLATN_DIR="$PWD/flatn"
LIVELY_FLATN_VERSION=master
LIVELY_FLATN_REPO="https://github.com/rksm/flatn"

install_with_git() {
  NAME=$1
  REPO=$2
  DEST_DIR=$3
  VERSION=$4

  if [ -d "$DEST_DIR/.git" ]; then
    echo "=> $NAME is already installed in $DEST_DIR, trying to update using git"
    printf "\r=> "
    cd "$DEST_DIR" && (command git fetch 2> /dev/null || {
      echo >&2 "Failed to update $NAME, run 'git fetch' in $DEST_DIR yourself." && exit 1
    })
    git pull 2> /dev/null

  else

    # Cloning to $DEST_DIR
    echo "=> Downloading $NAME from git to '$DEST_DIR'"
    printf "\r=> "
    mkdir -p "$DEST_DIR"
    command git clone $REPO "$DEST_DIR"
  fi
  # cd "$DEST_DIR" && command git checkout --quiet "$VERSION"
  cd "$DEST_DIR" && command git checkout "$VERSION"
  if [ ! -z "$(cd "$DEST_DIR" && git show-ref refs/heads/master)" ]; then
    if git branch --quiet 2>/dev/null; then
      cd "$DEST_DIR" && command git branch --quiet -D master >/dev/null 2>&1
    fi
  fi
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

  install_with_git \
    lively.installer \
    $LIVELY_INSTALLER_REPO \
    $LIVELY_INSTALLER_DIR \
    $LIVELY_INSTALLER_VERSION

  install_with_git \
    flatn \
    $LIVELY_FLATN_REPO \
    $LIVELY_FLATN_DIR \
    $LIVELY_FLATN_VERSION

  echo "=> lively.installer sucessfully downloaded & intialized"
}

install_rest() {
  cd $LIVELY_INSTALLER_DIR
  node --no-warnings --experimental-loader $LIVELY_FLATN_DIR/resolver.mjs $LIVELY_INSTALLER_DIR/bin/install.cjs "$LIVELY_INSTALLER_DIR/.."
  cd ..
  return
}

install_installer
install_rest

} # this ensures the entire script is only run when completely downloaded #
