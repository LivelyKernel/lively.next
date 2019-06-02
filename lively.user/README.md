# Usage

## Installation

```sh
npm install -g flatn
cd lively.user
flatn -C flatn_deps install
```

## Server start

```sh
eval $( flatn -C flatn_deps env) ./bin/start-server.js --port 9200 --hostname "0.0.0.0" --userdb path/to/userdb.idb
```

<!--

eval $( flatn -C ../lively.next-node_modules -D ../lively.modules -D ../lively.lang -D ../lively.storage env ) && ./bin/start-server.js --port 9200 --hostname "0.0.0.0" --userdb pre-user-db.idb

-->


# License

MIT
