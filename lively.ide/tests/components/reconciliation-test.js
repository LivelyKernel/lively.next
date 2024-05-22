/* global it, describe, beforeEach, afterEach, after, System */
import { expect, chai } from 'mocha-es6';
import sinonChai from 'esm://cache/sinon-chai';
import sinon from 'esm://cache/sinon';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { getSystem, PackageRegistry, removeSystem } from 'lively.modules';
import { importPackage } from 'lively.modules/src/packages/package.js';
import { Color, pt, rect } from 'lively.graphics';
import { morph, component, add, without, TilingLayout, Label, part } from 'lively.morphic';
import { GlobalInjector } from 'lively.modules/src/import-modification.js';
import { Reconciliation } from '../../components/reconciliation.js';
import { promise } from 'lively.lang';
import { getPathFromMorphToMaster } from '../../components/helpers.js';

chai.use(sinonChai);

const initSource = `
"format esm";
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
  borderWidth: { top: 0,  left: 1,  bottom: 2, right: 4 },
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

const X = component(B, {
  name: 'X'
});

const T = component({
  name: 'T',
  submorphs: [{
    name: 'a greeter',
    type: 'text',
    value: 'hello world'
  }, {
    name: 'another greeter',
    type: 'text',
    textString: 'yo bro!'
  }]
});

component.DescriptorClass = ComponentDescriptor;

export { A, B, C, D, X, T };
`;

let ComponentA, ComponentB, ComponentC, ComponentD, ComponentX, ComponentT,
  A, B, C, D, X, T;

let testDir = 'local://component-reconciliation-test/';

async function getSource () {
  // delete testComponentModule._source;
  return await module(System, testDir + 'project1/test.cp.js').source();
}

let project1 = {
  'test.cp.js': initSource,
  'package.json': '{"name": "project1", "main": "test.cp.js"}'
};
let testResources = {
  project1: project1
};

let S;

async function prepareEnv () {
  const modId = testDir + 'project1/test.cp.js';
  await createFiles(testDir, testResources);
  const mod = module(System, modId);
  ({ A, B, C, D, X, T } = await mod.load());
  A.previouslyRemovedMorphs = new WeakMap();
  B.previouslyRemovedMorphs = new WeakMap();
  C.previouslyRemovedMorphs = new WeakMap();
  D.previouslyRemovedMorphs = new WeakMap();
  T.previouslyRemovedMorphs = new WeakMap();
  ComponentA = await A.edit();
  ComponentB = await B.edit();
  ComponentC = await C.edit();
  ComponentD = await D.edit();
  ComponentX = await X.edit();
  ComponentT = await T.edit();
}

async function resetEnv () {
  const modId = testDir + 'project1/test.cp.js';
  const mod = module(System, modId);
  await mod.unload();
  await resource(testDir).remove();
  await System._livelyModulesTranslationCache.deleteCachedData(modId);
}

