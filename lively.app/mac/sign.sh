#!/bin/bash

VERSION=$1

# Name of your app.
APP="lively"
# The path of your app to sign.
APP_PATH="build/lively-darwin-x64/lively.app"
# The path to the location you want to put the signed package.
RESULT_PATH="build/lively-darwin-x64/$APP.$VERSION.pkg"
# The name of certificates you requested.
APP_KEY="Developer ID Application: Robert Krahn (BX6G5LDCXH)"
INSTALLER_KEY="Developer ID Installer: Robert Krahn (BX6G5LDCXH)"
# The path of your plist files.
CHILD_PLIST="mac/child.plist"
PARENT_PLIST="mac/parent.plist"

FRAMEWORKS_PATH="$APP_PATH/Contents/Frameworks"

# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Squirrel.framework"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/ReactiveCocoa.framework"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Mantle.framework"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Electron Framework"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Libraries/libnode.dylib"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/Electron Framework.framework"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper.app/Contents/MacOS/$APP Helper"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper.app/"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper EH.app/Contents/MacOS/$APP Helper EH"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper EH.app/"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper NP.app/Contents/MacOS/$APP Helper NP"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$FRAMEWORKS_PATH/$APP Helper NP.app/"
# codesign -s "$APP_KEY" -f --entitlements "$CHILD_PLIST" "$APP_PATH/Contents/MacOS/$APP"
# codesign -s "$APP_KEY" -f --entitlements "$PARENT_PLIST" "$APP_PATH"
# 
# productbuild --component "$APP_PATH" /Applications --sign "$INSTALLER_KEY" "$RESULT_PATH"

codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/Squirrel.framework"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/ReactiveCocoa.framework"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/Mantle.framework"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Electron Framework"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Libraries/libffmpeg.dylib"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/Electron Framework.framework/Versions/A/Libraries/libnode.dylib"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/Electron Framework.framework"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/$APP Helper.app/Contents/MacOS/$APP Helper"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/$APP Helper.app/"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/$APP Helper EH.app/Contents/MacOS/$APP Helper EH"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/$APP Helper EH.app/"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/$APP Helper NP.app/Contents/MacOS/$APP Helper NP"
codesign -s "$APP_KEY" -f "$FRAMEWORKS_PATH/$APP Helper NP.app/"
codesign -s "$APP_KEY" -f "$APP_PATH/Contents/MacOS/$APP"
codesign -s "$APP_KEY" -f "$APP_PATH"

productbuild --component "$APP_PATH" /Applications --sign "$INSTALLER_KEY" "$RESULT_PATH"
