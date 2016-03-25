# Examples

Here is how to run the example tests:

## browser

1. Start a http server

```
$ npm install -g http-server
$ cd mocha-es6/
$ http-server . -p 8080
```

2. Visit [http://localhost:8080/examples/run-tests.html](http://localhost:8080/examples/run-tests.html)

## command line

If installed globally and the mocha-es6 bin is in your PATH:

```
$ cd mocha-es6/examples
$ mocha-es6 ./tests.js
```

Otherwise run it directly via `./bin/mocha-es6.js`.
