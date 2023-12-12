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

### Installation Requirements

Currently, MacOS, Linux, and the Linux Subsystem for Windows are supported.
Make sure you have the following software installed:

1. `node.js v20.10`
2. `git`.

We try to require/support the current LTS version of `node`.

For some more advanced development operations (bulk testing from the command line), you will also need 

- `sed` or `gsed` on MacOs
- `ss` or `netstat` on MacOs
- `perl`
- `python3` with `sultan` installed
- `brotli`
- `aspell`.

### Installation Instructions

1. Clone this repository and run the `install.sh` script. This will install the necessary dependencies. Please note, that this process will take a few minutes.
2. Run the `start.sh` script.
3. Lively will now be running on your local computer at [http://localhost:9011](http://localhost:9011).

Usually, running `start.sh` will now be enough to get you going again.

### Updating `lively.next`

When a new version of `lively.next` is available, the Version Indicator in the lower-left corner will look like this:

![A GIF showing an orange arrow. The arrow is bouncing and points to the text "Press here to update".](./assets/update.gif)

Pressing will start the update process, automatically restart the server and prompt you to reload your lively session. Please make sure to save all your progress before updating.

Manually updating can be done by pulling the latest version and just executing `install.sh` again. The server needs to be restarted afterwards and you need to reload your lively session.

---

Please note, that these instructions currently are not recommended for openly deploying `lively.next` in the web!

> **Note**
>
> This does not mean that you cannot deploy applications built with `lively.next`. Of course, frozen applications can be served via any hoster!
> 
> However, making a development server publicly available is highly discouraged, as it comes with unfiltered access to the local file system and shell, among other things.

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
