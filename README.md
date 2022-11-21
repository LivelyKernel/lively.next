# lively.next

[![Run Tests](https://github.com/LivelyKernel/lively.next/actions/workflows/ci-tests.yml/badge.svg?branch=master)](https://github.com/LivelyKernel/lively.next/actions/workflows/ci-tests.yml)
    
This is the repository of the [lively.next project](https://lively-next.org).

## Setup

You can install lively.next "natively" on your system or use Docker for your development environment.
Please note, that these instructions currently are are not recommended for openly deploying lively.next in the web!

### Native Installation

Currently, the MacOS, Linux, and the Linux Subsystem for Windows are supported.
Make sure you have the following software installed.

1. `node.js v18.12.1`
2. `git`

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

### Docker Development Environment

For a more platform agnostic variant and less need for local dependencies, you can also use a setup based on docker.
Having `docker`, `git` (,and `make`) installed are the only prerequisites.

#### Installation Instructions

1. Clone this repository
2. Run `make docker-build` from the root of this repository. 

This process takes a while, ending with a running lively server at [http://localhost:9011](http://localhost:9011).
When opting for the docker based approach, you can still use `git` as usual from your file system.

Afterwards, you can stop the lively server with `make docker-stop`.

`docker-build` has the same role as `install.sh` above. To just start your server in the future, you can execute `make docker-start`.

Since this will lead to a running server without logging in your shell by default, you can use `make docker-watch` to see the current output of your lively server.

`make docker-bash` will open a shell inside of the container running your server.

### Compatability

On Linux and Windows machines, both of the aforementioned options should usually coexist happily.
This means, that you can use `start.sh` and `make docker-start` both, independent of the initial means of installation.

**On macs with Apple Silicon, this does not hold.** When switching on such a machine, you will need to remove the `next-node_modules/leveldown` directory and run `install.sh`/`make docker-build` again.
    
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
- docker: 🐳
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
- resources: 🪨
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
