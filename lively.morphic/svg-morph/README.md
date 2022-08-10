# SVG Morph

This package is an implementation to add SVG support to lively.next. It tries to utilize the DOM functionality as much as possible.

## Entry Points

The main entry point of the project is the [svg-morph](https://github.com/T4rikA/lively.next/blob/svg-halo/lively.morphic/svg-morph/svg-morph.js) file. Here the main functionality and the custom virtual node is described.
To get the rendering support of the DOM we use a custom virtual node. How to define such a custom virtual node can be seen [here](https://github.com/Matt-Esch/virtual-dom/blob/master/docs/widget.md). This virtual node allows us to define custom content. Here we use a DOM node (the SVG node).
We extented the halo of the SVG morph with an edit mode, all custom SVG functionality is reachable in the edit mode in the lower right corner.
To select a path of a SVG use the lively.next interaction mode. Then you see control points and the styling properties in the properties panel.

The driver code for editing the path is in the [svg-morph](https://github.com/T4rikA/lively.next/blob/svg-halo/lively.morphic/svg-morph/svg-morph.js) file.

The code for the properties panel can be found in the [svg.cp.js](https://github.com/T4rikA/lively.next/blob/svg-halo/lively.ide/studio/controls/svg.cp.js) file. Here we define custom `ViewModels` and use those in custom `Components`.

## SVG.js 
We added [SVG.js](https://svgjs.dev/docs/3.0/) for easier editing and accessing of SVG attributes. It also enables easier animating of the SVG.

## Open ToDos
- full support of the SVG standard (styling and editing)
- "higher order functions" like multi select, snapping, ...
- support for more svg elements as currently only paths are supported and can be manipulated
