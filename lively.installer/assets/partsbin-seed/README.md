# Pinned Partsbin seed

Fresh installs provision Partsbin from upstream revision
`5d6fa69cfea213456bfb92a7af0b3f4151e230c9`, then overlay this manifest
and Bun lock. The overlay records Partsbin's core source links
and its previously undeclared Babel build dependencies. Normal installation
consumes the Bun lock and dynamically generates the hidden
`.cachedImportMap.json` browser cache.

`install.sh` never fetches, checks out, stashes, or installs into an existing
`local_projects/LivelyKernel--partsbin` checkout. To update an existing checkout,
first save or commit your work, update it with Git, then explicitly run:

```sh
node lively.project/package-install.mjs local_projects/LivelyKernel--partsbin --update
node scripts/cache-browser-dependencies.mjs local_projects/LivelyKernel--partsbin
```

To refresh this seed, use a clean lively.next checkout without an existing
Partsbin project, provision the desired upstream revision under
`local_projects/LivelyKernel--partsbin`, add the two build dependencies recorded
in `package.json`, and run the same `--update` and cache commands. Copy the
resulting `package.json` and `bun.lock` here, update
`revision`, and verify a fresh `install.sh` run.
