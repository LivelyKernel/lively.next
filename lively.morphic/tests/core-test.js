/* global it, describe, afterEach, before */
import { morph, Polygon } from '../index.js';
import { expect } from 'mocha-es6';
import { pt, rect, Color, Rectangle, Transform } from 'lively.graphics';
import { num } from 'lively.lang';
import { generateReferenceExpression } from 'lively.ide/js/inspector/helpers.js';

let world, submorph1, submorph2, submorph3, image, ellipse; // eslint-disable-line no-unused-vars
function createDummyWorld () {
  world = morph({
    type: 'world',
    name: 'world',
    extent: pt(300, 300),
    submorphs: [{
      name: 'submorph1',
      extent: pt(100, 100),
      position: pt(10, 10),
      fill: Color.red,
      submorphs: [{ name: 'submorph2', extent: pt(20, 20), position: pt(5, 10), fill: Color.green }]
    },
    { name: 'submorph3', extent: pt(50, 50), position: pt(200, 20), fill: Color.yellow },
    { type: 'image', name: 'image', extent: pt(80, 80), position: pt(20, 200), fill: Color.lightGray },
    { type: 'ellipse', name: 'ellipse', extent: pt(50, 50), position: pt(200, 200), fill: Color.pink }
    ]
  });
  image = world.submorphs[2];
  ellipse = world.submorphs[3];
  submorph1 = world.submorphs[0];
  submorph2 = world.submorphs[0].submorphs[0];
  submorph3 = world.submorphs[1];
  return world;
}

function closeToPoint (p1, p2) {
  let { x, y } = p1;
  expect(x).closeTo(p2.x, 0.1, 'x');
  expect(y).closeTo(p2.y, 0.1, 'y');
}

describe('copy', () => {
  let world;
  before(() => {
    world = morph({
      type: 'world',
      extent: pt(300, 300),
      submorphs: [{
        name: 'submorph1',
        extent: pt(100, 100),
        position: pt(10, 10),
        fill: Color.red,
        submorphs: [{ name: 'submorph2', extent: pt(20, 20), position: pt(5, 10), fill: Color.green }]
      }]
    });
  });

  it('copies all attributes', () => {
    let copy = world.get('submorph1').copy();
    expect(copy).to.containSubset({
      name: 'submorph1',
      fill: Color.red,
      position: pt(10, 10),
      submorphs: [{ name: 'submorph2' }]
    });
    expect(copy.owner).equals(null);
    expect(copy.id).not.equals(world.get('submorph1').id);
    expect(copy.get('submorph2').id).not.equals(world.get('submorph2').id);
  });
});

describe('properties', () => {
  it('Morph has an extent', () => {
    let m = morph({ extent: pt(300, 300) });
    expect(m.extent).equals(pt(300, 300));
  });
});

