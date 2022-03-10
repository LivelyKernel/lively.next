/* global describe, it, beforeEach, xit */
import { expect } from 'mocha-es6';
import { component, ViewModel, without, part, add } from '../components/core.js';
import { Color } from 'lively.graphics';
import { obj } from 'lively.lang';
import { serialize } from 'lively.serializer2';

let c1, c2, c3, c4, d1, d2, d3;

const TLA = component({
  name: 'tla',
  fill: Color.orange,
  submorphs: [
    { name: 'alice', fill: Color.yellow }
  ]
});

const TLB = component(TLA, {
  name: 'tlb',
  fill: Color.green,
  submorphs: [
    { name: 'alice', master: TLA }
  ]
});

class TestViewModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { target: 'alice', signal: 'onMouseDown', handler: 'foo' }
          ];
        }
      }
    };
  }

  foo () {
    // something
  }
}

describe('components', () => {
  beforeEach(() => {
    d1 = component({ name: 'd1', fill: Color.purple });
    d2 = component({ mame: 'd2', fill: Color.black });
    c1 = component({
      name: 'c1',
      fill: Color.red
    });
    c2 = component({
      name: 'c2',
      defaultViewModel: TestViewModel,
      fill: Color.green,
      submorphs: [part(c1, {
        name: 'alice',
        borderColorTop: Color.red,
        submorphs: [add(part(d1, { name: 'bob' }))]
      })]
    });
    d3 = component(c2, {
      name: 'd3',
      fill: Color.cyan,
      submorphs: [
        {
          name: 'alice', 
          borderRadiusTopLeft: 42,
          master: d1 
        }
      ] 
    });
    c3 = component({
      name: 'c3',
      fill: Color.orange,
      submorphs: [part(c2, {
        name: 'foo',
        submorphs: [{ name: 'alice', master: d2 }]
      })] 
    });
    c4 = component(c3, {
      name: 'c4',
      submorphs: [
        { name: 'foo', master: d3 }
      ]  
    });
  });
  
  it('prevents accumulation of overridden props', () => {
    // let's create a couple of derived components from c1
    const A = component(c1, {
      fill: Color.green,
      borderWidth: 5,
      borderRadius: 10
    });
    
    const B = component(A, {
      fill: Color.orange,
      borderWidth: 0
    });

    expect(A.master._overriddenProps.get(A)).to.eql({
      fill: true, borderWidth: true, borderRadius: true
    });

    expect(B.master._overriddenProps.get(B)).to.eql({
      fill: true, borderWidth: true
    });
  });
  
  it('properly adheres to overridden masters', () => {
    const inst3 = part(c3);
    const alice = inst3.getSubmorphNamed('alice');
    const foo = inst3.getSubmorphNamed('foo');
    const masterAlice = c3.getSubmorphNamed('alice');
    const masterFoo = c3.getSubmorphNamed('foo');

    // check if master component overridden props match
    expect(masterAlice.master._appliedMaster).to.equal(d2);
    expect(masterFoo.master._overriddenProps.get(masterAlice)).to.eql({ master: true });
    // check if overridden props in part match
    alice.master.applyIfNeeded(true);
    expect(alice.master._appliedMaster).to.equal(masterAlice.master);
    expect(alice.master._overriddenProps.get(alice)).to.eql({});
    
    expect(foo.master._overriddenProps.get(alice)).to.eql({});

    // check the appearance is according to the expectation
    expect(alice.fill).to.equal(Color.black);
  });

  it('properly applies overridden masters', async () => {
    const inst4 = part(c4);
    const alice = inst4.getSubmorphNamed('alice');
    const foo = inst4.getSubmorphNamed('foo');
    expect(foo.master.auto).to.equal(c4.get('foo').master, 'policy of foo is applied');
    expect(alice.master.auto).to.equal(c4.get('alice').master, 'policy of alice is applied');

    expect(foo.master._overriddenProps.get(foo)).to.eql({}); // all overridden stuff is kept in the inline policies
    expect(foo.master._overriddenProps.get(alice)).to.eql({});
    expect(alice.master._overriddenProps.get(alice)).to.eql({});
  });

  it('does not create superflous overridden props', () => {
    const b = component(c2, {
      submorphs: [
        {
          name: 'alice',
          submorphs: [
            {
              name: 'bob',
              master: d2 
            }
          ]
        }
      ]
    });
    const inst = part(b);
    expect(b.get('bob').master._overriddenProps.get(b.get('bob'))).to.eql({ master: true });
    expect(inst.get('bob').master.auto).to.equal(b.get('bob').master);
    expect(inst.get('bob').master._overriddenProps.get(inst.get('bob'))).to.eql({});
    expect(inst.get('alice').master._overriddenProps.get(inst.get('bob'))).to.eql({});
  });

  it('does honor overridden props in case of nested masters when manually applied to different hierarchy', () => {
    const t1 = component(c2, {
      master: d3,
      name: 't1',
      submorphs: [
        {
          name: 'alice',
          submorphs: [{
            name: 'bob',
            fill: Color.red // this overridden property needs to be considered when the policy attached to bob is applied to the new hierarchy
          }]
        }
      ]
    });
    expect(t1.master.derivedMorph).not.to.be.undefined;
    expect(t1.get('bob').master).not.to.be.undefined;
    expect(t1.get('bob').master._overriddenProps.get(t1.get('bob')).fill).to.be.true;
    const inst = part(c2, { name: 'troller', master: t1 }); // now we protocol the overridden props within the t1 hierarchy, but these adjusted masters are not yet carried over. Again, we need to mark the master components as "altered" so that the traversal of the master component hierarchy happens further and also reaches down to the bob morph. If this info is not saved within the components directly, the policies have no way of knowing they have to further traverse the hierarchy.
    expect(inst.get('alice').master.managesMorph(inst.get('bob'))).to.be.true; 
    expect(inst.get('alice').master.auto).to.eql(t1.get('alice').master);
    expect(inst.master.auto, 'correctly overrides top level master').to.eql(t1);
    expect(inst.get('bob').master.auto, 'preserves the masters that have not been altered').to.eql(t1.get('bob').master); // the inline overridden property in the master needs to take precedence here
    expect(inst.get('bob').fill, 'styles the morphs according to the overridden properties').equals(Color.red);
  });

  it('preserves all overridden properties on reset of policy up to top level master', async () => {
    const c = part(d3);
    expect(c.get('alice').fill).to.equal(Color.purple);
    expect(c.get('alice').borderColorTop).to.equal(Color.red);
    expect(c.get('alice').borderRadiusTopLeft).to.equal(42);
    expect(c.get('alice').master.isPolicy).to.be.true;
    expect(obj.keys(c.get('alice').master._overriddenProps.get(c.get('alice')))).to.equal([], 'expect overridden props not to be local');
    c.get('alice').master = d2;
    c.get('alice').master.applyIfNeeded(true);
    await c.get('alice').master.whenApplied();
    expect(c.get('alice').fill).to.equal(Color.black);
    expect(c.get('alice').borderColorTop).to.equal(Color.red, 'border color keeps being overridden');
    expect(c.get('alice').borderRadiusTopLeft).to.equal(42, 'border radius keeps being overridden');
  });

  it('does not enforce masters on newly introduced morphs with a different master', () => {
    const t1 = component(c2, {
      name: 't1',
      submorphs: [
        {
          name: 'alice',
          submorphs: [without('bob')]
        },
        add({
          name: 'bob',
          master: d1
        })
      ]
    });

    expect(t1.get('bob').master.auto).equals(d1);
  });

  it('serializes inline properties to symbolic expressions', () => {
    const inst = part(TLB);
    const snap = serialize(inst);
    expect(snap.snapshot[snap.snapshot[inst.get('alice').id].props.master.value.id].props.auto.value).to.include('TLB.get("alice").master');
  });

  it('does not serialize bindings but reconstructs them reliably', () => {
    // instantiate a component with a view model and ensure that the
    // bindings are not put into the snapshot
    const inst = part(c2);
    expect(inst.viewModel).not.to.be.undefined;
    expect(inst.get('alice').attributeConnections).not.to.be.undefined;
    const snap = serialize(inst);
    expect(snap.snapshot[inst.get('alice').id].props.attributeConnections).to.eql({ value: [] });
  });

  it('includes added morphs into inline policies', () => {
    const t1 = component(c2, {
      name: 't1',
      submorphs: [
        {
          name: 'alice',
          submorphs: [without('bob')]
        },
        add({
          name: 'bob',
          master: d1
        })
      ]
    });
    const inst = part(t1);
    expect(inst.master.managesMorph(inst.get('bob'))).to.be.true;
  });

  it('does not accidentally create overridden masters when serializing', () => {
    const inst = part(TLB);
    const instOverridden = part(TLB, {
      submorphs: [
        { name: 'alice', master: TLB }
      ]
    });
    inst.master.applyIfNeeded(true);
    instOverridden.master.applyIfNeeded(true);
    const copied = inst.copy();
    const copied2 = instOverridden.copy();
    copied.master.applyIfNeeded(true);
    copied2.master.applyIfNeeded(true);
    expect(inst.master._overriddenProps.get(inst)).to.eql({});
    expect(copied.master._overriddenProps.get(copied)).to.eql({});
    expect(instOverridden.master._overriddenProps.get(instOverridden.get('alice'))).to.eql({ master: true });
    expect(copied2.master._overriddenProps.get(copied2.get('alice'))).to.eql({ master: true });
  });
});
