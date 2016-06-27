import { summaryForPartsBin } from "./partsbin-status.js";
import { summaryForPackages } from "./package-status.js"

export async function openPackageSummary(baseDir) {
  // openPackageSummary("/Users/robert/Lively/lively-dev-2")
  try {
    var i = await lively.ide.withLoadingIndicatorDo("computing summary...");
    var packages = await Promise.all((await readPackageSpec()).map(spec =>
      new Package(join(baseDir, spec.name), spec).readConfig()))
    var summary = await summaryForPackages(packages);
    
    return $world.addCodeEditor({
      title: "package status summary",
      textMode: "text",
      content: summary,
      extent: pt(600, 800)
    }).getWindow().comeForward();

  } finally { i.remove(); }
}

export async function openPartsBinSummary(partSpaceName, fromURL, toURL) {
  // openPartsBinSummary("PartsBin/lively.modules", "https://dev.lively-web.org/", URL.root)
  try {
    var i = await lively.ide.withLoadingIndicatorDo("computing summary...");
    var summary = await summaryForPartsBin(partSpaceName, fromURL, toURL);
    
    return $world.addCodeEditor({
      title: "part status summary",
      textMode: "text",
      content: summary,
      extent: pt(600, 400)
    }).getWindow().comeForward();

  } finally { i.remove(); }
}