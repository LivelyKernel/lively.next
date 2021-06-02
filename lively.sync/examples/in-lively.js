import { obj, num, arr, string } from 'lively.lang';
import { pt, Color, Point } from 'lively.graphics';
import { morph, HTMLMorph, EventDispatcher } from 'lively.morphic';
import { Client, Master } from 'lively.sync';
import { Renderer } from 'lively.morphic/rendering/renderer.js';

setup();

async function setup () {
  if (!$world.get('vdomMorphTest')) {
    let canvas = new HTMLMorph({ name: 'vdomMorphTest', extent: pt(1100, 400) });
    let win = canvas.openInWindow({ name: canvas.name + '-window', title: canvas.name }).activate();
  }

  $world.get('vdomMorphTest').html = `
  <div id="world1"></div>
  <div style="position: relative; left: 330px" id="world2"></div>
  <div style="position: relative; left: 730px" id="world3"></div>
  `;

  let rootNode1 = $world.get('vdomMorphTest').domNode.querySelector('#world1');
  let rootNode2 = $world.get('vdomMorphTest').domNode.querySelector('#world2');
  let rootNode3 = $world.get('vdomMorphTest').domNode.querySelector('#world3');

  let world1 = morph({ type: 'world', name: 'world1', extent: pt(300, 300) });
  let r1 = new Renderer(world1, rootNode1);
  r1.startRenderWorldLoop();
  let m1 = world1.addMorph({ name: 'm1', position: pt(20, 20), extent: pt(200, 200), fill: Color.red });

  await lively.lang.promise.waitFor(() => !world1._unrenderedChanges.length);

  let world2 = morph(world1.exportToJSON());
  let r2 = new Renderer(world2, rootNode2);
  r2.startRenderWorldLoop();

  let world3 = morph(world1.exportToJSON());
  let r3 = new Renderer(world3, rootNode3);
  r3.startRenderWorldLoop();

  let eventDispatcher1 = new EventDispatcher(rootNode1, world1); eventDispatcher1.install();
  let eventDispatcher2 = new EventDispatcher(rootNode2, world2); eventDispatcher2.install();
  let eventDispatcher3 = new EventDispatcher(rootNode3, world3); eventDispatcher3.install();

  let client1 = new Client(world1); let client2 = new Client(world3); let master = new Master(world2);
  master.clients = [client1, client2];
  client1.master = master;
  client2.master = master;

  world1.signalMorphChange = function (change, morph) { client1.newChange(change); };
  world3.signalMorphChange = function (change, morph) { client2.newChange(change); };

  // cleanup
  // r1.clear(); r2.clear(); r3.clear(); eventDispatcher1.uninstall(); eventDispatcher2.uninstall(); eventDispatcher3.uninstall();
}
