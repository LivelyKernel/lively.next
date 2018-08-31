import { generateHTML } from 'lively.morphic/rendering/html-generator.js';
import { MorphicDB, loadMorphFromSnapshot } from "lively.morphic";
import { freezeSnapshot } from "./part.js";

let prerenderedParts;

export function dispose(commit) {
  prerenderedParts[commit.name].remove();
  delete prerenderedParts[commit.name];
}

export function show(commit) {
  // remove other parts from the world, show and resize the selected commit
  const part = prerenderedParts[commit.name];
  $world.submorphs = [];
  part.openInWorld();
  part.left = part.top = 0;
  part.extent = $world.extent;
  return part;
}

export async function refresh(commit, freeze=true) {
  const snapshot = await MorphicDB.default.fetchSnapshot(commit),
        part = await loadMorphFromSnapshot(snapshot),
        {file: body} = freeze ? await freezeSnapshot({
          snapshot: JSON.stringify(snapshot)
        }, {
          notifications: false,
          loadingIndicator: false,
          includeRuntime: false,
          addRuntime: false,
          includeDynamicParts: true
        }) : { file: false };
  // add this to the dictionary of managed commit
  if (!prerenderedParts) prerenderedParts = {};
  prerenderedParts[commit.name] = part;
  await show(commit);
  return body;
}

export async function prerender(commit, width, height, pathname, userAgent) {
  const addScripts = `
      <style>
        #prerender {
           position: absolute
        }
      </style> 
      <script>
        lively = {};
        System = {};
      </script>
      <script id="system" src="/lively.freezer/runtime-deps.js" defer></script>
      <script id="loader" src="${pathname}/${userAgent}/load.js" defer></script>
      <script>
        history.replaceState(null, '', (new URL(location.href)).searchParams.get('pathname') || origin);
        document.querySelector('#system').addEventListener('load', function() {
            window.prerenderNode = document.getElementById("${$world.id}");
        });
        document.querySelector('#loader').addEventListener('load', function() {
            System.baseURL = origin;
            if (!("PointerEvent" in window))
              lively.resources.loadViaScript(\`\${origin}/lively.next-node_modules/pepjs/dist/pep.js\`);
            if (!("fetch" in window))
              lively.resources.loadViaScript(\`//cdnjs.cloudflare.com/ajax/libs/fetch/1.0.0/fetch.js\`);
        });
       </script>`;
   const part = show(commit);

   $world.dontRecordChangesWhile(() => {
     part.width = width;
     part.height = height;
     $world.width = width;
     $world.height = height;
   });
   await $world.whenRendered();
   $world.dontRecordChangesWhile(() => {
     if (part.onWorldResize) part.onWorldResize();
   });
   await $world.whenRendered();
   return await generateHTML($world, {
      container: false,
      addMetaTags: [{
        name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1"
      }],
      addScripts});
}