describe('relationship', () => {
  before(async () => createDummyWorld());

  it('withAllSubmorphsDetect', () => {
    expect(world.withAllSubmorphsDetect(ea => ea === submorph2)).equals(submorph2);
    expect(world.withAllSubmorphsDetect(ea => ea === 'foo')).equals(undefined);
  });

  it('withAllSubmorphsSelect', () => {
    expect(world.withAllSubmorphsSelect(ea => ea === submorph2)).deep.equals([submorph2]);
    expect(world.withAllSubmorphsSelect(ea => ea === 'foo')).deep.equals([]);
  });

  it('ownerChain', () => {
    let owners = submorph2.ownerChain();
    expect(owners).deep.equals([submorph1, world], owners.map(ea => ea.name).join(', '));
  });

  it('world', () => {
    expect(submorph2.world()).equals(world);
  });

  describe('addMorph', () => {
    afterEach(() => createDummyWorld());

    it('adds morph in front of other', () => {
      let newMorph = world.addMorph({ name: 'new morph' }, world.submorphs[1]);
      expect(world.submorphs[0]).equals(submorph1);
      expect(world.submorphs[1]).equals(newMorph);
      expect(world.submorphs[2]).equals(submorph3);
    });

    it('adds morph via index', () => {
      let newMorph1 = world.addMorphAt({ name: 'new morph 1' }, 1);
      expect(world.submorphs[0]).equals(submorph1);
      expect(world.submorphs[1]).equals(newMorph1);
      expect(world.submorphs[2]).equals(submorph3);
      let newMorph2 = world.addMorphAt({ name: 'new morph 2' }, 0);
      expect(world.submorphs[0]).equals(newMorph2);
      expect(world.submorphs[1]).equals(submorph1);
      let newMorph3 = world.addMorphAt({ name: 'new morph 2' }, 99);
      expect(world.submorphs[world.submorphs.length - 1]).equals(newMorph3);
    });

    it('replace with', () => {
      let submorph4 = submorph2.addMorph({ name: 'submorph4', position: pt(1, 1) });
      let submorph5 = submorph3.addMorph({ name: 'submorph5', position: pt(2, 2) });

      submorph2.replaceWith(submorph3);

      // transforms
      expect(submorph2.position).equals(pt(200, 20), 'pos submorph2');
      expect(submorph3.position).equals(pt(5, 10), 'pos submorph3');
      
      // owner/submorphs
      expect(submorph2.owner).equals(world, 'owner submorph2');
      expect(submorph3.owner).equals(submorph1, 'owner submorph3');
      expect(submorph2.submorphs).equals([submorph5], 'submorphs 2');
      expect(submorph3.submorphs).equals([submorph4], 'submorphs 3');
      expect(submorph5.position).equals(pt(2, 2), 'submorphs 5 transform');
      expect(submorph4.position).equals(pt(1, 1), 'submorphs 4 transform');

      // own position in submorphs
      expect(world.submorphs.indexOf(submorph2)).equals(1, 'subm index submorph2');
      expect(submorph1.submorphs.indexOf(submorph3)).equals(0, 'subm index submorph3');
    });
    
    it('replace with - parent with submorph', () => {
      submorph1.addMorphAt({ name: 'submorphxxx', position: pt(4, 7) }, 0);
      submorph1.replaceWith(submorph2);
      expect(submorph1.position).equals(pt(5, 10), 'pos submorph1');
      expect(submorph2.position).equals(pt(10, 10), 'pos submorph2');
      expect(submorph1.owner).equals(submorph2, 'owner submorph1');
      expect(submorph2.owner).equals(world, 'owner submorph2');
      expect(submorph2.submorphs.indexOf(submorph1)).equals(1, 'subm index submorph1');
      expect(world.submorphs.indexOf(submorph2)).equals(0, 'subm index submorph2');
    });

    it('leaves the global position unchanged', () => {
      let m1 = world.addMorph({ submorphs: [{ extent: pt(100, 200) }], clipMode: 'scroll' });
      m1.scroll = pt(0, 100);
      const globalPositionBefore = submorph1.globalPosition;
      m1.addMorph(submorph1);
      expect(globalPositionBefore).equals(submorph1.globalPosition);
    });

    it('onOwnerChanged gets triggered on remove and add', () => {
      let observed1 = []; let observed2 = [];
      submorph1.onOwnerChanged = owner => observed1.push(owner);
      submorph2.onOwnerChanged = owner => observed2.push(owner);
      submorph1.remove();
      expect(observed1).equals([null]);
      expect(observed2).equals([null]);
      observed1.length = 0; observed2.length = 0;

      world.addMorph(submorph1);
      expect(observed1).equals([world]);
      expect(observed2).equals([world]);
    });
  });

  describe('morph lookup', () => {
    afterEach(() => createDummyWorld());

    it('get() finds a morph by name', () => {
      expect(world.get('submorph2')).equals(submorph2);
      expect(submorph2.get('submorph3')).equals(submorph3);
      submorph2.remove();
      expect(submorph2.get('submorph3')).equals(null);
    });

    it('allows double naming', () => {
      submorph1.submorphs = [
        { name: 'a morph' },
        { name: 'a morph', submorphs: [{ name: 'another morph' }] },
        { name: 'a morph' }];
      let m = world.get('another morph');
      expect(m.owner).equals(submorph1.submorphs[1]);
      expect(m.get('a morph')).equals(submorph1.submorphs[1]);
    });

    it('get() uses toString', () => {
      submorph3.toString = () => 'oink';
      expect(world.get('oink')).equals(submorph3);
    });

    it('get() works with RegExp', () => {
      expect(world.get(/rph3/)).equals(submorph3);
    });
    
    it('get() finds owner or submorph of owners', () => {
      expect(submorph2.getOwnerNamed('submorph1')).equals(submorph1);
      expect(submorph2.get('submorph1')).equals(submorph1);
    });

    describe('generate reference chain', () => {
      it('generateReferenceExpression', () => {
        let m1 = morph();
        let m2 = morph();
        let m3 = morph();
        let m4 = morph();
        let m5 = morph();
        let m6 = morph();
        let m7 = morph();
        world.addMorph(m1);
        world.addMorph(m2);
        m1.name = 'some-morph';
        m2.name = 'some-morph';
  
        world.addMorph(m3);
        m3.addMorph(m4);
        m4.addMorph(m5);
        m3.addMorph(m6);
        m3.addMorph(m7);
  
        m3.name = 'm3';
        m4.name = 'm4';
        m5.name = 'm5';
        m6.name = 'm6';
        m7.name = 'm7';
 
        expect(`$world.getMorphWithId("${m1.id}")`).equals(generateReferenceExpression(m1));
        expect(`$world.getMorphWithId("${m2.id}")`).equals(generateReferenceExpression(m2));

        expect('$world.get("m3")').equals(generateReferenceExpression(m3));
        expect('$world.get("m3").get("m4")').equals(generateReferenceExpression(m4));
        expect('$world.get("m3").get("m5")').equals(generateReferenceExpression(m5));

        expect('this').equals(generateReferenceExpression(m2, { fromMorph: m2 }));
        expect('$world.get("m3").get("m7")').equals(generateReferenceExpression(m7, ({ fromMorph: m5 })));
      });
    });
  });
});

