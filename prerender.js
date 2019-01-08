import { generateHTML } from 'lively.morphic/rendering/html-generator.js';
import { MorphicDB, loadMorphFromSnapshot } from "lively.morphic";
import { freezeSnapshot } from "./part.js";
import { newMorphId } from "lively.morphic";

let prerenderedParts;

// refresh(commit)

export function dispose(commit) {
  prerenderedParts[commit.name].remove();
  delete prerenderedParts[commit.name];
}

export function show(commit) {
  // remove other parts from the world, show and resize the selected commit
  const part = prerenderedParts[commit.name];
  part.dontRecordChangesWhile(() => {
    $world.submorphs = [];
    if (part.isWorld) return;
    part.openInWorld();
    part.left = part.top = 0;
  });
  return part;
}

export async function refresh(commit, freeze=true) {
  [...document.head.children].filter(m => 
    m.href && (m.href.includes('loading-indicator.css') || 
               m.href.includes('font-awesome.css') ||
               m.href.includes('inconsolata.css'))).forEach(m => m.remove());
  if (prerenderedParts && prerenderedParts[commit.name]) prerenderedParts[commit.name].remove();
  const basicHead = [...document.head.children],
        snapshot = await MorphicDB.default.fetchSnapshot(commit),
        part = await loadMorphFromSnapshot(snapshot, {
          reinitializeIds: (id, ref) => {
            if (!ref.realObj.isMorph) return null
            if (!$world.getMorphWithId(id)) return id;
            return newMorphId(ref.realObj.constructor);
          }
        }),
        { file: body, dynamicParts } = freeze ? await freezeSnapshot({
      snapshot: JSON.stringify(snapshot)
    }, {
      notifications: false,
      loadingIndicator: false,
      includeRuntime: false,
      addRuntime: false,
      includeDynamicParts: true
    }) : { file: false };
  $world.env.changeManager.reset();
  let currentHead = [...document.head.children],
      titleTag = currentHead.find(m => m.tagName == 'TITLE');
  titleTag && titleTag.remove();
  part._customHeadTags = currentHead.filter(i => !basicHead.includes(i) && i.id !== 'new-text-css');
  part._customHeadTags.forEach(i => {
    if (i.href && i.href.startsWith('http:')) i.href = i.href.replace('http:', 'https:');
    i.remove()
  });
  // add this to the dictionary of managed commit
  if (!prerenderedParts) prerenderedParts = {};
  prerenderedParts[commit.name] = part;
  await show(commit);
  return { body, dynamicParts };
}

export async function prerender(commit, width, height, pathname, userAgent, timestamp, production) {
  if (pathname == '/') pathname = '';
  const part = show(commit);
  const addScripts = `
      ${part.__head_html__ || ''}
      ${part._customHeadTags.map(i => i.outerHTML).join('\n')}
      <style>
        #prerender {
           position: absolute
        }
      </style> 
      <script>
        if (!window.location.origin) {
          window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
        }
        dynamicPartsDir = "/lively.freezer/frozenParts/$id/dynamicParts/";
        lively = {};
        System = {baseUrl: window.location.origin};
      </script>
      ${
          production ? 
            `<script id="system" src="/lively.freezer/runtime-deps.js" defer></script>` :
            `<script src="/lively.freezer/semver.browser.js"></script>
             <script src="/lively.freezer/static-runtime.js"></script>
             <script src="/lively.next-node_modules/babel-regenerator-runtime/6.5.0/runtime.js"></script>
             <script>
                lively.ast = {query: {}, acorn: {}, nodes: {}, BaseVisitor: function() {}};
             </script>
             <script src="/lively.source-transform/dist/lively.source-transform.js"></script>
             <script src="/lively.lang/dist/lively.lang.js"></script>
             <script src="/lively.notifications/dist/lively.notifications.js"></script>
             <script src="/lively.classes/dist/lively.classes.js"></script>
             <script src="/lively.resources/dist/lively.resources.js"></script>
             <script src="/lively.storage/dist/lively.storage_with-pouch.js"></script>
             <script src="/lively.bindings/dist/lively.bindings.js"></script>
             <script src="/lively.serializer2/dist/lively.serializer2.js"></script>
             <script src="/lively.graphics/dist/lively.graphics.js"></script>
             <script id="system" src="/lively.morphic/dist/lively.morphic_no-deps.js"></script>`
      }
      <script id="loader" src="${pathname}/${userAgent}/${timestamp}-load.js" defer></script>
      <script>
        var url = new URL(location.href);
        console.log(url.searchParams ? url.searchParams.get('pathname') : url.pathname);
        history.replaceState(null, '', (url.searchParams ? url.searchParams.get('pathname') : url.pathname.split('/prerender')[0]) || window.location.origin);
        document.querySelector('#system').addEventListener('load', function() {
            window.prerenderNode = document.getElementById("${$world.id}");
        });
       </script>`;

   $world.dontRecordChangesWhile(() => {
     $world.width = width;
     $world.height = height;
     part.execCommand('resize on server');
   });
   await $world.whenRendered();
   return await generateHTML($world, {
      container: false,
      title: part.name,
      addMetaTags: [{
        name: "viewport", content: "minimum-scale=1.0, maximum-scale=1.0, initial-scale=1.0, user-scalable=no, viewport-fit=cover"
      }, {
        name: "apple-mobile-web-app-capable", content:"yes"
      }, {
        name: "apple-mobile-web-app-status-bar-style", content: 'black-translucent'
      }],
      addScripts});
}