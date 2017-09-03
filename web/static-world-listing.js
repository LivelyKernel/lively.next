// import { resource } from "lively.resources";
const { resource } = lively.resources;
const { arr } = lively.lang;
const { ObjectDBHTTPInterface } = lively.storage;
const { promise } = lively.lang;

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const addClass = (el, className) => el.className = arr.uniq(
                                      el.className.split(" ")
                                        .concat(className)
                                        .filter(ea => !!ea.trim()))
                                          .join(" ");
const removeClass = (el, className) => el.className = arr.uniq(
                                        el.className.split(" ")
                                          .filter(ea => !!ea.trim() && ea !== className))
                                            .join(" ");

export function showWorldsLastChoice(user) {
  let loc = "public";
  try {
    let choice = JSON.parse(localStorage.getItem("lively.next-worlds-last-filter-choice"));
    if (choice) loc = choice.location;

  if (loc === "search")
    $('.filter-worlds input').value = choice.query || "";

  } catch (err) {}
  return showWorlds(loc, user);
}

// public, mine, latest, search
export async function showWorlds(loc, user) {

  let choice = {location: loc};

  {
    let f = !user || user.isGuestUser ? addClass : removeClass
    f($(".world-tabs button.mine"), "hidden");
  }

  {
    Array.from($$(".world-tabs button")).forEach(ea => removeClass(ea, "selected"));
    addClass($(`.world-tabs button.${loc}`), "selected");
  }

  let filterFn = `(ea, i) => ea.tags.includes("front-page")`;

  if (loc === "mine") {
    if (!user) loc = "public"
    else {
      let userName = user.name;
      filterFn = `(ea, i) => ea.author.name === "${userName}"`;
    }
  }

  if (loc === "latest") {
    if (!user) loc = "public"
    else {
      let userName = user.name;
      filterFn = `(ea, i) => true`;
    }
  }

  if (loc === "search") {
    removeClass($(".filter-worlds"), "hidden");
    let input = $('.filter-worlds input'),
        q = input.value.toLowerCase();
    choice.query = q;
    input.focus();
    filterFn = `(ea, i) => {
      let q = ${JSON.stringify(q)};
      if (ea.name.toLowerCase().includes(q)) return true;
      if (ea.author.name.toLowerCase().includes(q)) return true;
      if (ea.description.toLowerCase().includes(q)) return true;
      if ((ea.tags || []).some(t => t.toLowerCase().includes(q))) return true;
      return false;
    }`;
  } else {
    addClass($(".filter-worlds"), "hidden");
  }

  saveChoice(choice);

  let db = new ObjectDBHTTPInterface(),
      // filterFn = `(ea, i) => ea.tags.includes("front-page") || ea.author.name === "${userName}"`,
      commits = await db.fetchCommits({
        db: "lively.morphic/objectdb/morphicdb",
        type: "world", filterFn
      });

  if (loc === "latest") {
    commits = arr.sortBy(commits, ea => -ea.timestamp);
  }

  return listWorlds(commits);
}

async function listWorlds(worldCommits) {
  let i = $("#dom-loading-indicator");
  if (i) i.style.display = "none";

  $(`.worlds .list`).innerHTML = "";

  for (let commit of worldCommits) {
    let {tags, author} = commit;
    // if (tags.includes("front-page")) addPreview(commit);
    addPreview(commit);
  }
}

function saveChoice(choice) {
  try {
    localStorage.setItem(
      "lively.next-worlds-last-filter-choice",
      JSON.stringify(choice));
  } catch (err) {}
}

async function addPreview(commit, dbName) {
  let dbQuery = dbName ? `?db=${dbName}` : "",
      {
        name, author: {name: authorName},
        preview, timestamp, description
      } = commit,
      date = lively.lang.date.format(new Date(timestamp), "yyyy-mm-dd HH:MM");
  $(`.worlds .list`).insertAdjacentHTML(
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