describe('bounds', () => {
  it('bounds includes submorphs', () => {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph({ position: pt(0, 0), extent: pt(25, 25), fill: Color.red });
    let submorph = morph({ position: pt(20, 20), extent: pt(30, 30), fill: Color.green });
    let subsubmorph = morph({ position: pt(20, 30), extent: pt(5, 5), fill: Color.blue });
    world.addMorph(morph1);
    morph1.addMorph(submorph);
    submorph.addMorph(subsubmorph);

    expect(morph1.bounds()).equals(new Rectangle(0, 0, 50, 55));
  });

  it('testMorphBounds', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph();
    let morph2 = morph();
    world.addMorph(morph1);
    morph1.addMorph(morph2);
    morph1.setBounds(rect(100, 100, 40, 40));
    morph2.setBounds(rect(20, 10, 40, 40));
    expect(rect(100, 100, 60, 50)).equals(morph1.bounds());
  });

  it('testMorphBoundsChangeOnExtentPositionScaleRotationTransformChanges', function () {
    let m = morph();
    m.setBounds(rect(100, 100, 40, 40));
    expect(rect(100, 100, 40, 40)).equals(m.bounds(), 'setBounds');
    m.extent = pt(50, 50);
    expect(rect(100, 100, 50, 50)).equals(m.bounds(), 'setExtent');
    m.position = pt(150, 50);
    expect(rect(150, 50, 50, 50)).equals(m.bounds(), 'setPosition');
    m.scale = 2;
    expect(rect(150, 50, 100, 100)).equals(m.bounds(), 'setScale');
    m.setTransform(new Transform(pt(0, 0)));
    expect(rect(0, 0, 50, 50)).equals(m.bounds(), 'setTransform');
    m.rotateBy(num.toRadians(45));
    expect(m.bounds().x).closeTo(-35.36, 0.1);
    expect(m.bounds().y).closeTo(0, 0.1);
    expect(m.bounds().width).closeTo(70.71, 0.1);
    expect(m.bounds().height).closeTo(70.71, 0.1);
  });

  it('testBorderWidthDoesNotAffectsBounds', function () {
    let m = morph();
    m.bounds = rect(100, 100, 40, 40);
    m.borderWidth = 4;
    expect(m.bounds).equals(rect(100, 100, 40, 40));
  });

  it('testSubmorphsAffectBounds', function () {
    let morph1 = morph();
    let morph2 = morph();
    morph1.setBounds(rect(100, 100, 40, 40));
    expect(rect(100, 100, 40, 40)).equals(morph1.bounds());
    morph1.addMorph(morph2);
    morph2.setBounds(rect(-10, 0, 20, 50));
    expect(rect(90, 100, 50, 50)).equals(morph1.bounds());
    morph2.remove();
    expect(rect(100, 100, 40, 40)).equals(morph1.bounds());
  });

  it('globalBounds for transformed inner morph', () => {
    let world = morph({
      type: 'world',
      extent: pt(300, 300),
      submorphs: [{
        extent: pt(100, 100),
        rotation: num.toRadians(-45),
        submorphs: [{ name: 'target', extent: pt(20, 20), rotation: num.toRadians(-45) }]
      }
      ]
    });
    // rotated by 2*-45 degs, should be at world origin, shifted up, same size as morph
    let { x, y, width, height } = world.get('target').globalBounds();
    expect(x).closeTo(0, 0.1, 'x');
    expect(y).closeTo(-20, 0.1, 'y');
    expect(width).closeTo(20, 0.1, 'width');
    expect(height).closeTo(20, 0.1, 'height');
  });

  it('globalBounds for inner morph with different origin', () => {
    let world = morph({
      type: 'world',
      extent: pt(300, 300),
      submorphs: [{
        extent: pt(100, 100),
        rotation: num.toRadians(0),
        submorphs: [{
          name: 'target',
          position: pt(10, 10),
          extent: pt(20, 20),
          rotation: num.toRadians(90),
          origin: pt(10, 10)
        }]
      }
      ]
    });
    // rotated by 2*-45 degs, should be at world origin, shifted up, same size as morph
    let { x, y, width, height } = world.get('target').globalBounds();
    expect(x).closeTo(0, 0.1, 'x');
    expect(y).closeTo(0, 0.1, 'y');
    expect(width).closeTo(20, 0.1, 'width');
    expect(height).closeTo(20, 0.1, 'height');
  });

  it('globalBounds for morph with submorphs AND different origin', () => {
    let world = morph({
      type: 'world',
      extent: pt(500, 500),
      submorphs: [{
        name: 'owner',
        extent: pt(100, 100),
        rotation: num.toRadians(0),
        submorphs: [{
          name: 'target',
          position: pt(100, 100),
          extent: pt(100, 100),
          rotation: num.toRadians(90),
          origin: pt(50, 50),
          submorphs: [{ extent: pt(100, 100) }]
        }]
      }
      ]
    });
    // rotated by 2*-45 degs, should be at world origin, shifted up, same size as morph
    let { x, y, width, height } = world.get('owner').globalBounds();
    expect(x).closeTo(0, 0.1, 'x');
    expect(y).closeTo(0, 0.1, 'y');
    expect(width).closeTo(150, 0.1, 'width');
    expect(height).closeTo(200, 0.1, 'height');
  });
});

