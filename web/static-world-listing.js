// import { resource } from "lively.resources";
const { resource } = lively.resources;
const { ObjectDBHTTPInterface } = lively.storage;
const { promise } = lively.lang;

let $ = sel => document.querySelector(sel);

export async function run(user) {
  let i = $("#dom-loading-indicator");
  if (i) i.style.display = "none";

  $(`.public-worlds .list`).innerHTML = "";
  $(`.user-worlds .list`).innerHTML = "";

  let userName = (user && user.name) || "",
      userWorldFound = false,
      db = new ObjectDBHTTPInterface(),
      commits = await db.fetchCommits({
        db: "lively.morphic/objectdb/morphicdb",
        type: "world",
        filterFn: `(ea, i) => ea.tags.includes("front-page") || ea.author.name === "${userName}"`
      });

  for (let commit of commits) {
    let {tags, author} = commit;
    if (tags.includes("front-page")) addPreview(commit, "public");
    if (author.name === userName) {
      userWorldFound = true;
      addPreview(commit, "user");
      $(`.user-worlds`).style.display = "";
    }
  }
  
  if (!userWorldFound) $(`.user-worlds`).style.display = "none";
}


async function addPreview(commit, type, dbName) {
  let dbQuery = dbName ? `?db=${dbName}` : "",
      {
        name, author: {name: authorName},
        preview, timestamp, description
      } = commit,
      date = lively.lang.date.format(new Date(timestamp), "yyyy-mm-dd HH:MM");
  $(`.${type}-worlds .list`).insertAdjacentHTML(
    "beforeEnd",
    `<a class="world-link" href="/worlds/${name}${dbQuery}">
      <div class="world-preview">
          <div class="image">
            <img src="${preview}"></img>
            <div class="world-name"><center>${name}</center></div>
          </div>
          <div class="description">
            <div class="author">${authorName} ${date}</div>
            <div class="description-text"><p>${description}</p></div>
          </div>
      </div>
    </a>`)
}