#!/bin/bash

# echo ">>> Building lively.lang <<<"
# pushd lively.lang;
# npm run build;
# popd

echo ">>> Building lively.notifications <<<"
pushd lively.notifications;
npm run build;
popd

echo ">>> Building lively.resources <<<"
pushd lively.resources;
npm run build;
popd

echo ">>> Building lively.ast <<<"
pushd lively.ast;
npm run build;
popd

echo ">>> Building lively.source-transform <<<"
pushd lively.source-transform;
npm run build;
popd

echo ">>> Building lively.vm <<<"
pushd lively.vm;
npm run build;
popd

echo ">>> Building lively.classes <<<"
pushd lively.classes;
npm run build;
popd

echo ">>> Building lively.modules <<<"
pushd lively.modules;
npm run build;
popd

