# lively.installer

lively.installer can install and update all packages of lively.next on your local computer.

Right now it is tested with Mac OS and Linux, there are no conceptual issues
for why it wouldn't work on Windows but we might have left a few of the wrong
slashes around. If you want to make the installer working for Windows you get a
cookie!!


## Usage

### Initial install from command line

1. In a terminal create an empty directory: `mkdir lively.next; cd lively.next`
2. Now run `curl -o- https://raw.githubusercontent.com/LivelyKernel/lively.installer/master/web-install.sh | bash`
3. After the installation is done (can take a few minutes) enter `./start.sh` and press enter, a Lively server will start.
4. Visit [http://localhost:9011/index.html]() to open a Lively world. Initial load might take a while.

### Update from command line

Similar to the above, 
1. Change into your live dev directory: `$ cd lively.next`
2. Run `$ ./update.sh`
