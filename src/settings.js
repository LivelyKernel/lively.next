const NAME_KEY = 'lively.changesets/committer-name';
const EMAIL_KEY = 'lively.changesets/committer-email';
const TOKEN_KEY = 'lively.changesets/github-access-token';

export function getAuthor() { // -> {name: string, email: string}
  return {
    name: window.localStorage.getItem(NAME_KEY) || "LivelyKernel Contributor",
    email: window.localStorage.getItem(EMAIL_KEY) || "lively@example.org"
  };
}

export function setAuthor(auth) { // {name: string, email: string} -> ()
  window.localStorage.setItem(NAME_KEY, auth.name);
  window.localStorage.setItem(EMAIL_KEY, auth.email);
}

export function getGitHubToken() { // -> string
  return window.localStorage.getItem(TOKEN_KEY) || "<secret>";
}

export async function getOrAskGitHubToken() {
  let token = getGitHubToken();
  if (token !== '<secret>') return token;
  token = await $world.prompt("Please enter your Personal Access Token for interacting with GitHub", {
    historyId: TOKEN_KEY,
    useLastInput: true
  });
  setGitHubToken(token);
  return token;
}

export function setGitHubToken(token) { // string -> ()
  window.localStorage.getItem(TOKEN_KEY, token);
}
