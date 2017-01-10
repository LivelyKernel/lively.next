# lively.sync

Synchronization mechanism based on operational transformations.

## modules

- changes.js
  change (de)serialization, application

- channel.js
  networking interface

- debugging.js
  some helpers

- transform.js
  transforming ops against each other. currently also holds some initial
  strategies to transform morphic specific ops

- client.js
  client logic (receive + send ops, transform them, etc)

- master.js
  similar to client but doesn't allow manual modifcation of its world state,
  connects clients and will broadcast ops + meta messages

# LICENSE

[MIT License](LICENSE)
