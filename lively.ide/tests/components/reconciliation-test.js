/* global it, describe, beforeEach */
import { expect } from 'mocha-es6';
import { module } from 'lively.modules/index.js';
import { Color, pt, rect } from 'lively.graphics';
import { morph, VerticalLayout, Label } from 'lively.morphic';
import { part } from 'lively.morphic/components/core.js';

const testModuleId = 'local://lively-object-modules/TestPackage/component-model-test.cp.js';
let testComponentModule = module(testModuleId);
const initSource = `
import { part, component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color, pt} from 'lively.graphics';
import { Text } from "lively.morphic";

component.DescriptorClass = InteractiveComponentDescriptor;

const C = component({
  name: 'C',
  fill: Color.grey,
});

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
  },part(D, { name: 'some ref'})]
});

const B = component(A, {
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }]
});

component.DescriptorClass = ComponentDescriptor;

export { A, B, C, D };
`;

let ComponentA, ComponentB, ComponentC, ComponentD, A, B, C, D;

async function resetEnv () {
  await testComponentModule.reset();
  if (testComponentModule.format() === 'global') {
    await testComponentModule.changeSource('', { moduleId: testModuleId });
    await testComponentModule.reload();
    await testComponentModule.setFormat('register');
    await testComponentModule.changeSource(initSource, { moduleId: testModuleId });
    await testComponentModule.reload();
  } else {
    // reset the module to its original code
    await testComponentModule.changeSource(initSource, { moduleId: testModuleId });
  }
  // reload the module
  ({ A, B, C, D } = await testComponentModule.load());
  ComponentA = await A.edit();
  ComponentB = await B.edit();
  ComponentC = await C.edit();
  ComponentD = await D.edit();
}

