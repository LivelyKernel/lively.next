"format esm";

import { createPartSpaceUpdate } from "./partsbin-update.js";

export async function summaryForPartsBin(partSpaceName, fromURL, toURL) {
  // getPartsBinSummary("PartsBin/lively.modules", "https://dev.lively-web.org/", URL.root)
  var update = createPartSpaceUpdate(partSpaceName, fromURL, toURL)
  var summaries = await Promise.all(update.computeUpdates().map(ea => getSummaryFor(ea)));
  return summaries.join("\n")
}


function getSummaryFor(update) {
  var {fromItem, status} = update;
  var report = `Part '${fromItem.name}'\n  => `;
  if (status === 'to-missing') {
    report += "doesn't exist locally!";
  } else if (status === 'from-missing') {
    report += "doesn't exist remotely!";
  } else {
    let localChanges  = status === "to-changed" || status === "both-changed",
        remoteChanges =  status === "from-changed" || status === "both-changed";
    report += "change status:" +
              `\n    local changes: ${ localChanges ? 'yes' : 'no' }` +
              `\n    remote changes: ${ remoteChanges ? 'yes' : 'no' }`;
  }
  return report;
}

