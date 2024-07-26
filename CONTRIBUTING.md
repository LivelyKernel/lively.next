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
- flatn: 🫓
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