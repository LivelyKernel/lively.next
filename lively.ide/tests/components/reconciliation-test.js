/* global it, describe, beforeEach */
import { expect } from 'mocha-es6';
import { module } from 'lively.modules/index.js';
import { ComponentChangeTracker } from '../../component/editor.js';
import { Color, pt, rect } from 'lively.graphics';

import { morph, VerticalLayout, Label } from 'lively.morphic';

import { part } from 'lively.morphic/components/core.js';

const testModuleId = 'local://lively-object-modules/TestPackage/component-model-test.cp.js';
let testComponentModule = module(testModuleId);
const initSource = `
import { part, component } from 'lively.morphic/components/core.js';
import { Color, pt} from 'lively.graphics';
import { Text } from "lively.morphic";

const D = component({
  name: 'D',
  fill: Color.purple,
  submorphs: [{
    name: 'a deep morph',
    fill: Color.orange
  }]
});

const A = component({
  name: 'A',
  fill: Color.red,
  extent: pt(100,100),
  submorphs: [{
    type: Text,
    name: 'some submorph',
    extent: pt(50,50),
    fixedWidth: true,
    fixedHeight: true,
    fill: Color.yellow,
  },part(D, {}, { name: 'some ref'})]
});

const B = component(A, {
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }]
});

const C = component({
  name: 'C',
  fill: Color.grey,
});

export { A, B, C, D };
`;

let ComponentA, ComponentB, ComponentC, ComponentD;

async function resetEnv () {
  await testComponentModule.setFormat('esm');
  await testComponentModule.changeSource(initSource);
  if (!testComponentModule.isLoaded()) {
    await testComponentModule.load();
  } // update the native module
  await ComponentChangeTracker.injectComponentTrackers(testModuleId);
  ComponentA = testComponentModule.recorder.A;
  ComponentB = testComponentModule.recorder.B;
  ComponentC = testComponentModule.recorder.C;
  ComponentD = testComponentModule.recorder.D;
}

