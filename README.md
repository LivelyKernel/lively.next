# lively.morphic [![Build Status](https://travis-ci.org/LivelyKernel/lively.morphic.svg?branch=master)](https://travis-ci.org/LivelyKernel/lively.morphic)
## Examples

Render two boxes:

```js
import { pt, Color } from "lively.graphics";
import { Renderer } from "lively.morphic/renderer.js";
import { Morph } from "lively.morphic/morph.js";

var world = new Morph({extent: pt(300,300)})
world.addMorph(new Morph({position: pt(34,20), extent: pt(50,100), fill: Color.green}))
world.addMorph(new Morph({position: pt(104,20), extent: pt(50,100), fill: Color.red}))
new Renderer().renderWorldLoop(world, document.body)
```
