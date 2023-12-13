/* global it, describe, beforeEach, afterEach, System,xdescribe */
import { createDOMEnvironment } from 'lively.morphic/rendering/dom-helper.js';
import { MorphicEnv, morph } from 'lively.morphic';
import { expect } from 'mocha-es6';
import { pt, Color } from 'lively.graphics';
import { num, promise } from 'lively.lang';
import { LivelyWorld } from 'lively.ide/world.js';

let describeInBrowser = System.get('@system-env').browser
  ? describe
  : (title, fn) => { console.warn(`Test ${title} is currently only supported in a browser`); return xdescribe(title, fn); };

let world, submorph1, submorph2, submorph3;
function createDummyWorld () {
  world = morph({
    type: LivelyWorld,
    name: 'world',
    extent: pt(1000, 1000),
    submorphs: [{
      name: 'submorph1',
      extent: pt(100, 100),
      position: pt(10, 10),
      fill: Color.red,
      submorphs: [{ name: 'submorph2', extent: pt(20, 20), position: pt(5, 10), fill: Color.green }]
    }, {
      name: 'submorph3', extent: pt(100, 100), position: pt(400, 400), fill: Color.blue
    }]
  });
  submorph1 = world.submorphs[0];
  submorph2 = submorph1.submorphs[0];
  submorph3 = world.get('submorph3');
  return world;
}

let env;
async function setup () {
  env = MorphicEnv.pushDefault(new MorphicEnv(await createDOMEnvironment()));
  await env.setWorld(createDummyWorld());
}

async function teardown () {
  await world.whenRendered();
  await MorphicEnv.popDefault().uninstall();
}

function closeToPoint (p1, p2) {
  let { x, y } = p1;
  expect(x).closeTo(p2.x, 0.1, 'x');
  expect(y).closeTo(p2.y, 0.1, 'y');
}

