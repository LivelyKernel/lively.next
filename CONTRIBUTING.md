# Contributing Guidelines

We have some asks of people that are providing code contributions to `lively.next` in order to keep the repository tidy and make all developers lives easier.

However, all kind of contributions are welcome and we encourage you to open a ticket or get in touch via our [matrix channel](https://matrix.to/#/#lively.next:matrix.org) or via e-mail to `hi@lively-next.org`!

## Developers

### Setup

Please make sure to run `make hooks` from the root of the repository before starting to develop.

### Commit Messages

Please adhere to the following convention for commit messages:

`affected package(s): what was changed (first letter lower case)`. The first line should not be longer than 72 characters.

The packages are coded with emojis as follows:

- 2lively: 🗨️
- ast: 🌳
- bindings: 🎀
- changesets: 🔣
- CI/scripts/docs: 🛠️
- classes: 🧑‍🏫
- collab: 💭
- components: 🎛️
- context: 🗺️
- freezer: ❄️
- git: 🛤️
- graphics: 🖌️
- halos: 👼
- headless: 🤕
- ide: 🧰
- installer: 📦
- keyboard: ⌨️
- lang: 📙
- modules: 🧩
- morphic: 🎨
- notifications: 🔔
- project: 📂
- resources: 🪨
- README: 🗒️
- serializer2: 📇
- server: 👔
- shell: 🐚
- source-transform: 🔁
- storage: 💾
- system-interface: 📠
- traits: ⚙️
- user: 👤
- vm: 🖥️

### Commit History

As we merge PRs via rebase, please take the time to ensure that there is the necessary number of commits in your PR (and not more) and the history helps to understand what you did and why you did it.

Dependency changes use Bun 1.4.2 with the committed workspace lock. Add dependencies to the package that imports them. Browser import maps are generated as hidden `.cachedImportMap.json` caches and must not be committed. Installation refreshes missing or stale maps; `bun run update:browser-import-maps <workspace>` forces regeneration. Ordinary installs must leave `bun.lock` unchanged.

Launch and build commands work directly, without sourcing an environment script. Bun provides local script binaries; the installer and test runner discover packages from the workspace manifest and `local_projects`. Puppeteer uses `.puppeteerrc.cjs`; packaged desktop launchers supply their own runtime paths.

Run package tests with, for example, `bun run --cwd lively.lang test`. Resolution regression checks:

```sh
node --experimental-import-meta-resolve lively.modules/tests/native-resolver-test.mjs
node --experimental-import-meta-resolve lively.modules/tests/native-system-live-test.mjs
node --experimental-import-meta-resolve lively.freezer/tests/package-resolution-test.cjs
node --experimental-import-meta-resolve lively.freezer/tests/dynamic-system-import-test.mjs
node --experimental-import-meta-resolve lively.freezer/tests/minify-test.cjs
node --experimental-import-meta-resolve lively.freezer/tests/project-bundle-test.mjs
node --experimental-import-meta-resolve lively.server/tests/browser-import-map-cache-test.mjs
node --experimental-import-meta-resolve lively.project/tests/package-install-test.mjs
node --experimental-import-meta-resolve lively.installer/tests/runtime-roots-test.mjs
```