describe('component -> source reconciliation', function () {
  beforeEach(async () => {
    await resetEnv();
  });

  it('updates the module source if a components prop changes', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.fill = Color.orange;
      ComponentA.getSubmorphNamed('some submorph').width = 100;
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('fill: Color.orange'), 'updates fill in code').to.be.true;
    expect(updatedSource.includes('extent: pt(100,50)'), 'updates width in code').to.be.true;
  });

  it('updates the imports if we introduce undefined refs', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.getSubmorphNamed('some submorph').padding = rect(5, 5, 5, 5);
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('import { rect } from \'lively.graphics/geometry-2d.js\';'), 'inserts the import').to.be.true;
  });

  it('updates the source if a submorph is added', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.addMorph(morph({
        name: 'some new morph',
        fill: Color.blue
      }));
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('name: \'some new morph\','), 'inserts a new morph').to.be.true;
  });

  it('correctly respects the order a submorph is inserted at', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.addMorph(morph({
        name: 'some new morph',
        fill: Color.blue
      }), ComponentB.get('some submorph'));
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    let updatedSource = await testComponentModule.source();
    expect(updatedSource.includes(`add({
    name: 'some new morph',
    fill: Color.blue
  }, 'some submorph')`), 'inserts a new morph before another one').to.be.true;

    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('some new morph').bringToFront();
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    updatedSource = await testComponentModule.source();
    expect(updatedSource.includes(`add({
    name: 'some new morph',
    fill: Color.blue
  }, 'some submorph')`), 'removes previous add call').not.to.be.true;
    expect(updatedSource.includes(`add({
    name: 'some new morph',
    fill: Color.blue
  })`), 'allows the added component to move to front').to.be.true;
  });

  it('updates the source if a submorph is removed', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.getSubmorphNamed('some submorph').remove();
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    let updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('type: Text,\n    name: \'some submorph\','), 'removes a morph from source').to.be.false;
    expect(updatedSource.includes('submorphs: [part(D, { name: \'some ref\'})]'), 'removes the submorph from array').to.be.true;
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.getSubmorphNamed('some ref').remove();
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('submorphs: []'), 'removes the submorph array').to.be.false;
  });

  it('updates the source if a part is added', async () => {
    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      ComponentC.addMorph(part(B, {
        name: 'derived morph',
        borderColor: Color.black,
        borderWidth: 2
      }));
    });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes(`submorphs: [part(B, {
    name: 'derived morph',
    borderColor: Color.black,
    borderWidth: 2
  })]`), 'inserts part reference into source code').to.be.true;
  });

  it('updates a part ref if its overridden props change', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.getSubmorphNamed('some ref').borderRadius = 10;
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes(`part(D, {
    name: 'some ref',
    borderRadius: 10
  })`)).to.be.true;
  });

  it('handles changes to multiple components at the same time', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.borderWidth = 50;
    });
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.borderRadius = 25;
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource.includes('borderWidth: 50') && updatedSource.includes('borderRadius: 25')).to.be.true;
  });

  it('uncollapses submorph hierarchy if a deeply located submorph is modified', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.getSubmorphNamed('a deep morph').fill = Color.blue;
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include(`const B = component(A, {
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }, {
    name: 'some ref',
    submorphs: [{
      name: 'a deep morph',
      fill: Color.blue
    }]
  }]
});`);
  });

  it('scopes submorphs properly by master components', async () => {
    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      ComponentC.addMorph({
        type: Label, name: 'some submorph'
      });
    });

    await ComponentC._changeTracker.onceChangesProcessed();
    await testComponentModule.reload();
    ({ C, A } = await testComponentModule.load());
    ComponentA = await A.edit();
    const trap = part(C, { name: 'name trap' });
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.addMorph(trap);
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    trap.withMetaDo({ reconcileChanges: true }, () => {
      trap.getSubmorphNamed('some submorph').fill = Color.black;
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include(`part(C, {
    name: 'name trap',
    submorphs: [{
      name: 'some submorph',
      fill: Color.black
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
    ComponentD.withMetaDo({ reconcileChanges: true }, () => {
      const l = ComponentD.addMorph({
        type: Label, name: 'some label'
      });
      l.textAndAttributes = ['Hello World!', null];
    });

    await ComponentD._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include('textAndAttributes: [\"Hello World!\",null]');
  });

  it('works properly with associated source editors', async () => {
    const sourceEditor = morph({ type: 'text', textString: initSource });
    ComponentA._changeTracker.__defineGetter__('sourceEditor', function () { return sourceEditor; });
    ComponentB._changeTracker.__defineGetter__('sourceEditor', function () { return sourceEditor; });
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.borderWidth = 50;
    });
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.borderRadius = 25;
    });
    // changes are immediately propagated to the sourceEditors
    expect(sourceEditor.textString).to.include('borderWidth: 50,');
    expect(sourceEditor.textString).to.include('borderRadius: 25,');
  });

  it('inserts properties in proper order', async () => {
    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      ComponentC.layout = new VerticalLayout({});
      ComponentC.extent = pt(40, 40);
      ComponentC.addMorph({
        name: 'foo', fill: Color.red, type: Label, fontColor: Color.green
      });
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
    fill: Color.red,
    fontColor: Color.green,
    textAndAttributes: ['', null]
  }]
});`);
  });

  it('updates a part ref if we add a submorph to it', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.addMorph({
        name: 'some new morph',
        extent: pt(400, 400),
        fill: Color.gray
      });
    });

    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include(`add({
    name: 'some new morph',
    extent: pt(400, 400),
    fill: Color.gray
  })`);
    expect(updatedSource).to.include('import { part, add, component, ComponentDescriptor } from \'lively.morphic/components/core.js\';');
  });

  it('updates a part ref if we remove a submorph from it', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('some submorph').remove();
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include('submorphs: [without(\'some submorph\')]');
  });

  it('discards empty deeply nested nodes if they are no longer needed', async () => {
    let updatedSource = await testComponentModule.source();
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('a deep morph').addMorph({
        name: 'something superflous',
        visible: false
      });
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    delete testComponentModule._source;
    updatedSource = await testComponentModule.source();
    expect(updatedSource).to.includes('name: \'something superflous\',');
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('something superflous').remove();
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    delete testComponentModule._source;
    updatedSource = await testComponentModule.source();
    expect(updatedSource).to.includes(`{
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }]
}`);
  });

  it('updates the source AND the spec in case a rename is detected', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.get('some ref').name = 'molly';
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include('name: \"molly\"');
    expect(A.stylePolicy.spec.submorphs[1].name).to.eql('molly');
  });

  it('properly resolves names by path instead of name', async () => {
    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      const alice = ComponentC.addMorph(part(D, { name: 'alice' }));
      const bob = ComponentC.addMorph(part(D, { name: 'bob' }));
      bob.submorphs[0].borderWidth = 40;
      alice.submorphs[0].borderRadius = 100;
    });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await testComponentModule.source();
    expect(updatedSource).to.include(`{
      name: 'a deep morph',
      borderWidth: 40
    }`);
    expect(updatedSource).to.include(`{
      name: 'a deep morph',
      borderRadius: 100
    }`);
  });
});
