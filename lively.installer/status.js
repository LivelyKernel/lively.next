import { summaryForPackages } from "./package-status.js"

export async function openPackageSummary(baseDir) {
  // openPackageSummary("/Users/robert/Lively/lively-dev-2")
  return await openSummary("package status summary", () => summaryForPackages(baseDir));
}

async function openSummary(title, contentFn) {
  try {
    var i = await lively.ide.withLoadingIndicatorDo("computing summary...");
    var content = await contentFn();
    return $world.addCodeEditor({
      title: title,
      textMode: "text",
      content: content,
      extent: pt(600, 800)
    }).getWindow().comeForward();

  } finally { i.remove(); }
}