# lively.next

[![Run Tests](https://github.com/LivelyKernel/lively.next/actions/workflows/ci-tests.yml/badge.svg?branch=master)](https://github.com/LivelyKernel/lively.next/actions/workflows/ci-tests.yml)
    
This is the repository of the [lively.next project](https://lively-next.org).

## Requirements

*Please note* Currently the Lively server runs best on MacOS, Linux or the Windows Linux subsystem. Getting it going on pure Windows is possible but will require additional tweaks.

Make sure you have the following software installed.

1. node.js version 17 or later.
2. git

## Installation and Setup

1. Clone this repository and run the `install.sh` script. This will install the necessary dependencies and sync the Lively Partsbin with lively-next.org. Please note that this process will take a few minutes.
2. Run the `start.sh` script.
3. Lively will now be running on your local computer at [http://localhost:9011](http://localhost:9011).

## Docker Image
A docker image exists for this to try it out in the environment of your choice.
1. Download [chrome.json](https://raw.githubusercontent.com/LivelyKernel/lively.next/main/chrome.json) and take note of where it is saved
2. Run the docker command as follows (replacing the seccomp section with the location above where the file was saved): `docker run -d --restart=unless-stopped --init --security-opt seccomp=/path/to/chrome.json --name lively-next -p 127.0.0.1:9011:9011 engagelively/lively-next:alpha4.5.0`
3. Once completely started, navigate to [http://localhost:9011 ](http://localhost:9011)

## Documentation

Some hints and documentation can be found in the [project wiki](https://github.com/LivelyKernel/lively.next/wiki).

The actual documentation can be found [here](https://livelykernel.github.io/lively.next/).

## Contributing

Please make sure to run `make hooks` from the root of the repository before starting to develop.

## License

This project is [MIT licensed](LICENSE).