describe('component -> source reconciliation', () => {
  beforeEach(async () => {
    await resetEnv();
  });

  it('updates the module source if a components prop changes', async () => {
    ComponentA.fill = Color.orange;
    ComponentA.getSubmorphNamed('some submorph').width = 100;
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('fill: Color.rgb(255,153,0),'), 'updates fill in code').to.be.true;
    expect(updatedSource.includes('extent: pt(100,50),'), 'updates width in code').to.be.true;
  });

  it('updates the imports if we introduce undefined refs', async () => {
    ComponentA.getSubmorphNamed('some submorph').padding = rect(5, 5, 5, 5);
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('import { rect } from \'lively.graphics/geometry-2d.js\';'), 'inserts the import').to.be.true;
  });

  it('updates the source if a submorph is added', async () => {
    ComponentA.addMorph(morph({
      name: 'some new morph',
      fill: Color.blue
    }));
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('name: \'some new morph\','), 'inserts a new morph').to.be.true;
  });

  it('updates the source if a submorph is removed', async () => {
    ComponentA.getSubmorphNamed('some submorph').remove();
    await ComponentA._changeTracker.onceChangesProcessed();
    let updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('type: Text,\n    name: \'some submorph\','), 'removes a morph from source').to.be.false;
    expect(updatedSource.includes('submorphs: [part(D, {}, { name: \'some ref\'})]'), 'removes the submorph from array').to.be.true;
    ComponentA.getSubmorphNamed('some ref').remove();
    await ComponentA._changeTracker.onceChangesProcessed();
    updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('submorphs: []'), 'removes the submorph array').to.be.false;
  });

  it('updates the source if a part is added', async () => {
    ComponentC.addMorph(part(ComponentB, {}, {
      name: 'derived morph',
      borderColor: Color.black,
      borderWidth: 2
    }));
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes(`submorphs: [part(B, {}, {
    name: 'derived morph',
    borderColor: Color.rgb(0, 0, 0),
    borderWidth: 2,
    extent: pt(100, 100)
  })]`), 'inserts part reference into source code').to.be.true;
  });

  it('updates a part ref if its overridden props change', async () => {
    ComponentA.getSubmorphNamed('some ref').borderRadius = 10;
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes(`part(D, {}, {
    name: 'some ref',
    borderRadius: 10
  })`)).to.be.true;
  });

  it('handles changes to multiple components at the same time', async () => {
    ComponentA.borderWidth = 50;
    ComponentB.borderRadius = 25;
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('borderWidth: 50,') && updatedSource.includes('borderRadius: 25,')).to.be.true;
  });

  it('uncollapses submorph hierarchy if a deeply located submorph is modified', async () => {
    ComponentB.getSubmorphNamed('a deep morph').fill = Color.blue;
    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    // resetEnv()
    expect(updatedSource).to.include(`const B = component(A, {
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }, {
    name: 'some ref',
    submorphs: [{
      name: 'a deep morph',
      fill: Color.rgb(0, 0, 204)
    }]
  }]
});`);
  });
  // resetEnv()
  // two morphs with the same name but different master component hierarchies are reconciled correctly
  it('scopes submorphs properly by master components', async () => {
    ComponentC.addMorph({
      type: Label, name: 'some submorph'
    });
    const trap = part(ComponentC, {}, { name: 'name trap' });
    ComponentA.addMorph(trap);
    trap.getSubmorphNamed('some submorph').fill = Color.black;
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include(`(C, {}, {
    name: 'name trap',
    submorphs: [{
      type: Label,
      name: 'some submorph',
      fill: Color.rgb(0, 0, 0),
      textAndAttributes: ['', null]
    }]
  })`);
  });

  it('skips unnessecary properties of morphs', async () => {
    ComponentC.addMorph({
      type: Label, name: 'some label', extent: pt(42, 42)
    });
    ComponentC.layout = new VerticalLayout({ spacing: 5, renderViaCSS: false });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).not.to.include('extent: pt(42, 42)');
    expect(updatedSource).not.to.include('position: pt(5, 5)');
  });

  it('reconciles textAndAttributes', async () => {
    const l = ComponentD.addMorph({
      type: Label, name: 'some label'
    });
    l.textAndAttributes = ['Hello World!', null];
    await ComponentD._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include('textAndAttributes: [\"Hello World!\",null]');
  });

  it('works properly with associated source editors', async () => {
    const sourceEditor = morph({ type: 'text', textString: initSource });
    ComponentA._changeTracker.__defineGetter__('sourceEditor', function () { return sourceEditor; });
    ComponentB._changeTracker.__defineGetter__('sourceEditor', function () { return sourceEditor; });
    ComponentA.borderWidth = 50;
    ComponentB.borderRadius = 25;
    // changes are immediately propagated to the sourceEditors
    expect(sourceEditor.textString).to.include('borderWidth: 50,');
    expect(sourceEditor.textString).to.include('borderRadius: 25,');
  });

  it('inserts properties in proper order', async () => {
    ComponentC.layout = new VerticalLayout({});
    ComponentC.extent = pt(40, 40);
    ComponentC.addMorph({
      name: 'foo', fill: Color.red, type: Label, fontColor: Color.green
    });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.includes(`const C = component({
  name: 'C',
  extent: pt(40, 40),
  layout: new VerticalLayout({
    direction: 'topToBottom',
    orderByIndex: true,
    resizeSubmorphs: false
  }),
  fill: Color.grey,
  submorphs: [{
    type: Label,
    name: 'foo',
    fill: Color.rgb(204, 0, 0),
    fontColor: Color.rgb(0, 204, 0),
    textAndAttributes: ['', null]
  }]
});`);
  });

  it('updates a part ref if we add a submorph to it', async () => {
    ComponentB.addMorph({
      name: 'some new morph',
      extent: pt(400, 400),
      fill: Color.gray
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include(`add({
    name: 'some new morph',
    extent: pt(400, 400),
    fill: Color.rgb(204, 204, 204)
  })`);
    expect(updatedSource).to.include('import { part, add, component } from \'lively.morphic/components/core.js\';');
  });

  // resetEnv()
  it('updates a part ref if we remove a submorph from it', async () => {
    ComponentB.get('some submorph').remove();
    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include('submorphs: [without(\'some submorph\')]');
  });
});

describe('source -> component reconciliation', () => {

});
