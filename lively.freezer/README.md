# lively.freezer

Winter is coming! The `Freezer` allows us to bundle apps written in `lively.next` in order to create fast loading single page apps.
Apps in `lively.next` use custom source transformation and access to meta information at runtime, so we need to provide several custom source transformations in order to make these apps compile successfully.
In order to do that, the `Freezer` provides a custom rollup plugin that can be added to rollup bundling tasks.
We are further planning to release plugins for other bundlers such as ESBuild or Webpack such that `lively.next` can be used in various different projects.

## Adding HTML to the page head

In a project's `tools/build.mjs`, set `autoRun.head` on the existing `lively` plugin configuration. The string is inserted into the generated `index.html` inside `<head>`, before the frozen app starts:

```js
lively({
  resolver,
  // Keep the project's other plugin options here.
  autoRun: {
    title: 'My app',
    head: '<script src="https://www.gstatic.com/charts/loader.js"></script>'
  }
})
```

This can also contain `<meta>`, `<link>`, or `<style>` elements. Rebuild the project after changing the configuration. A world's `__head_html__` property is not read by the project build script.

When calling `bundleModule` from `lively.freezer` directly, pass the same configuration as `htmlConfig`, for example `{ htmlConfig: { title: 'My app', head: '<meta name="theme-color" content="#f1c40f">' } }`.

## Connections in frozen apps

Importing the shell editor plugin does not request the shell working directory. Creating a `ShellEditorPlugin` instance requests it and requires a shell connection.

This does not prevent UI code from explicitly opening connections. In particular, `UserFlapModel.setupNetworkIndicator` calls `L2LClient.forLivelyInBrowser` to display the server status. A frozen app that includes this flap or custom UI derived from it still needs a compatible server or must omit that connection-dependent UI. The general deployment request in #1720 remains open.

## Resurrection Builds

lively.freezer provides the option to produce a bundle that ships with module meta annotations. 
This includes information about which entities stem from what modules, 
This allows the bundle to support advanced meta programming at runtime which is useful for evolving the bundle behavior at runtime.
The primary use case for this is speed up the loading time of the lively.next IDE.

When loading a bundle that was built as a resurrection build, a fully functional `lively.modules` system is available, that allows us to retrieve any of the module objects that correspond to the modules included in the bundle.

For a given module object, we are further able to call `ModuleInterface>>revive()` on that module, which will replace part of the bundle responsible for this module with a dynamic object module instead. The user is then able to perform any runtime adjustments to that particular module and manipulate state and behavior of that module.

# License

[MIT](LICENSE)
