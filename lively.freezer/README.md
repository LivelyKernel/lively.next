# lively.freezer

Winter is coming! The `Freezer` allows us to bundle apps written in `lively.next` in order to create fast loading single page apps.
Apps in `lively.next` use custom source transformation and access to meta information at runtime, so we need to provide several custom source transformations in order to make these apps compile successfully.
In order to do that, the `Freezer` provides a custom rollup plugin that can be added to rollup bundling tasks.
We are further planning to release plugins for other bundlers such as ESBuild or Webpack such that `lively.next` can be used in various different projects.

## Resurrection Builds

lively.freezer provides the option to produce a bundle that ships with module meta annotations. 
This includes information about which entities stem from what modules, 
This allows the bundle to support advanced meta programming at runtime which is useful for evolving the bundle behavior at runtime.
The primary use case for this is speed up the loading time of the lively.next IDE.

When loading a bundle that was built as a resurrection build, a fully functional `lively.modules` system is available, that allows us to retrieve any of the module objects that correspond to the modules included in the bundle.

For a given module object, we are further able to call `ModuleInterface>>revive()` on that module, which will replace part of the bundle responsible for this module with a dynamic object module instead. The user is then able to perform any runtime adjustments to that particular module and manipulate state and behavior of that module.

# License

[MIT](LICENSE)