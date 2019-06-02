Lively ChangeSets
=================

This modules implements [ChangeSets](http://wiki.squeak.org/squeak/674) for Lively.

The exported `gitInterface` can be used anywhere a `localInterface` is used but
in addition to reading and writing resources to the file system, it also supports
reading and writing to a current *ChangeSet*.


## Example use:

```js
import { gitInterface, createChangeSet } from "lively.changesets";

const origSrc = await gitInterface.moduleRead("lively.modules/index.js");

const cs = await createChangeSet("test");
cs.setCurrent();
await gitInterface.moduleWrite("lively.modules/index.js", "export const x=1");
const newSrc = await gitInterface.moduleRead("lively.modules/index.js");
// newSrc == "export const x=1";

cs.delete();
const restoredSrc = await gitInterface.moduleRead("lively.modules/index.js");
// restoredSrc == origSrc;
```

## Implementation

The ChangeSet implementation requires a Lively system with packages that are
managed by `lively.modules` and have a *package address* (typically a URL
as string).

### ChangeSets

When a package is changed with an changeset, the change will be stored as a
*branch* for the git repository of the package.

Besides the **name**, a ChangeSet is simply a set of these branches.

### Branches

A branch always belongs to a ChangeSet and a package and holds changes in the
git format for branches. Therefore, the branch references blobs, trees and
previous commits by their hash values. By default, missing blobs, trees and
commits are automatically fetched from GitHub if the package has a configured
`repository` URL in its `package.json` file.

The actual git objects and refs are stored in the IndexedDB of the browser. The
reference of the branch itself is named after the package address and the name
for the ChangeSet:

  `${packageAddress}/heads/${changeSetName}`

By keeping changes as git objects, it is easy to push ChangeSets as new pull
requests to GitHub, thereby integrating with the normal Lively development process.

All changesets in the current browser session are found by searching the IndexedDB
of the browser for refs in the format above for each registered pacakge.

### Notifications

There are four different types of system-wide notifications:

1. `{type: "lively.changesets/added", changeset}`
2. `{type: "lively.changesets/changed", changeset, path}`
3. `{type: "lively.changesets/switchedcurrent", changeset, before}`
4. `{type: "lively.changesets/deleted", changeset}`

These notifications are all emitted with `lively.notifications`.

### Tools

TODO: [ChangeSorter](http://wiki.squeak.org/squeak/2145)