describe('geometric transformations', () => {
  it('localizes position', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph();
    let morph2 = morph();
    world.addMorph(morph1);
    morph1.addMorph(morph2);
    morph2.position = pt(10, 10);
    expect(pt(0, 0)).equals(morph2.localize(pt(10, 10)));
  });

  it('origin influences bounds', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph({ extent: pt(200, 200), position: pt(150, 150), origin: pt(100, 100) });
    let morph2 = morph({ extent: pt(100, 100), position: pt(0, 0), origin: pt(50, 50) });
    world.addMorph(morph1);
    morph1.addMorph(morph2);
    expect(morph2.bounds().topLeft()).equals(pt(-50, -50));
    expect(morph1.bounds().width).equals(200);
    expect(morph2.globalBounds().topLeft()).equals(pt(100, 100));
    morph2.position = morph2.position.addPt(pt(1, 1));
    expect(morph2.origin).equals(pt(50, 50));
    expect(morph2.globalBounds().topLeft()).equals(pt(101, 101));
  });

  it('origin influences localize', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph({ extent: pt(200, 200), position: pt(150, 150), origin: pt(100, 100) });
    let morph2 = morph({ extent: pt(100, 100), position: pt(0, 0), origin: pt(50, 50) });
    world.addMorph(morph1);
    morph1.addMorph(morph2);
    expect(morph1.worldPoint(pt(0, 0))).equals(pt(150, 150));
    expect(morph1.localize(pt(150, 150))).equals(pt(0, 0));
  });

  it('localizes positions if nested in transforms', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph({ extent: pt(200, 200), position: pt(150, 150), origin: pt(100, 100) });
    let morph2 = morph({ extent: pt(100, 100), position: pt(0, 0), origin: pt(50, 50) });
    world.addMorph(morph1);
    morph1.addMorph(morph2);
    morph1.rotation = num.toRadians(-45);
    closeToPoint(morph2.localize(pt(150, 150)), pt(0, 0));
    expect(pt(150, 150)).equals(morph2.worldPoint(pt(0, 0)));
  });

  it('localizes positions if parent scrolled', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph({
      extent: pt(50, 50),
      position: pt(150, 150), 
      clipMode: 'scroll'
    });
    let morph2 = morph({ extent: pt(100, 100), position: pt(0, 0) });
    world.addMorph(morph1);
    morph1.addMorph(morph2);
    morph2.position = pt(50, 50);
    morph1.scroll = pt(50, 50);
    closeToPoint(morph2.localize(pt(150, 150)), pt(0, 0));
    expect(pt(150, 150)).equals(morph2.worldPoint(pt(0, 0)));
  });

  it('preserves the relative position of the origin when resized', function () {
    let m1 = morph({ origin: pt(50, 50), extent: pt(100, 100) });
    m1.resizeBy(pt(100, 100));
    expect(m1.origin).equals(pt(100, 100));
  });
});

