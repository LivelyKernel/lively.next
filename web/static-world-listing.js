// import { resource } from "lively.resources";
const { resource } = lively.resources;
import { promise } from "lively.lang";

let $ = sel => document.querySelector(sel);

export async function run() {
  let i = $("#dom-loading-indicator");
  if (i) i.style.display = "none";

  let publicResources = await worldResources("public");
  if (publicResources.length) {
    $(`.public-worlds .list`).innerHTML = "";
    publicResources.forEach(ea => addPreview(ea, "public"));
  }
  
  let localResources = await worldResources("local");
  if (localResources.length) {
    $(`.local-worlds .list`).innerHTML = "";
    localResources.forEach(ea => addPreview(ea, "local"));
  }
}


function worldResources(location) {
  let urls = location === "public" ?
    [System.decanonicalize("lively.morphic/worlds/")] :
    location === "local" ? ["lively.storage://worlds/"] : []
  return Promise.all(urls.map(ea => resource(ea)
      .dirList(1,{exclude: ea => !ea.name().endsWith(".json")})))
    .then(results => [].concat.apply([], results));
}

async function resourceFor(location, name) {
  let url = location === "public" ?
    System.decanonicalize("lively.morphic/worlds/") :
    location === "local" ? "lively.storage://worlds/" : "UNNNNKNOWNNNN"
  return resource(url).join(`${name}.json`)
}

async function addPreview(resource, location/*public,local*/) {
  // let resource = (await this.worldResources())[0]

  let snapshot = await resource.readJson(),
      n = resource.name().replace(/\.json$/, "").replace(/%20/g, " ");

  $(`.${location}-worlds .list`).insertAdjacentHTML(
    "beforeEnd",
    `<a class="world-preview" href="/worlds/${n}?location=${location}">
      <img src="${snapshot.preview}"></img>
      <div class="image-title">
        <center>${n}</center>
      </div>
    </a>`,
  )
}
