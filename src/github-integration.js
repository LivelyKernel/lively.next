const CONF_NAME = 'GitHub Personal Access Token';
const CONF_KEY = 'lively.changesets/github-access-token';

function setUpConf() {
  window.lively.Config.addOption({
    name: CONF_NAME,
    value: window.localStorage.getItem(CONF_KEY) || '<secret>',
    docString: 'Personal Access Token for interacting with GitHub, such as pushing or pulling changes. Create a dedicated access token by going to https://github.com/settings/tokens',
    group: 'lively.changesets'
  });
}

export async function gitHubToken() {
  if (window && window.lively && window.lively.Config) {
    let token = window.lively.Config.get(CONF_NAME, true);
    if (token !== undefined) return token;
    setUpConf();
    token = window.lively.Config.get(CONF_NAME, true);
    if (token !== '<secret>') return token;
    token = await $world.prompt("Please enter your Personal Access Token for interacting with GitHub", {
      historyId: CONF_KEY,
      useLastInput: true
    });
    window.lively.Config.set(CONF_NAME, token);
    window.localStorage.setItem(CONF_KEY, token);
    return token;
  } else {
    // no support for NodeJS at the moment
    return "0000000000000000000000000000000000000000";
  }
}

export async function gitHubURL(pkg) { // PackageAddress -> string?
  const packageConfig = `${pkg}/package.json`;
  try {
    const res = await fetch(packageConfig),
          conf = await res.json();
    if (!conf || !conf.repository) return null;
    const url = conf.repository.url || conf.repository,
          match = url.match(/github.com[:\/](.*?)(?:\.git)?$/);
    if (!match) return null;
    return match[1];
  } catch (e) {
    return null;
  }
}
