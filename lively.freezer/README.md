# lively.freezer

Winter is coming! The `Freezer` allows us to bundle apps written in `lively.next` in order to create fast loading single page apps.
Apps in `lively.next` use custom source transformation and access to meta information at runtime, so we need to provide several custom source transformations in order to make these apps compile successfully.
In order to do that, the `Freezer` provides a custom rollup plugin that can be added to rollup bundling tasks.
We are further planning to release plugins for other bundlers such as ESBuild or Webpack such that `lively.next` can be used in various different projects.

# License

[MIT](LICENSE)