describe('component -> source reconciliation', function () {
  beforeEach(async () => {
    await prepareEnv();
  });

  afterEach(async () => {
    await resetEnv();
  });

  it('updates the module source if a components prop changes', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.fill = Color.orange;
      ComponentA.getSubmorphNamed('some submorph').width = 100;
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(updatedSource.includes('name: \'A\',\n  fill: Color.orange'), 'updates fill in code').to.be.true;
    expect(updatedSource.includes('extent: pt(100,50)'), 'updates width in code').to.be.true;
  });

  it('inserts properties in proper order', async () => {
    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      ComponentC.layout = new TilingLayout();
      ComponentC.extent = pt(40, 40);
      ComponentC.addMorph({
        name: 'foo', fill: Color.red, type: Label, fontColor: Color.green
      });
    });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(C.stylePolicy.spec.extent).to.equal(pt(40, 40));
    expect(updatedSource).to.includes(`const C = component({
  name: 'C',
  extent: pt(40, 40),
  layout: new TilingLayout({}),
  fill: Color.grey,
  submorphs: [{
    type: Label,
    name: 'foo',
    fill: Color.red,
    fontColor: Color.green
  }]
});`);
  });

  it('updates the module if a component prop is set back to its parent value', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('some submorph').fill = Color.yellow;
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(updatedSource).includes(`const B = component(A, {
  name: 'B'
});`);
  });

  it('updates the imports if we introduce undefined refs', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.getSubmorphNamed('some submorph').padding = rect(5, 5, 5, 5);
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
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
    const updatedSource = await getSource();
    expect(updatedSource.includes('name: \'some new morph\','), 'inserts a new morph').to.be.true;
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
    const updatedSource = await getSource();
    expect(updatedSource.includes(`submorphs: [part(B, {
    name: 'derived morph',
    borderColor: Color.black,
    borderWidth: 2
  })]`), 'inserts part reference into source code').to.be.true;
  });

  it('correctly respects the order a submorph is inserted at', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.addMorph(morph({
        name: 'some new morph',
        fill: Color.blue
      }), ComponentB.get('some submorph'));
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    let updatedSource = await getSource();
    expect(updatedSource.includes(`add({
    name: 'some new morph',
    fill: Color.blue
  }, 'some submorph')`), 'inserts a new morph before another one').to.be.true;

    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('some new morph').bringToFront();
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    updatedSource = await getSource();
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
    let updatedSource = await getSource();

    expect(updatedSource.includes('type: Text,\n    name: \'some submorph\','), 'removes a morph from source').to.be.false;
    expect(updatedSource.includes('submorphs: [part(D, { name: \'some ref\' })]'), 'removes the submorph from array').to.be.true;
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.getSubmorphNamed('some ref').remove();
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    updatedSource = await getSource();
    expect(updatedSource.includes('submorphs: []'), 'removes the submorph array').to.be.false;
  });

  it('updates the layouts definitions in response to a morph getting removed', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, async () => {
      ComponentB.layout = new TilingLayout({
        resizePolicies: [
          ['some submorph', { height: 'fill', width: 'fill' }]
        ]
      });
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    let updatedSource = await getSource();
    expect(updatedSource).includes(`const B = component(A, {
  name: 'B',
  layout: new TilingLayout({
    resizePolicies: [['some submorph', {
      height: 'fill',
      width: 'fill'
    }]]
  }),
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }]
});`);

    let removedMorph;
    ComponentB.withMetaDo({ reconcileChanges: true }, async () => {
      removedMorph = ComponentB.getSubmorphNamed('some submorph').remove();
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    updatedSource = await getSource();
    expect(ComponentB.layout._resizePolicies.has(removedMorph)).to.be.false;
    expect(updatedSource).includes(`const B = component(A, {
  name: 'B',
  layout: new TilingLayout({}),
  submorphs: [without('some submorph')]
});`);
  });

  it('updates a part ref if its overridden props change', async () => {
    ComponentA.withMetaDo({ reconcileChanges: true }, () => {
      ComponentA.getSubmorphNamed('some ref').borderRadius = 10;
    });
    await ComponentA._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
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
    const updatedSource = await getSource();
    expect(updatedSource.includes('borderWidth: 50') && updatedSource.includes('borderRadius: 25')).to.be.true;
  });

  it('uncollapses submorph hierarchy if a deeply located submorph is modified', async () => {
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.getSubmorphNamed('a deep morph').fill = Color.blue;
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
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

  it('uncollapses a submorph a the PROPER location', async () => {
    ComponentX.withMetaDo({ reconcileChanges: true }, () => {
      ComponentX.getSubmorphNamed('some ref').fill = Color.lively;
      ComponentX.getSubmorphNamed('some submorph').fill = Color.gray;
    });
    await ComponentX._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(updatedSource).to.include(`const X = component(B, {
  name: 'X',
  submorphs: [{
    name: 'some submorph',
    fill: Color.gray
  }, {
    name: 'some ref',
    fill: Color.lively
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
    const updatedSource = await getSource();
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
    ComponentC.layout = new TilingLayout({ spacing: 5, renderViaCSS: false });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(updatedSource).not.to.include('extent: pt(42, 42)');
    expect(updatedSource).not.to.include('position: pt(5, 5)');
  });

  describe('source editor integration', () => {
    let sourceEditor;

    beforeEach(async () => {
      sourceEditor = morph({ type: 'text', textString: initSource, readOnly: false, editorModeName: 'js' });
      await promise.waitFor(1000, () => sourceEditor.editorPlugin);
      const testModuleId = testDir + 'project1/test.cp.js';
      sourceEditor.editorPlugin.evalEnvironment.targetModule = testModuleId;
      sinon.stub(Reconciliation.prototype, 'getEligibleSourceEditors').callsFake((id) => {
        if (id === testModuleId) return [sourceEditor];
        else return [];
      });
    });

    afterEach(() => {
      Reconciliation.prototype.getEligibleSourceEditors.restore();
    });

    it('works properly with associated source editors', async () => {
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
    const updatedSource = await getSource();
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
    const updatedSource = await getSource();
    expect(updatedSource).to.include('submorphs: [without(\'some submorph\')]');
    expect(B.stylePolicy.spec.submorphs[1]).to.eql(without('some submorph'), 'updated style policy object');
  });

  it('discards empty deeply nested nodes if they are no longer needed', async () => {
    let updatedSource = await getSource();
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('a deep morph').addMorph({
        name: 'something superflous',
        visible: false
      });
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    updatedSource = await getSource();
    expect(updatedSource).to.includes('name: \'something superflous\',');
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('something superflous').remove();
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    updatedSource = await getSource();
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
    let updatedSource = await getSource();
    expect(updatedSource).to.include('name: \"molly\"');
    expect(A.stylePolicy.spec.submorphs[1].name).to.eql('molly');
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.addMorph(part(C, { name: 'tbd' }));
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    ComponentB.withMetaDo({ reconcileChanges: true }, () => {
      ComponentB.get('tbd').name = 'final!';
    });
    await ComponentB._changeTracker.onceChangesProcessed();
    updatedSource = await getSource();
    expect(updatedSource).to.include('name: \"final!\"');
  });

  it('properly resolves names by path instead of name', async () => {
    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      const alice = ComponentC.addMorph(part(D, { name: 'alice' }));
      const bob = ComponentC.addMorph(part(D, { name: 'bob' }));
      bob.submorphs[0].borderWidth = 40;
      alice.submorphs[0].borderRadius = 100;
    });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(updatedSource).to.include(`{
      name: 'a deep morph',
      borderWidth: 40
    }`);
    expect(updatedSource).to.include(`{
      name: 'a deep morph',
      borderRadius: 100
    }`);
  });

  it('properly reconciles overridden masters', async () => {
    const alice = part(D, { name: 'alice' });
    alice.master.applyConfiguration({ hover: B });

    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      ComponentC.addMorph(alice);
    });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(updatedSource).to.include(`master: {
      hover: B
    }`);
  });

  it('inserts morphs at the correct position when altering a base def', async () => {
    ComponentC.withMetaDo({ reconcileChanges: true }, () => {
      const alice = ComponentC.addMorph({
        name: 'alice',
        fill: Color.lively
      });
      const bob = ComponentC.addMorph({
        name: 'bob',
        fill: Color.brown
      }, alice);
      const foo = ComponentC.addMorph({
        name: 'foo',
        fill: Color.purple
      }, alice);
      foo.remove();
      ComponentC.addMorph(foo, bob);
    });
    await ComponentC._changeTracker.onceChangesProcessed();
    const updatedSource = await getSource();
    expect(ComponentC.submorphs.map(m => m.name)).eql(['foo', 'bob', 'alice']);
    expect(updatedSource).to.include(`[{
    name: 'foo',
    fill: Color.purple
  }, {
    name: 'bob',
    fill: Color.brown
  }, {
    name: 'alice',
    fill: Color.lively
  }]`);
  });

  describe('text property reconciliation', () => {
    it('reconciles textAndAttributes', async () => {
      ComponentD.withMetaDo({ reconcileChanges: true }, () => {
        const l = ComponentD.addMorph({
          type: Label, name: 'some label'
        });
        l.textAndAttributes = ['Hello World!', null];
      });
      await ComponentD._changeTracker.onceChangesProcessed();
      const updatedSource = await getSource();
      expect(updatedSource).to.include("textAndAttributes: [\'Hello World!\', null]");
    });

    it('correctly replaces other text attributes, in case they are previously present', async () => {
      ComponentT.withMetaDo({ reconcileChanges: true }, () => {
        ComponentT.submorphs[0].textString += 'lol';
        ComponentT.submorphs[1].textString += '\nblubber';
      });
      await ComponentD._changeTracker.onceChangesProcessed();
      const updatedSource = await getSource();
      expect(updatedSource).not.to.include('textString: \'yo bro!blubber\'');
      expect(updatedSource).not.to.include('value: \'hello worldlol\'');
      expect(updatedSource).to.include('textAndAttributes: [\'hello worldlol\', null]');
      expect(updatedSource).to.include('textAndAttributes: [\'yo bro!\\nblubber\', null]');
    });

    it('correctly reconciles text attributes when deleting trailing parts', async () => {
      const m = ComponentT.submorphs[0];
      m.readOnly = false;
      ComponentT.withMetaDo({ reconcileChanges: true }, () => {
        m.textAndAttributes = ['This is the ', null, 'lively.next', {
          fontWeight: '500'
        }, ' impressum.', null];
      });
      await ComponentD._changeTracker.onceChangesProcessed();
      ComponentT.withMetaDo({ reconcileChanges: true }, () => {
        m.deleteText({
          start: { row: 0, column: m.documentEndPosition.column - 1 },
          end: m.documentEndPosition
        });
      });
      await ComponentD._changeTracker.onceChangesProcessed();
      const updatedSource = await getSource();
      expect(updatedSource).to.include(`textAndAttributes: ['This is the ', null, 'lively.next', {
      fontWeight: '500'
    }, ' impressum', null]`);
    });

    it('properly reconciles embedded morphs', async () => {
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.get('some submorph').addMorph({
          name: 'trolly',
          type: 'text',
          textAndAttributes: [
            'Hello World', { fontSize: 20 },
            morph({
              name: 'foo',
              fill: Color.blue
            }), null,
            'How about a component', { fontWeight: 'bold' },
            part(B, { name: 'bar' }), null
          ]
        });
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      let updatedSource = await getSource();
      expect(updatedSource).includes(`['Hello World', {
        fontSize: 20
      }, morph({
        name: 'foo',
        fill: Color.blue
      }), null, 'How about a component', {
        fontWeight: 'bold'
      }, part(B, {
        name: 'bar'
      }), null]`, 'reconciles added plain morphs');
    });

    it('properly reconciles settings text and attributes with morphs', async () => {
      ComponentB.withMetaDo({ reconcileChanges: true }, () => {
        ComponentB.get('some submorph').textAndAttributes = [
          'Hello World', { fontSize: 20 },
          morph({
            name: 'charlie',
            fill: Color.blue
          }), null,
          'How about a component', { fontWeight: 'bold' },
          part(C, { name: 'justin' }), null
        ];
      });
      await ComponentB._changeTracker.onceChangesProcessed();
      let updatedSource = await getSource();
      expect(updatedSource).includes(`['Hello World', {
      fontSize: 20
    }, morph({
      name: 'charlie',
      fill: Color.blue
    }), null, 'How about a component', {
      fontWeight: 'bold'
    }, part(C, {
      name: 'justin'
    }), null]`, 'reconciles embedded morphs if assigned via text and attributes');
    });

    it('properly reconciles insertion and deletions of newlines', async () => {
      const textMorph = ComponentB.get('some submorph');
      textMorph.readOnly = false;
      textMorph.execCommand('insertstring', { string: 'hello' });
      textMorph.execCommand('insertstring', { string: '\n' });
      textMorph.execCommand('insertstring', { string: 'r' });
      textMorph.execCommand('insertstring', { string: '\n' });
      textMorph.execCommand('insertstring', { string: 'o' });

      await ComponentB._changeTracker.onceChangesProcessed();
      let updatedSource = await getSource();
      expect(updatedSource).includes('[\'hello\\nr\\no\', null]', 'newlines are inserted at the correct places in the source');

      textMorph.execCommand('delete backwards');
      textMorph.execCommand('delete backwards');
      await ComponentB._changeTracker.onceChangesProcessed();
      updatedSource = await getSource();
      expect(updatedSource).includes('[\'hello\\nr\', null]', 'newlines are deleted at the correct places in the source');
    });

    it('properly reconciles deletion with DEL key', async () => {
      const textMorph = ComponentT.get('another greeter');
      textMorph.readOnly = false;
      textMorph.cursorPosition = { column: 0, row: 0 };
      textMorph.execCommand('delete');
      await ComponentT._changeTracker.onceChangesProcessed();
      let updatedSource = await getSource();
      expect(updatedSource).includes('\'o bro!\'', 'forward deletion to work');
    });
  });

  describe('updating derived components', () => {
    it('properly propagates structure among derived component definitions', async () => {
    // removing a morph should alter the structure within the derived components accordingly
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.get('some submorph').remove();
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      let updatedSource = await getSource();
      expect(updatedSource).includes(`const A = component({
  name: 'A',
  fill: Color.red,
  extent: pt(100, 100),
  submorphs: [part(D, { name: 'some ref' })]
});`, 'removes morph from root def');

      expect(updatedSource).includes(`const B = component(A, {
  name: 'B'
});`, 'removes morph from derived defs');
      expect(B.stylePolicy.lookForMatchingSpec('some submorph')).to.be.null;
    });

    it('preserves derived component alterations if they are reintroduced', async () => {
    // removing a morph should alter the structure within the derived components accordingly
      let removedMorph;
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        removedMorph = ComponentA.get('some submorph').remove();
      });
      await ComponentA._changeTracker.onceChangesProcessed();

      // adding the same morph back at another location in the component, should preserve the
      // adjustments but at a different location
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.addMorph(removedMorph);
      });

      await ComponentA._changeTracker.onceChangesProcessed();
      let updatedSource = await getSource();

      expect(updatedSource).includes(`const A = component({
  name: 'A',
  fill: Color.red,
  extent: pt(100, 100),
  submorphs: [part(D, { name: 'some ref' }), {
    type: Text,
    name: 'some submorph',
    extent: pt(50, 50),
    fixedWidth: true,
    fixedHeight: true,
    fill: Color.yellow
  }]
});`, 'add morph to root def');

      expect(updatedSource).includes(`const B = component(A, {
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }]
});`, 'reintroduces the previously removed adjustments');
    });

    it('resolves name conflicts for morphs that are added to a definition', async () => {
      let updatedSource;
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.addMorph(morph({ name: 'robin', fill: Color.cyan }));
        ComponentA.addMorph(morph({ name: 'robin', fill: Color.brown }));
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      updatedSource = await getSource();
      expect(updatedSource).includes('name: \'robin_1\'');
      expect(updatedSource).includes('name: \'robin\'');
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.get('robin').remove();
        ComponentA.get('robin_1').remove();
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      ComponentB.withMetaDo({ reconcileChanges: true }, () => {
        ComponentB.addMorph(morph({ name: 'robin', fill: Color.cyan }));
      });
      await ComponentB._changeTracker.onceChangesProcessed();
      ComponentB.withMetaDo({ reconcileChanges: true }, () => {
        ComponentB.addMorph(morph({ name: 'robin', fill: Color.brown }));
      });
      await ComponentB._changeTracker.onceChangesProcessed();
      updatedSource = await getSource();
      expect(updatedSource).includes('name: \'robin_1\'');
      expect(updatedSource).includes('name: \'robin\'');
      // name collisions (by adding a new morph with a name already existing in the derived components)
      // should enforce a renaming of that dropped morph for now. If we run into issues,
      // we will introduce a custom tag attribute that allows designers to refer to morphs
      // with a fixed custom name that is not constrained by any
      ComponentB.withMetaDo({ reconcileChanges: true }, () => {
        ComponentB.get('robin').remove();
        ComponentB.get('robin_1').remove();
        ComponentB.addMorph(morph({ name: 'linus', fill: Color.lively }));
        ComponentA.addMorph(morph({ name: 'linus', fill: Color.green }));
      });
      await ComponentB._changeTracker.onceChangesProcessed();
      updatedSource = await getSource();
      expect(updatedSource).includes(`const B = component(A, {
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }, add({
    name: 'linus',
    fill: Color.lively
  })]
});`, 'insert the add() call for the new morph');

      expect(updatedSource).includes(`const A = component({
  name: 'A',
  fill: Color.red,
  extent: pt(100, 100),
  submorphs: [{
    type: Text,
    name: 'some submorph',
    extent: pt(50, 50),
    fixedWidth: true,
    fixedHeight: true,
    fill: Color.yellow
  }, part(D, { name: 'some ref' }), {
    name: 'linus_1',
    fill: Color.green
  }]
});`, 'inserts a renamed morph to avoid name collision');

      ComponentB.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.addMorph(morph({ name: 'linus', fill: Color.purple }));
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      await ComponentB._changeTracker.onceChangesProcessed();
      updatedSource = await getSource();

      expect(updatedSource).includes(`const A = component({
  name: 'A',
  fill: Color.red,
  extent: pt(100, 100),
  submorphs: [{
    type: Text,
    name: 'some submorph',
    extent: pt(50, 50),
    fixedWidth: true,
    fixedHeight: true,
    fill: Color.yellow
  }, part(D, { name: 'some ref' }), {
    name: 'linus_1',
    fill: Color.green
  }, {
    name: 'linus_2',
    fill: Color.purple
  }]
});`, 'also renames a morph if collision with one of the derived specs is detected');
    });

    it('renames submorphs inside an introduced submorph hierarchy if nessecary', () => {
      let updatedSource, introducedMorph;
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        introducedMorph = ComponentA.addMorph(morph({
          name: 'robin',
          fill: Color.cyan,
          submorphs: [
            { name: 'some ref' }, { name: 'some submorph' }
          ]
        }));
      });
      expect(introducedMorph.get('some ref_1')).not.to.be.null;
      expect(introducedMorph.get('some submorph_1')).not.to.be.null;
    });

    it('renames submorphs that are added to inline policies so that they do no conflict with the inline policy scope', () => {
      let updatedSource, introducedMorph;
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        introducedMorph = ComponentA.addMorph(part(A, {
          submorphs: [add({
            name: 'some ref'
          })]
        }));
      });
      expect(introducedMorph.get('some ref_1')).not.to.be.null;
    });

    it('reintroduces altered versions if the morph has been tempered with between removal and eintroduction', async () => {
    // removing a morph should alter the structure within the derived components accordingly
      let removedMorph;
      ComponentB.withMetaDo({ reconcileChanges: true }, () => {
        ComponentB.get('a deep morph').fill = Color.lively;
      });
      await ComponentB._changeTracker.onceChangesProcessed();
      let updatedSource = await getSource();
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        removedMorph = ComponentA.get('some ref').remove();
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      // clear the morph
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        removedMorph.submorphs[0].remove();
      });
      updatedSource = await getSource();

      // adding the same morph back at another location in the component, should preserve the
      // adjustments but *DROP* the ajustments that have been applied to the now removed morph
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.addMorph(removedMorph);
      });

      await ComponentA._changeTracker.onceChangesProcessed();
      updatedSource = await getSource();

      expect(updatedSource).includes(`const B = component(A, {
  name: 'B',
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }]
});`, 'does not mention the newly introduced submorph');

      expect(updatedSource).includes(`const A = component({
  name: 'A',
  fill: Color.red,
  extent: pt(100, 100),
  submorphs: [{
    type: Text,
    name: 'some submorph',
    extent: pt(50, 50),
    fixedWidth: true,
    fixedHeight: true,
    fill: Color.yellow
  }, part(D, {
    name: 'some ref',
    submorphs: [without('a deep morph')]
  })]
});`, 'inserts adjustments in the reintroduced code');
    });

    it('reflect the propagated changes in any of the open editable components', async () => {
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.get('some submorph').moveBy(pt(20, 20));
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      expect(ComponentB.get('some submorph').position).equals(ComponentA.get('some submorph').position);
      expect(ComponentX.get('some submorph').position).equals(ComponentA.get('some submorph').position);

      let removedMorph;
      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        removedMorph = ComponentA.get('some submorph').remove();
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      expect(ComponentB.get('some submorph')).to.be.null;
      expect(ComponentX.get('some submorph')).to.be.null;

      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.addMorph(removedMorph);
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      expect(ComponentB.get('some submorph')).not.to.be.null;
      expect(ComponentB.get('some submorph').owner).to.equal(ComponentB);
      expect(ComponentX.get('some submorph')).not.to.be.null;
      expect(ComponentX.get('some submorph').owner).to.equal(ComponentX);

      ComponentA.withMetaDo({ reconcileChanges: true }, () => {
        ComponentA.addMorph(morph({ name: 'clippy', type: 'label', textString: 'It looks like your writing a letter!' }));
      });
      await ComponentA._changeTracker.onceChangesProcessed();
      expect(ComponentB.get('clippy')).not.to.be.null;
      expect(ComponentB.submorphs.length).to.equal(3);
      expect(ComponentX.get('clippy')).not.to.be.null;
      expect(ComponentX.submorphs.length).to.equal(3);
      expect(A.stylePolicy.getSubSpecFor('clippy')).not.to.be.null;
      expect(B.stylePolicy.getSubSpecFor('clippy')).not.to.be.null;
      expect(X.stylePolicy.getSubSpecFor('clippy')).not.to.be.null;
    });
  });
});