describe('polygons and paths', () => {
  it('adjusts extent to contain each vertex', () => {
    const p = new Polygon({ vertices: [pt(0, 0), pt(100, 0), pt(0, 100)] });
    expect(p.extent).equals(pt(100, 100));
  });
});

describe('contains point', () => {
  it('can filter morphs by point inclusion', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph({ position: pt(0, 0), extent: pt(100, 100), fill: Color.red });
    let submorph = morph({ position: pt(20, 20), extent: pt(30, 30), fill: Color.green });
    let subsubmorph = morph({ position: pt(25, 25), extent: pt(5, 5), fill: Color.blue });
    let morph2 = morph({ position: pt(48, 48), extent: pt(100, 100), fill: Color.yellow, origin: pt(90, 90) });

    world.addMorph(morph1);
    morph1.addMorph(submorph);
    submorph.addMorph(subsubmorph);
    world.addMorph(morph2);

    let result;

    result = morph1.morphsContainingPoint(pt(-1, -1));
    expect(0).equals(result.length, 'for ' + pt(-1, -1));

    result = morph1.morphsContainingPoint(pt(1, 1));
    expect(1).equals(result.length, 'for ' + pt(1, 1));
    expect(morph1).equals(result[0], 'for ' + pt(1, 1));

    result = morph1.morphsContainingPoint(pt(40, 40));
    expect(2).equals(result.length, 'for ' + pt(40, 40));
    expect(submorph).equals(result[0]);
    expect(morph1).equals(result[1]);

    result = morph1.morphsContainingPoint(pt(45, 45));
    expect(3).equals(result.length, 'for ' + pt(45, 45));
    expect(subsubmorph).equals(result[0]);
    expect(submorph).equals(result[1]);
    expect(morph1).equals(result[2]);

    result = world.morphsContainingPoint(pt(48, 48));
    expect(5).equals(result.length, 'for ' + pt(48, 48));
    expect(morph2).equals(result[0]);
    expect(subsubmorph).equals(result[1]);
    expect(submorph).equals(result[2]);
    expect(morph1).equals(result[3]);
    expect(world).equals(result[4]);
  });

  it('morphs containing point with added morph in front', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let morph1 = morph({ position: pt(0, 0), extent: pt(100, 100) });
    let morph2 = morph({ position: pt(0, 0), extent: pt(100, 100) });

    world.addMorph(morph1);
    world.addMorphBack(morph2);

    let result = world.morphsContainingPoint(pt(1, 1));
    expect(3).equals(result.length);

    expect(morph1).equals(result[0], 'for ' + pt(1, 1));
    expect(morph2).equals(result[1], 'for ' + pt(1, 1));
  });

  it('morphs containing point does not include offset of owner', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let owner = morph({ name: 'owner', position: pt(0, 0), extent: pt(100, 100), fill: Color.red });
    let submorph = morph({ name: 'submorph', position: pt(110, 10), extent: pt(90, 90), fill: Color.green });
    let other = morph({ name: 'other', position: pt(100, 0), extent: pt(100, 100), fill: Color.blue });

    world.addMorph(owner);
    owner.addMorph(submorph);
    world.addMorphBack(other);

    let result = world.morphsContainingPoint(pt(150, 50));
    expect(3).equals(result.length, 'for ' + pt(150, 50));
    expect(world).equals(result[2], 'for 2');
    expect(other).equals(result[1], 'for 1');
    expect(submorph).equals(result[0], 'for 0');
  });

  it('scroll influences morphs containing point', function () {
    let world = morph({ type: 'world', extent: pt(300, 300) });
    let owner = morph({ name: 'owner', position: pt(0, 0), extent: pt(200, 200), fill: Color.red });
    let submorph = morph({ name: 'submorph', position: pt(150, 50), extent: pt(100, 1000), fill: Color.green });
    let other = morph({ name: 'other', position: pt(0, 0), extent: pt(100, 100), fill: Color.blue });

    world.addMorph(owner);
    owner.addMorph(submorph);
    submorph.addMorph(other);

    owner.clipMode = 'scroll';
    owner.scroll = pt(0, 1000);

    let result = world.morphsContainingPoint(pt(150, 50));
    expect(3).equals(result.length, 'for ' + pt(150, 50));
    expect(world).equals(result[2], 'for 2');
    expect(owner).equals(result[1], 'for 1');
    expect(submorph).equals(result[0], 'for 1');
  });
});

describe('command and keybinding test', () => {
  it('add command and keybinding and invoke', () => {
    let m = morph(); let run = 0;
    m.addKeyBindings([{ keys: 'input-a', command: 'do stuff' }]);
    m.addCommands([{ name: 'do stuff', exec: () => run++ }]);
    m.simulateKeys('a');
    expect(run).equals(1, 'command not run');

    m.removeCommands(['do stuff']);
    m.simulateKeys('a');
    expect(run).equals(1, 'command run although it was rmoved');
  });
});
