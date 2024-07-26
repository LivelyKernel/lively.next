# lively.next

[![Daily `lively.next` Status Check](https://github.com/LivelyKernel/lively.next/actions/workflows/daily-ci-checks.yml/badge.svg?branch=main)](https://github.com/LivelyKernel/lively.next/actions/workflows/daily-ci-checks.yml)
[![Join our Chat room on Matrix](https://img.shields.io/badge/🗨️_on_matrix-JOIN-ff7700)](https://matrix.to/#/#lively.next:matrix.org)
[![Say Hi via E-Mail!](https://img.shields.io/badge/📧%20E--Mail-Say_Hi!-ff7700)](mailto:hi@lively-next.org)

`lively.next` is a personal programming kit. It emphasizes **liveness**, **directness**, and **interactivity**. 

It combines rich **live programming** capabilities, in the spirit of Smalltalk, with a graphical **direct manipulation workflow** from current design tools. It seamlessly bridges these two, allowing for rapid prototyping and efficient collaboration. 

We aim to bring you an innovative programming experience while building an integrated system that brings designer and programmers together.

<video src="https://github.com/user-attachments/assets/aa3f973a-ef91-404f-af29-80f301857378">
    <p>
        A screencast of how working inside of `lively.next` looks. A 'desktop' resembling a classic desktop OS can be seen, with a code editor and a web component being visible. The color of a part of the component is changed using a color picker tool. The resulting change is directly mirrored inside of the source code of the component.
    </p>
</video>

> [!WARNING]
>
> `lively.next` is beta software and under continuous development.
>
> **You are very welcome to play with it!** But please be aware, that there are no guarantees regarding the stability of APIs yet.

## Setup

You need to install `lively.next` on your system.

### Installation Requirements

> [!TIP]
>
> If you want to change files outside of `lively` (i.e., in a normal editor), while still having the changes be available in lively when opening the file, you'll need to install `entr` from its [repository](https://github.com/eradman/entr). Usually, when working inside of `lively.next`, this will not be an issue, but it can be handy when working heavily on the core of `lively`. *This feature works semi-reliable at the moment. If you are interested in this and would like to help debug this, please reach out!*

Currently, MacOS, Linux, and the Linux Subsystem for Windows are supported.
Make sure you have the following software installed:

1. `node.js v20.10`
2. `git`.

We try to require/support the current LTS version of `node`.

For some more advanced development operations (such as bulk testing from the command line and spell checking inside of `lively.next`), you will also need 

- `sed` or `gsed` on MacOs
- `ss` or `netstat` on MacOs
- `perl`
- `python3` with `sultan` installed
- `brotli`
- `aspell`.

> [!TIP]
>
> If you want to change files outside of `lively` (i.e., in a normal editor), while still having the changes be available in lively when opening the file, you'll need to install `entr` from its [repository](https://github.com/eradman/entr). Usually, when working inside of `lively.next`, this will not be an issue, but it can be handy when working heavily on the core of `lively`. *This feature works semi-reliable at the moment. If you are interested in this and would like to help debug this, please reach out!*

### Installation Instructions

1. Clone this repository and run the `install.sh` script. This will install the necessary dependencies and build some bundles that are necessary for the bootstrapping process of `lively.next`. Please note, that this process will take a few minutes.
2. Run the `start.sh` script.
3. Lively will now be running on computer and be accessible at [http://localhost:9011](http://localhost:9011).

> [!TIP]
>
> You can use `start.sh` with a `--debug` or `-d` flag to inspect the lively server with a `node` debugger. You can also use `--port=<PORT>` or `-p <PORT>` to specify on which port the lively server should run.

Usually, running `start.sh` will now be enough to get you going again.

### Updating `lively.next`

When a new version of `lively.next` is available, the Version Indicator in the lower-left corner will look like this:

<p align='center'>
    <img alt="A picture of `lively.next`'s version checker showing an orange arrow. The arrow points to the text 'Press here to update'" src="./assets/update.png" width="250" height="70">
</p>

Pressing will start the update process, automatically restart the server and prompt you to reload your lively session. Please make sure to save all your progress before updating.

Manually updating can be done by pulling the latest version and just executing `install.sh` again. The server needs to be restarted afterwards and you need to reload your lively session.

---

> [!CAUTION]
>
> Please note, that these instructions currently are not recommended for openly deploying `lively.next` in the web!

> [!IMPORTANT]
>
> This does not mean that you cannot deploy applications built with `lively.next`. Of course, frozen applications can be served via any hoster!
> 
> However, making a development server publicly available is highly discouraged, as it comes with unfiltered access to the local file system and shell, among other things.

## Documentation

### Interactive Explanations and Guide

We provide all information necessary to start developing in `lively.next` on our [website](https://lively-next.org/#explanations). We recommend this as an entry point for all users.

### Wiki
Some more hints and documentation can be found in the [project wiki](https://github.com/LivelyKernel/lively.next/wiki). Note, that these are much less polished than the contents provided on the website.


### Technical Documentation

Source-Code documentation (only relevant for developers and most useful for those who want to contribute to the `lively.next` core) can be found [here](https://livelykernel.github.io/lively.next/).

## License

This project is [MIT licensed](LICENSE).
