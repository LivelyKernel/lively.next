import { copyPartsBinItem } from './partsbin-helper.js';

export function createPartSpaceUpdate(partSpaceName, fromURL, toURL) {
  // var updates = createPartSpaceUpdate("PartsBin/lively.modules", "https://dev.lively-web.org/", URL.root)
  fromURL = new URL(fromURL);
  toURL = new URL(toURL);
  var fromPartSpace = lively.PartsBin.partsSpaceWithURL(fromURL.join(partSpaceName)),
      toPartSpace = lively.PartsBin.partsSpaceWithURL(toURL.join(partSpaceName)),
      update = new PartSpaceUpdate(fromPartSpace, toPartSpace),
      updates = update.computeUpdates()
  
  return update;
}

class PartSpaceUpdate {

  constructor(fromSpace, toSpace) {
    this.fromSpace = fromSpace;
    this.toSpace = toSpace;
  }

  computeUpdates() {
    if (this.updates) return this.updates;

    var f = this.fromSpace, t = this.toSpace;
    f.load();
    t.load();

    var fromItems = lively.lang.obj.values(f.partItems),
        toItems = lively.lang.obj.values(t.partItems),
        missingInTo = fromItems.pluck("name").withoutAll(toItems.pluck("name")).map(ea => f.partItems[ea]),
        missingInFrom = toItems.pluck("name").withoutAll(fromItems.pluck("name")).map(ea => t.partItems[ea]),
        updates = []
          .concat(missingInTo.map(item => new PartItemUpdate(f, t, item, null, "to-missing")))
          .concat(missingInFrom.map(item => new PartItemUpdate(f, t, null, item, "from-missing")))
          .concat(fromItems.withoutAll(missingInTo)
            .map(ea => {
              var upd = new PartItemUpdate(f, t, ea, t.partItems[ea.name], "unknown")
              upd.determineStatus();
              return upd;
            }));

    this.updates = updates;
    return updates;
  }

  async runUpdates(livelyDir, log) {
    var partUpdates = this.computeUpdates();
    for (let partUpdate of partUpdates) {
      await partUpdate.runUpdate(livelyDir, log, true);
    }
  }

}

class PartItemUpdate {
  // status one of
  // unknown
  // to-missing
  // from-missing
  // up-to-date
  // from-changed
  // to-changed
  // both-changed

  constructor(fromSpace, toSpace, fromItem, toItem, status = "unknown") {
    this.fromSpace = fromSpace;
    this.toSpace = toSpace;
    this.fromItem = fromItem;
    this.toItem = toItem;
    this.status = status;
  }

  determineStatus() {
    if (this.status !== "unknown") return this.status;

    let toMeta = this.toItem.getMetaInfo(), fromMeta = this.fromItem.getMetaInfo(),
        toSorted = toMeta.changes.sortByKey("date"),
        fromSorted = fromMeta.changes.sortByKey("date"),
        {localModified: toModified, remoteModified: fromModified} = getBranchInfo(toSorted, fromSorted);
        
    if (!toModified && !fromModified) this.status = "up-to-date"
    else if (toModified && !fromModified) this.status = "to-changed"
    else if (!toModified && fromModified) this.status = "from-changed"
    else this.status = "both-changed"
    return this.status;
  }
  
  async runUpdate(livelyDir, log, prompt = false) {
    var category = this.fromSpace.getName(),
        fromURL = this.fromSpace.getURL().toString().replace(/\/$/, "").slice(0, -category.length),
        status = this.determineStatus();
    switch (status) {
        case "from-missing":
            console.log(`Part '${this.fromItem.name}' doesn't exist on the remote server; skipped.`);
            break;
        case "to-changed":
        case "up-to-date":
            console.log(`Part '${this.fromItem.name}' is up-to-date.`);
            break;
        case "both-changed":
            if (prompt && !(await $world.confirm(`Do you want to update part '${this.fromItem.name}'?`))) {
                break;
            } // else fall through
        case "to-missing":
        case "from-changed":
            let { output } = await copyPartsBinItem(fromURL, category, this.fromItem.name, livelyDir, {log: log});
            console.log(output);
            console.log(`${this.fromItem.name} installed/updated!`);
            break;
        default: throw new Error(`unhandled part update status: ${status}`);
    }
  }
}



// Locates branchpoint and returns whether we have local and/or remote changes
function getBranchInfo(localChanges, remoteChanges) {
  let branchPoint,
      localModified = false,
      remoteModified = false;
  while (!branchPoint) {
    let localHead = localChanges[localChanges.length-1],
        remoteHead = remoteChanges[remoteChanges.length-1],
        localHeadID = localHead.id,
        remoteHeadID = remoteHead.id,
        localHeadTime = localHead.date.valueOf(),
        remoteHeadTime = remoteHead.date.valueOf();
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
