/* global describe, it */
import { expect } from 'mocha-es6';
import { ComponentDescriptor, part, add, component } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { InteractiveComponentDescriptor } from '../components/editor.js';

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
    add({ name: 'bar', borderRadius: 5, borderColor: Color.black, borderWidth: 2 })
  ]
});

component.DescriptorClass = ComponentDescriptor;

describe('component definition reconciliation', () => {
  it('allows to create a component proxy for editing the spec', async () => {
    // define an ad hoc component
    const c = await e2.edit(); // => returns a component morph from the spec that is auto mapping changes to the spec
    c.get('alice').fill = Color.green;
    expect(e2.stylePolicy.getSubSpecFor('alice').fill).to.eql(Color.green);
  });

  it('allows to reify source code based on changes applied to its spec', () => {
    expect(e1.getSourceCode()).to.equal(`component({
  name: 'e1',
  fill: Color.red,
  submorphs: [
    { 
      name: 'alice',
      fill: Color.blue,
      textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
    },
    { name: 'bob', fill: Color.orange }
  ]
})`);
    e1.stylePolicy.getSubSpecFor('alice').fill = Color.magenta;
    e1.stylePolicy.getSubSpecFor('alice').position = pt(100, 100);
    expect(e1.getSourceCode()).to.equal(`component({
  name: 'e1',
  fill: Color.red,
  submorphs: [
    {
      name: 'alice',
      fill: Color.magenta,
      position: pt(100,100),
      textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
    },
    { name: 'bob', fill: Color.orange }
  ]
})`);
  });

  it('allows to instantiate a morph from the spec', () => {
    const m = part(e1);
    expect(m.master.parent).equals(e1.stylePolicy); // better to reference the descritptor instead of the policy for auto update mechanism when components are directly manipulated or rewritten via codee.
  });
});
