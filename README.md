# lively.installer

The lively.installer package can install and update the LivelyKernel system
together with dependencies for lively.next on your local computer.

Right now it is tested with Mac OS and Linux, there are no conceptual issues
for why it wouldn't work on Windows but we might have left a few of the wrong
slashes around. If you want to make the installer working for Windows you get a
cookie!!


## Usage

### Initial install from command line

1. Create an empty directory: `$ mkdir lively-dev; cd lively-dev`
2. Now run `$ curl -o- https://raw.githubusercontent.com/LivelyKernel/lively.installer/master/web-install.sh | bash`

### Update from command line

Similar to the above, 
1. Change into your live dev directory: `$ cd lively-dev`
2. Once again run `$ curl -o- https://raw.githubusercontent.com/LivelyKernel/lively.installer/master/web-install.sh | bash`
