/* global afterEach, describe, it */
import { expect } from 'mocha-es6';
import { ComponentDescriptor, morph, part, add, component } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { createInitialComponentDefinition, ensureComponentNamesInSource } from '../../components/component-definition.js';
import { ProjectionalReconciliationUnsupportedError } from '../../components/change-tracker.js';
import { releaseComponentEditingState } from './test-isolation.js';

const prevDescr = component.DescriptorClass;
component.DescriptorClass = InteractiveComponentDescriptor;

const e1 = component({
  name: 'e1',
  fill: Color.red,
  submorphs: [
    {
      name: 'alice',
      type: 'text',
      fill: Color.blue,
      textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
    },
    { name: 'bob', fill: Color.orange }
  ]
});

const e2 = component(e1, {
  name: 'e2',
  fill: Color.yellow,
  submorphs: [
    {
      name: 'alice',
      fill: Color.black
    },
    { name: 'bob', master: e1 },
    add(part(e1, { name: 'foo', fill: Color.gray, submorphs: [{ name: 'bob', fill: Color.green }] })),
    add({
      name: 'bar',
      borderRadius: 5,
      borderColor: Color.black,
      borderWidth: 2,
      submorphs: [part(e1, {
        name: 'moppel'
      })]
    })
  ]
});

component.DescriptorClass = prevDescr || ComponentDescriptor;

describe('component definition editing', () => {
  releaseComponentEditingState();
  afterEach(() => e2.stopEditSession());

  it('T9 names additions when their inherited anchor has no own spec', () => {
    const source = `const Example = component(Base, {
      name: 'example', submorphs: [add({ fill: 'red' }, 'button')]
    });`;
    const start = source.indexOf("{ fill: 'red' }");
    const policySpec = { name: 'example', submorphs: [
      { COMMAND: 'add', props: { name: 'generated', fill: 'red' }, before: 'button' }
    ] };
    const updated = ensureComponentNamesInSource(source, 'Example', policySpec,
      [{ start, end: start + "{ fill: 'red' }".length }]);
    expect(updated).includes(`add({ name: "generated", fill: 'red' }, 'button')`);
  });

  it('component proxy includes added morphs', async () => {
    const c = await e2.edit();
    expect(c.get('moppel')).not.to.be.null;
  });

  it('rejects source-less proxy edits without mutating component policy', async () => {
    const c = await e2.edit();
    // Every editable session must have source; losing it is an internal bug.
    const tracker = c._changeTracker;
    const componentModule = tracker.componentModule;
    const aliceFill = c.get('alice').fill;
    const fill = c.fill;
    const world = c.world;
    const logged = [];
    c.world = () => ({ showError: () => {}, logError: error => logged.push(error) });
    try {
      tracker.componentModule = null;
      c.withMetaDo({ reconcileChanges: true }, () => {
        c.get('alice').fill = Color.green;
        c.fill = Color.purple;
      });
      const error = await tracker.onceChangesProcessed().catch(error => error);
      expect(error).to.be.instanceOf(ProjectionalReconciliationUnsupportedError);
      expect(error.message).includes('bug');
      expect(logged).has.length(1);
      expect(logged[0].stack).includes(error.message);
      expect(c.get('alice').fill).equals(aliceFill);
      expect(c.fill).equals(fill);
      expect(e2.stylePolicy.getSubSpecFor('alice').fill).to.eql(Color.black);
      expect(e2.stylePolicy.spec.fill).to.eql(Color.yellow);
    } finally {
      tracker.componentModule = componentModule;
      c.world = world;
    }
  });

  it('allows to reify source code based on changes applied to its spec', () => {
    expect(e1.getSourceCode()).to.equal(`component({
  name: 'e1',
  fill: Color.red,
  submorphs: [{
    type: Text,
    name: 'alice',
    fill: Color.blue,
    textAndAttributes: ['hello', {
      fontWeight: 'bold'
    }, 'world', {
      fontStyle: 'italic'
    }]
  }, {
    name: 'bob',
    fill: Color.orange
  }]
});
`);
    e1.stylePolicy.getSubSpecFor('alice').fill = Color.magenta;
    e1.stylePolicy.getSubSpecFor('alice').position = pt(100, 100);
    expect(e1.getSourceCode()).to.equal(`component({
  name: 'e1',
  fill: Color.red,
  submorphs: [{
    type: Text,
    name: 'alice',
    fill: Color.magenta,
    position: pt(100, 100),
    textAndAttributes: ['hello', {
      fontWeight: 'bold'
    }, 'world', {
      fontStyle: 'italic'
    }]
  }, {
    name: 'bob',
    fill: Color.orange
  }]
});
`);
  });

  it('allows to instantiate a morph from the spec', () => {
    const m = part(e1);
    expect(m.master.parent).equals(e1.stylePolicy); // better to reference the descritptor instead of the policy for auto update mechanism when components are directly manipulated or rewritten via codee.
  });

  it('allows to create a new component definition from a derived morph', () => {
    const e3 = part(e1, { name: 'new component' });
    expect(createInitialComponentDefinition(e3)).to.eql(`component(e1, {
  name: 'new component'
})`);
  });

  it('allows to create a new component definition from a derived morph with added parts', () => {
    const e3 = part(e1, { name: 'new component' });
    e3.addMorph(part(e2, { name: 'added' }));
    const e4 = morph({ name: 'other new', submorphs: [part(e2, { name: 'added' }), { name: 'foo', fill: Color.lively }] });
    expect(createInitialComponentDefinition(e3)).to.eql(`component(e1, {
  name: 'new component',
  submorphs: [add(part(e2, {
  name: 'added'
}))]
})`);
    expect(createInitialComponentDefinition(e4)).to.eql(`component({
  name: 'other new',
  submorphs: [part(e2, {
  name: 'added'
}), {
  name: 'foo',
  fill: Color.lively
}]
})`);
  });
});
