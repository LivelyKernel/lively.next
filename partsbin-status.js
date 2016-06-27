"format esm";

import { createPartSpaceUpdate } from "./partsbin-update.js";

export async function openPartsBinSummary(partSpaceName, fromURL, toURL) {
  // openPartsBinSummary("PartsBin/lively.modules", "https://dev.lively-web.org/", URL.root)
  try {
    var i = await lively.ide.withLoadingIndicatorDo("computing summary...");
    var updates = createPartSpaceUpdate(partSpaceName, fromURL, toURL)
    var summary = await summaryForPartsBin(updates);
    
    return $world.addCodeEditor({
      title: "part status summary",
      textMode: "text",
      content: summary,
      extent: pt(600, 800)
    }).getWindow().comeForward();

  } finally { i.remove(); }
}


async function summaryForPartsBin(updates) {
  var summaries = await Promise.all(updates.map(ea => printSummaryFor(ea)));
  return summaries.join("\n")
}


function printSummaryFor(update) {
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

