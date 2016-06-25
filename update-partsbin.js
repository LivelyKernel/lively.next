"format esm";

// var remoteLively = "https://dev.lively-web.org/";
// var category = "PartsBin/lively.modules";
// await updatePartsBin(remoteLively, category);

export async function updatePartsBin(livelyURL, partSpace) {
  // Load parts in partSpace on local and remote servers
  livelyURL = new URL(livelyURL);
  var localPartSpace = lively.PartsBin.partsSpaceNamed(partSpace);
  var remotePartSpace = lively.PartsBin.partsSpaceWithURL(livelyURL.join(partSpace));
  localPartSpace.load();
  remotePartSpace.load();
  var summary = "";
  // For each remote part...
  for (let remoteItem of remotePartSpace.getPartItems()) {
    let remoteItemName = remoteItem.name;
    let localItem = localPartSpace.partItems[remoteItemName];
    let action, postMsg;
    summary += `'${remoteItemName}' `;
    // Find out if we need to update or install the part locally
    if (localItem) {
      let localMeta = localItem.getMetaInfo(), remoteMeta = remoteItem.getMetaInfo();
      let localChangesSorted = localMeta.changes.sortByKey("date");
      let remoteChangesSorted = remoteMeta.changes.sortByKey("date");
      let { localModified, remoteModified } = getBranchInfo(localChangesSorted, remoteChangesSorted);
      if (remoteModified) {
        postMsg = "\n" + getAgeMsg(localMeta.date.valueOf(), remoteMeta.date.valueOf());
        if (localModified) {
          postMsg += "WARNING: This part has been modified locally!"
        }
        action = "update";
      }
      if (localModified) {
        summary += "locally modified --";
      }
    } else {
      action = "install";
    }
    // Actually update or install the part if needed and confirmed by user
    if (action) {
      summary += `${action} `;
      if (await confirmPartItem(action, remoteItemName, postMsg)) {
        lively.PartsBin.copyRemotePart(remoteItemName, partSpace, livelyURL);
        summary += "completed\n";
      } else {
        summary += "SKIPPED\n";
      }
    } else {
       summary += "up-to-date\n";
    }
  }
  // Show summary message
  if (summary !== "") {
    $world.alertOK(summary);
  } else {
    $world.alertOK(`No parts found in ${partSpace} (?!)`);
  }
}

// Locates branchpoint and returns whether we have local and/or remote changes
function getBranchInfo(localChanges, remoteChanges) {
  let branchPoint;
  let localModified = false, remoteModified = false;
  while (!branchPoint) {
    let localHead = localChanges[localChanges.length-1];
    let remoteHead = remoteChanges[remoteChanges.length-1];
    let localHeadID = localHead.id;
    let remoteHeadID = remoteHead.id;
    let localHeadTime = localHead.date.valueOf();
    let remoteHeadTime = remoteHead.date.valueOf();
    if (localHeadTime > remoteHeadTime) {
      localModified = true;
      localChanges.pop();
    } else if (localHeadTime < remoteHeadTime) {
      remoteModified = true;
      remoteChanges.pop();
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