describeInBrowser('halos', function () {
  // this.timeout(10 * 1000);

  beforeEach(setup);

  afterEach(teardown);

  it('halo items are placed correctly', async () => {
    submorph1.origin = pt(20, 30);
    submorph1.position = pt(100, 100);
    let halo = await world.showHaloFor(submorph1);
    let innerButton = halo.buttonControls
      .filter(item => item !== halo.originHalo() && !item.isResizeHandle && item !== halo.borderBox)
      .find(item => submorph1.globalBounds().containsPoint(item.globalBounds().center()));
    expect(innerButton).equals(undefined, `halo item ${innerButton && innerButton.name} is inside the bounds of its target`);
    expect(halo.originHalo().globalBounds().center()).equals(submorph1.worldPoint(pt(0, 0)));
  });

  it('halo items never overlap each other', async () => {
    submorph1.position = pt(100, 100);
    submorph1.origin = pt(20, 30);
    submorph1.extent = pt(20, 20);
    let halo = await world.showHaloFor(submorph1);
    await halo.whenRendered();
    let innerButton = halo.buttonControls.find(item =>
      halo.buttonControls.find(otherItem =>
        otherItem !== item &&
        !otherItem.isHandle &&
        otherItem !== halo.borderBox &&
        otherItem !== halo.responsiveHalo() &&
        otherItem.globalBounds().intersects(item.globalBounds())) &&
      item !== halo.originHalo() &&
      item !== halo.responsiveHalo() &&
      item !== halo.borderBox &&
      !item.isHandle);
    expect(innerButton).equals(undefined, `halo item ${innerButton && innerButton.name} is inside the bounds of its target`);
  });

  it('can select multiple morphs', async () => {
    let halo = await world.showHaloForSelection([submorph1, submorph2]);
    expect(halo.target.selectedMorphs).equals([submorph1, submorph2]);
    expect(halo.borderBox.globalBounds()).equals(submorph1.globalBounds().union(submorph2.globalBounds()));
  });

  it('can select and deselect morphs from selection', async () => {
    let halo = await world.showHaloForSelection([submorph1, submorph2]);
    halo = await halo.addMorphToSelection(submorph3);
    expect(halo.target.selectedMorphs).equals([submorph1, submorph2, submorph3]);
    expect(halo.borderBox.globalBounds()).equals(submorph1.globalBounds()
      .union(submorph2.globalBounds())
      .union(submorph3.globalBounds()));
    halo = await halo.removeMorphFromSelection(submorph2);
    expect(halo.target.selectedMorphs).equals([submorph1, submorph3]);
    expect(halo.borderBox.globalBounds()).equals(
      submorph1.globalBounds()
        .union(submorph3.globalBounds()));
  });

  it('name shows name', async () => {
    let halo = await world.showHaloFor(submorph1);
    expect(halo.nameHalo().nameHolders[0].submorphs[0].textString).equals(submorph1.name);
  });

  it('drag drags', async () => {
    let halo = await world.showHaloFor(submorph1);
    halo.dragHalo().init();
    halo.dragHalo().update(pt(10, 5));
    expect(submorph1.position).equals(pt(20, 15));
  });

  it('drags correctly of owner is transformed', async () => {
    let halo = await world.showHaloFor(submorph2);
    submorph2.owner.rotateBy(45);
    const prevGlobalPos = submorph2.globalPosition;
    halo.dragHalo().init();
    halo.dragHalo().update(pt(10, 5));
    expect(submorph2.globalPosition).equals(prevGlobalPos.addXY(10, 5));
  });

  it('active drag hides other halos and displays position bob', async () => {
    let halo = await world.showHaloFor(submorph1);
    let dragHalo = halo.dragHalo();
    let otherHalos = halo.buttonControls.filter((b) => b !== dragHalo && !b.isHandle);
    dragHalo.init();
    halo.alignWithTarget();
    expect(halo.state.activeButton).equals(dragHalo);
    expect(halo.propertyDisplay.displayedValue()).equals(submorph1.position.toString());
    otherHalos.forEach((h) => expect(h).to.have.property('visible', false));
  });

  it('drags gridded and shows guides', async () => {
    let halo = await world.showHaloFor(submorph1);
    halo.dragHalo().init();
    halo.dragHalo().update(pt(10, 11), true);
    expect(submorph1.position).equals(pt(20, 20));
    let mesh = halo.getSubmorphNamed('mesh');
    expect(mesh).not.to.be.null;
    expect(mesh.vertical).not.to.be.null;
    expect(mesh.horizontal).not.to.be.null;
    halo.dragHalo().stop();
    expect(mesh.owner).to.be.null;
  });

  it('resize resizes', async () => {
    let halo = await world.showHaloFor(submorph1);
    let resizeHandle = halo.ensureResizeHandles().find(h => h.corner === 'bottomRight');
    resizeHandle.init(pt(0, 0));
    resizeHandle.update(pt(10, 5));
    expect(submorph1.extent).equals(pt(110, 105));
  });

  it('resizes correctly if transformation present', async () => {
    submorph1.rotation = num.toRadians(-45);
    let halo = await world.showHaloFor(submorph1);
    let resizeHandle = halo.ensureResizeHandles().find(h => h.corner === 'bottomCenter');
    resizeHandle.init(pt(0, 0));
    resizeHandle.update(pt(10, 10));
    expect(submorph1.extent).equals(pt(100, 100 + pt(10, 10).r()));
  });

  it('align to the morph extent while resizing', async () => {
    submorph1.origin = pt(20, 30);
    submorph1.position = pt(100, 100);
    let halo = await world.showHaloFor(submorph1, 'test-pointer-1');
    let resizeButton = halo.ensureResizeHandles().find(h => h.corner === 'bottomRight');
    resizeButton.init(pt(0, 0));
    resizeButton.update(pt(42, 42));
    expect(halo.borderBox.extent).equals(submorph1.extent);
  });

  it('active resize hides other halos and displays extent', async () => {
    let halo = await world.showHaloFor(submorph1);
    let resizeHalo = halo.ensureResizeHandles().find(h => h.corner === 'bottomRight');
    let otherHalos = halo.buttonControls.filter((b) =>
      b !== resizeHalo && !b.isHandle &&
            b !== halo.propetyDisplay);
    resizeHalo.init();
    halo.alignWithTarget();
    expect(halo.state.activeButton).equals(resizeHalo);
    expect(halo.propertyDisplay.displayedValue()).equals('100.0x100.0');
    otherHalos.forEach((h) => expect(h).to.have.property('visible', false));
  });

  it('resizes proportionally', async () => {
    let halo = await world.showHaloFor(submorph1);
    let resizeHandle = halo.ensureResizeHandles().find(h => h.corner === 'bottomRight');
    resizeHandle.init(pt(0, 0), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
    resizeHandle.update(pt(10, 5), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
    resizeHandle.update(pt(1000, 500), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
    resizeHandle = halo.ensureResizeHandles().find(h => h.corner === 'rightCenter');
    resizeHandle.init(pt(0, 0), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
    resizeHandle.update(pt(10, 5), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
    resizeHandle.update(pt(1000, 500), true);
    expect(submorph1.extent.x).equals(submorph1.extent.y);
  });

  it('shows a visual guide when resizing proportionally', async () => {
    let halo = await world.showHaloFor(submorph1);
    let resizeHandle = halo.ensureResizeHandles().find(h => h.corner === 'bottomRight');
    resizeHandle.init(pt(0, 0), true);
    resizeHandle.update(pt(10, 5), true);
    let d = halo.getSubmorphNamed('diagonal');
    expect(d).to.not.be.undefined;
  });

  it('rotate rotates', async () => {
    let halo = await world.showHaloFor(submorph1);
    submorph1.rotation = num.toRadians(10);
    halo.rotateHalo().init(num.toRadians(10));
    halo.rotateHalo().update(num.toRadians(10));
    expect(submorph1.rotation).closeTo(num.toRadians(10), 0.1);
    halo.rotateHalo().update(num.toRadians(25));
    expect(submorph1.rotation).closeTo(num.toRadians(25), 0.1);
  });

  it('rotate does not align to Halo while active', async () => {
    let halo = await world.showHaloFor(submorph1);
    submorph1.rotation = num.toRadians(10);
    halo.rotateHalo().init(num.toRadians(10));
    halo.rotateHalo().position = pt(55, 55);
    halo.rotateHalo().update(num.toRadians(10));
    expect(halo.rotateHalo().position).equals(pt(55, 55));
    halo.rotateHalo().stop();
    expect(halo.rotateHalo().position).not.equals(pt(55, 55));
  });

  it('rotate snaps to 45 degree angles', async () => {
    let halo = await world.showHaloFor(submorph1);
    halo.rotateHalo().init(num.toRadians(10));
    halo.rotateHalo().update(num.toRadians(52));
    expect(submorph1.rotation).equals(num.toRadians(45));
  });

  it('indicates rotation', async () => {
    let halo = await world.showHaloFor(submorph1);
    let rh = halo.rotateHalo();
    let oh = halo.originHalo();
    rh.init(num.toRadians(10));
    rh.update(num.toRadians(25));
    const ri = halo.getSubmorphNamed('rotationIndicator');
    expect(ri).to.not.be.undefined;
    expect(ri.vertices.map(({ x, y }) => ri.worldPoint(pt(x, y))))
      .equals([oh.globalBounds().center(), rh.globalBounds().center()]);
  });

  it('scale scales', async () => {
    let halo = await world.showHaloFor(submorph1);
    halo.rotateHalo().initScale(pt(10, 10));
    halo.rotateHalo().updateScale(pt(20, 20));
    expect(submorph1.scale).equals(2);
  });

  it('scale snaps to factors of 0.5', async () => {
    let halo = await world.showHaloFor(submorph1);
    halo.rotateHalo().initScale(pt(10, 10));
    halo.rotateHalo().updateScale(pt(19.5, 19.5));
    expect(submorph1.scale).equals(2);
  });

  it('indicates scale', async () => {
    let halo = await world.showHaloFor(submorph1);
    let rh = halo.rotateHalo();
    let oh = halo.originHalo();
    rh.initScale(pt(10, 10));
    rh.updateScale(pt(20, 20));
    const ri = halo.getSubmorphNamed('rotationIndicator');
    expect(ri).to.not.be.undefined;
    expect(ri.vertices.map(({ x, y }) =>
      ri.worldPoint(pt(x, y)))).equals(
      [oh.globalBounds().center(), rh.globalBounds().center()]);
  });

  it('active rotate halo hides other halos and displays rotation', async () => {
    let halo = await world.showHaloFor(submorph1);
    let rotateHalo = halo.rotateHalo();
    let otherHalos = halo.buttonControls.filter((b) => b !== rotateHalo);
    rotateHalo.init();
    halo.alignWithTarget();
    expect(halo.state.activeButton).equals(rotateHalo);
    expect(halo.propertyDisplay.displayedValue()).equals('0.0°');
    otherHalos.forEach((h) => {
      expect(h).to.have.property('visible', false);
    });
  });

  it('close removes', async () => {
    let halo = await world.showHaloFor(submorph1);
    halo.closeHalo().update();
    expect(submorph1.owner).equals(null);
  });

  it('origin shifts origin', async () => {
    submorph1.origin = pt(20, 30);
    let halo = await world.showHaloFor(submorph1);
    halo.originHalo().update(pt(10, 5));
    expect(submorph1.origin).equals(pt(30, 35));
    expect(halo.originHalo().globalBounds().center()).equals(submorph1.worldPoint(pt(0, 0)));
  });

  it('origin shifts origin according to global delta', async () => {
    submorph1.position = pt(200, 100);
    submorph1.rotateBy(num.toRadians(90));
    let halo = await world.showHaloFor(submorph1);
    halo.originHalo().update(pt(20, 5));
    expect(submorph1.origin).equals(pt(5, -20));
  });

  it('shifting the origin will not move bounds', async () => {
    submorph1.position = pt(200, 100);
    submorph1.rotateBy(num.toRadians(90));
    let oldGlobalPos = submorph1.globalBounds().topLeft();
    let halo = await world.showHaloFor(submorph1);
    halo.originHalo().update(pt(20, 5));
    expect(submorph1.origin).equals(pt(5, -20));
    expect(submorph1.globalBounds().topLeft()).equals(oldGlobalPos);

    submorph1.rotation = num.toRadians(-42);
    oldGlobalPos = submorph2.globalBounds().topLeft();
    halo = await world.showHaloFor(submorph2);
    halo.originHalo().update(pt(20, 5));
    closeToPoint(submorph2.globalBounds().topLeft(), oldGlobalPos);

    submorph2.rotation = num.toRadians(-20);
    oldGlobalPos = submorph2.globalBounds().topLeft();
    halo = await world.showHaloFor(submorph2);
    halo.originHalo().update(pt(20, 5));
    closeToPoint(submorph2.globalBounds().topLeft(), oldGlobalPos);
  });

  it('shifting the origin will not move submorphs', async () => {
    submorph1.position = pt(200, 100);
    submorph1.rotateBy(num.toRadians(90));
    let halo = await world.showHaloFor(submorph1);
    let oldGlobalPos = submorph2.globalPosition;
    halo.originHalo().update(pt(20, 5));
    closeToPoint(submorph2.globalPosition, oldGlobalPos);
  });

  it('origin halo aligns correctly if owner is transformed', async () => {
    let halo = await world.showHaloFor(submorph2);
    submorph1.rotation = num.toRadians(-45);
    submorph2.rotation = num.toRadians(-45);
    halo.alignWithTarget();
    expect(submorph2.worldPoint(submorph2.origin)).equals(halo.originHalo().globalBounds().center());
  });

  it('origin halo aligns correctly if morph is transformed with different origin', async () => {
    let halo = await world.showHaloFor(submorph1);
    submorph1.adjustOrigin(submorph1.innerBounds().center());
    submorph1.rotation = num.toRadians(-45);
    halo.alignWithTarget();
    let originHaloCenter = halo.originHalo().globalBounds().center();
    let originWorldPos = submorph1.worldPoint(pt(0, 0));
    closeToPoint(originHaloCenter, originWorldPos);
  });

  it('origin halo aligns correctly if owner is transformed with different origin', async () => {
    let halo = await world.showHaloFor(submorph2);
    submorph1.adjustOrigin(submorph2.innerBounds().center());
    submorph2.adjustOrigin(submorph2.innerBounds().center());
    submorph1.rotation = num.toRadians(-45);
    submorph2.rotation = num.toRadians(-45);
    halo.alignWithTarget();
    let originHaloCenter = halo.originHalo().globalBounds().center();
    let originWorldPos = submorph2.worldPoint(pt(0, 0));
    closeToPoint(originHaloCenter, originWorldPos);
  });

  it('grab grabs', async () => {
    let halo = await world.showHaloFor(submorph2);
    let hand = world.handForPointerId('test-pointer');
    halo.grabHalo().init(hand);
    hand.update({ halo, position: submorph1.globalBounds().center() });
    expect(halo.borderBox.globalPosition).equals(submorph2.globalBounds().topLeft());
    expect(submorph2.owner).equals(hand);
    halo.grabHalo().stop({ hand });
    expect(halo.borderBox.globalPosition).equals(submorph2.globalBounds().topLeft());
    expect(submorph2.owner).equals(submorph1);
  });

  it('copy copies', async () => {
    let halo = await world.showHaloFor(submorph2);
    let hand = world.handForPointerId('test-pointer');
    halo.copyHalo().init(hand);
    let [copy] = hand.grabbedMorphs;
    expect(copy).not.equals(submorph2);
    hand.position = submorph1.globalBounds().center();
    halo.copyHalo().stop(hand);
    expect(copy.owner).equals(submorph1);
  });
});
