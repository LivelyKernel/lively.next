"format esm";

var remoteLively = "https://dev.lively-web.org/";
var category = "PartsBin/lively.modules";
await updatePartsBin(remoteLively, category);

export async function updatePartsBin(livelyURL, partSpace) {
  livelyURL = new URL(livelyURL);  
  var localPartSpace = lively.PartsBin.partsSpaceNamed(partSpace);
  var remotePartSpace = lively.PartsBin.partsSpaceWithURL(livelyURL.join(partSpace));
  localPartSpace.load();
  remotePartSpace.load();
  var upToDatePartMsg = "";
  for (let remoteItem of remotePartSpace.getPartItems()) {
    let remoteItemName = remoteItem.name;
    let localItem = localPartSpace.partItems[remoteItemName];
    let confirmed = false;
    if (localItem) {
      let localMeta = localItem.getMetaInfo(), remoteMeta = remoteItem.getMetaInfo();
      let { localModified, remoteModified } = getBranchInfo(localMeta.changes, remoteMeta.changes);
      if (remoteModified) {
        let postMsg = "\n" + getAgeMsg(localMeta.date.valueOf(), remoteMeta.date.valueOf());
        if (localModified) {
          postMsg += "WARNING: This part has been modified locally."
        }
        confirmed = await confirmPartItem("update", remoteItemName, postMsg);
      } else if (localModified) {
        upToDatePartMsg += `${localItem.name} has been modified locally.\n`;
      } else {
        upToDatePartMsg += `"${localItem.name}" is up to date.\n`;
      }
    } else {
        confirmed = await confirmPartItem("install new", remoteItemName);
    }
    if (confirmed) {
      lively.PartsBin.copyRemotePart(remoteItemName, partSpace, livelyURL);
    }
  }
  if (upToDatePartMsg !== "") {
    $world.openDialog(new lively.morphic.InformDialog(upToDatePartMsg));
  }
}

function getBranchInfo(localChanges, remoteChanges) {
  let branchPoint;
  let localModified = false, remoteModified = false;
  while (!branchPoint) {
    let localHead = localChanges[0];
    let remoteHead = remoteChanges[0];
    let localHeadID = localHead.id;
    let remoteHeadID = remoteHead.id;
    let localHeadTime = localHead.date.valueOf();
    let remoteHeadTime = remoteHead.date.valueOf();
    if (localHeadTime > remoteHeadTime) {
      localModified = true;
      localChanges.shift();
    } else if (localHeadTime < remoteHeadTime) {
      remoteModified = true;
      remoteChanges.shift();
    } else if (localHeadID === remoteHeadID) {
      branchPoint = localHead;
    } else {
     /* Times are equal but IDs are not (!)... 
     /* This is theoretically possible (changes occured during the same second?),
      * but presumably rare enough that we shouldn't need to handle it...
      */
      throw new Error("Unhandled condition: two part changes have the same time, but different IDs");
    }
  }
  return { localModified: localModified, remoteModified: remoteModified };
}

function getAgeMsg(localDateVal, remoteDateVal) {
  if (localDateVal === remoteDateVal) {
    return "The modification dates are equal.";
  } else {
    return `The remote part is ${ remoteDateVal < localDateVal ? "older" : "newer"}.`;
  }
}

function confirmPartItem(action, name, postMsg) {
  if (!postMsg) postMsg = "";
  return $world.confirm(`Do you want to ${action} part "${name}"?` + postMsg);
}

