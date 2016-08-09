
export function packageGitHead(pkg) { // PackageAddress -> Hash?
  return System.import(`${pkg}/package.json`)
    .then(conf => conf && conf.gitHead || null)
    .catch(e => null);
}

export async function localGitHead(pkg) { // PackageAddress -> Hash?
  return System.resource(`${pkg}/.git/HEAD`).read()
  .then(head => {
    if (typeof head !== "string") return null;
    const match = head.match(/^ref: ([^\n]+)\n/);
    if (!match) return null;
    return System.resource(`${pkg}/.git/${match[1]}`).read();
  })
  .then(hash => {
    if (typeof hash !== "string") return null;
    const match = hash.match(/^([0-9a-f]+)/);
    return match ? match[1] : null;
  }).catch(e => null);
}