# lively.next
[![Join our Chat room on Matrix](https://img.shields.io/badge/matrix%20chat-JOIN-success)](https://matrix.to/#/#lively.next:matrix.org)
[![Run Tests](https://github.com/LivelyKernel/lively.next/actions/workflows/ci-tests.yml/badge.svg?branch=master)](https://github.com/LivelyKernel/lively.next/actions/workflows/ci-tests.yml)
    
This is the repository of the [lively.next project](https://lively-next.org).

> **Warning**
>
> `lively.next` is alpha software and under heavy development.
>
> **You are very welcome to play with it!** But please be aware, that there are no guarantees regarding the stability of APIs etc.
>
> In case you want to experiment with `lively.next`, please **feel free to join our [Matrix Chatroom (#lively.next:matrix.org)](https://matrix.to/#/#lively.next:matrix.org) and ask all the questions you want!**

## Setup

You need to install `lively.next` on your system.
Please note, that these instructions currently are are not recommended for openly deploying `lively.next` in the web!

### Native Installation

Currently, the MacOS, Linux, and the Linux Subsystem for Windows are supported.
Make sure you have the following software installed.

1. `node.js v18.12.1`
2. `git`

> **Warning**
> To use all features of `lively.next`, please note the following:
> - `git` needs to be at least version `2.28`
> - make sure that you have configured git with a committer name and e-mail address
> - you need SSH keys (usually in `~/.ssh`) that are set up with your GitHub account.

For some more advanced development operations (bulk testing from the command line), you will also need 

- `sed` or `gsed` on MacOs
- `ss` or `netstat` on MacOs
- `perl`
- `python3` with `sultan` installed
- `brotli`
- `aspell`.

#### Installation Instructions

1. Clone this repository and run the `install.sh` script. This will install the necessary dependencies. Please note, that this process will take a few minutes.
2. Run the `start.sh` script.
3. Lively will now be running on your local computer at [http://localhost:9011](http://localhost:9011).

Usually, running `start.sh` will now be enough to get you going again. When changes resulted in changed dependencies, you will need to run `install.sh` again, making it a good first step when troubleshooting.

## Documentation

Some hints and documentation can be found in the [project wiki](https://github.com/LivelyKernel/lively.next/wiki).

The actual documentation can be found [here](https://livelykernel.github.io/lively.next/).

## Contributing

Please make sure to run `make hooks` from the root of the repository before starting to develop.

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

## License

This project is [MIT licensed](LICENSE).
