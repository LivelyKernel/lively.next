/* global describe, it */
import { expect } from 'mocha-es6';
import { Color, pt } from 'lively.graphics';
import { obj, tree } from 'lively.lang';
import { serialize } from 'lively.serializer2';
import { ComponentDescriptor } from 'lively.morphic';

import { component, ViewModel, without, part, add } from '../components/core.js';
import { StylePolicy, PolicyApplicator } from '../components/policy.js';

/**
 * Retrieve a sub policy embedded within an inline policy.
 * @param { string } name - Name for the sub policy scope.
 * @returns { null | StylePolicy } The inline policy that was found for that name.
 */
function getSubPolicy (policy, name) {
  const res = tree.find(policy.spec, node => {
    if (node.isPolicy) return node.name === name;
    if (node.COMMAND === 'add') return node.props.name === name;
  }, node => node.submorphs);
  if (res && res.COMMAND) return res.props;
  return res;
}

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

const e1 = ComponentDescriptor.abstract(() => component({
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
}), {});

const e2 = ComponentDescriptor.abstract(() => component(e1, {
  name: 'e2',
  fill: Color.yellow,
  extent: pt(50, 50),
  submorphs: [
    {
      name: 'alice',
      fill: Color.black
    },
    {
      name: 'bob',
      master: e1 // DOES NOT INHERIT STRUCTURE!
    },
    add(part(e1, {
      name: 'foo',
      fill: Color.gray,
      submorphs: [{
        name: 'bob',
        fill: Color.green
      }]
    })),
    add({
      name: 'bar',
      borderRadius: 5,
      borderColor: Color.black,
      borderWidth: 2
    })
  ]
}), {});

const e3 = ComponentDescriptor.abstract(() => component(e2, {
  name: 'e3',
  submorphs: [
    {
      name: 'foo', extent: pt(10, 10) // additional overridden prop
    },
    add(part(e2, {
      name: 'molly',
      position: pt(45, 45)
    }))
  ]
}));

describe('spec based components', () => {
  it('inline policies can be converted to build specs', () => {
    let inline1, inline2;
    const internalSpec = new StylePolicy({ // should this itself be an inline policy???
      name: 'e2',
      fill: Color.yellow,
      extent: pt(50, 50),
      submorphs: [
        { name: 'alice', fill: Color.black },
        inline2 = new StylePolicy({ name: 'bob' }, e1, false),
        {
          COMMAND: 'add',
          props: inline1 = new StylePolicy({
            name: 'foo',
            fill: Color.gray,
            submorphs: [{ name: 'bob', fill: Color.green }]

          }, e1),
          before: null
        },
        {
          COMMAND: 'add',
          props: {
            name: 'bar',
            borderRadius: 5,
            borderColor: Color.black,
            borderWidth: 2
          },
          before: null
        }
      ]
    }, e1);

    const expectedBuildSpec = {
      name: 'e2',
      master: internalSpec, // in this case
      submorphs: [
        {
          name: 'alice',
          // structural properties need to be carried over, since they are not
          // propagated by the policies themselves. There are multiple issues with
          // propagating structural changes which is why it is not enabled as
          // of now. However we may want to experiment with (optional) structural
          // propagation in the future.
          type: 'text',
          textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
        },
        { name: 'bob', master: inline2 },
        {
          name: 'foo',
          master: inline1,
          submorphs: [
            {
              name: 'alice',
              type: 'text',
              textAndAttributes: [
                'hello', { fontWeight: 'bold' },
                'world', { fontStyle: 'italic' }
              ]
            },
            {
              name: 'bob'
            }
          ]
        },
        { name: 'bar' }
      ]
    };
    // FIXME: That contains now policy applicators instead of inline policy refs
    expect(internalSpec.getBuildSpec()).to.eql(expectedBuildSpec);
    expect(e2.stylePolicy.getBuildSpec()).to.eql(expectedBuildSpec); // structurally they should be the same...
  });

  it('inline policies can be converted to master build specs', () => {
    const internalSpec = new StylePolicy({ // should this itself be an inline policy???
      fill: Color.yellow,
      extent: pt(50, 50),
      name: 'e2',
      submorphs: [
        {
          name: 'alice',
          fill: Color.black,
          type: 'text',
          textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
        },
        // ensure there is no structural inheritance though, since bob did not
        // get derived from e1. The key difference here is that bob was not added
        // so this subspec has to be taken as is. As is means, that since the parent
        // is a top level component we have to accept the structure as is.
        new StylePolicy({ name: 'bob' }, e1, false), // flag for prevent structural inheritance from parent.
        {
          COMMAND: 'add',
          props: new StylePolicy({
            name: 'foo',
            // what if the master itself is overridden?
            // basically: master: newMaster, or: master: { auto: ..., hover .... } etc... 
            // this will also clear the parent policy (parent: null), 
            // and collapse all the overridden props in the chain
            // which will add them to overriddenProps.
            // Essentially, we need to replicate the overridden props adoption
            // when applying new masters to a morph that was previously styled via
            // inline policies within the spec definition here.
            // Ideally, we would want that to be the same piece of code. So we would
            // like the same kind of object to play a role here when working with morphs
            // as well as specs.
            // This can done via the InlinePolicies themselves, like so:
            // existingInlinePolicy.overriden(new InlinePolicy({
            //  parent: null,
            //  master: OverriddenMaster,
            //  fill: Color.gray,
            //  submorphs: [{ name: 'bob', fill: Color.green }]
            // }))
            fill: Color.gray,
            submorphs: [{ name: 'bob', fill: Color.green }]
          }, e1),
          before: null
        },
        {
          COMMAND: 'add',
          props: {
            name: 'bar',
            borderRadius: 5,
            borderColor: Color.black,
            borderWidth: 2
          },
          before: null
        }
      ]
    }, e1);

    const expectedMasterBuildSpec = {
      fill: Color.yellow,
      name: 'e2',
      extent: pt(50, 50),
      submorphs: [
        {
          name: 'alice',
          type: 'text',
          fill: Color.black,
          textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
        },
        { name: 'bob', submorphs: [], master: e1.stylePolicy }, // the master will in turn apply itself on the morph and its generated hierarchy... this is part of the master itself and should not be replicated by the synthesized spec itself. It would be redundand!
        {
          name: 'foo',
          master: e1.stylePolicy, // this points to the inline property within the synthesized spec. if the parent was again an inline policy, we do not need the master as a prop here
          fill: Color.gray,
          submorphs: [
            { name: 'alice', type: 'text', textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }] },
            { name: 'bob', fill: Color.green }
          ]
        },
        {
          name: 'bar',
          borderRadius: 5,
          borderColor: Color.black,
          borderWidth: 2
        }
      ]
    };

    expect(internalSpec.getEditSpec()).to.eql(expectedMasterBuildSpec);
    expect(e2.stylePolicy.getEditSpec()).to.eql(expectedMasterBuildSpec);
  });

  it('properly synthesizes style policies', () => {
    expect(e2.stylePolicy.synthesizeSubSpec('bar')).to.eql({
      name: 'bar',
      borderRadius: 5,
      borderColor: Color.black,
      borderWidth: 2
    });
    expect(e2.stylePolicy.synthesizeSubSpec('foo')).to.eql(new StylePolicy({
      name: 'foo',
      fill: Color.gray,
      submorphs: [{ name: 'bob', fill: Color.green }]
    }, e1));
    expect(e3.stylePolicy.synthesizeSubSpec('alice')).to.eql({
      name: 'alice',
      fill: Color.black,
      type: 'text',
      textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
    });
  });

  it('creates properly collapsed overridden properties when master of inline policy gets overridden', () => {
    const c = ComponentDescriptor.abstract(() => component(e2, {
      name: 'c',
      submorphs: [
        { name: 'foo', master: e2 } // causes the collapse of the overridden props of the inline policy of foo
      ]
    }), {});
    const expectedInternalSpecC = new StylePolicy({
      name: 'c',
      submorphs: [
        // ad hoc initialized inline policy that is driect descendant of e2
        // and carries over the overridden props that were previously accounted for
        // for the submorph hierarchy of foo
        new StylePolicy({
          name: 'foo', // crucial in order to figure out the binding where this policy belongs to
          master: e2
        }, e2.stylePolicy.getSubSpecFor('foo'), true)
      ]
    }, e2);

    expect(c.stylePolicy).to.eql(expectedInternalSpecC);
    expect(c.stylePolicy.synthesizeSubSpec('foo')).to.eql(new StylePolicy({
      name: 'foo',
      master: e2
    }, e2.stylePolicy.getSubSpecFor('foo'), true));

    const d = ComponentDescriptor.abstract(() => component(e3, {
      name: 'd',
      submorphs: [
        { name: 'foo', master: e3 }, // causes the collapse of the overridden props of the inline policy of foo
        { name: 'molly', master: e1, opacity: 0.5 } // causes the collapse of the overridden props of the inline policy of molly
      ]
    }));

    const expectedInternalSpecD = new StylePolicy({
      name: 'd',
      submorphs: [
        // ad hoc initialized inline policy that is driect descendant of e2
        // and carries over the overridden props that were previously accounted for
        // for the submorph hierarchy of foo
        new StylePolicy({
          name: 'foo', // crucial in order to figure out the binding where this policy belongs to
          master: e3
        }, e3.stylePolicy.synthesizeSubSpec('foo')),
        new StylePolicy({
          // FIXME: how to we keep the info that all of this is just the result of collapsing
          //       the style policy? This will be needed for proper reconciliation.
          name: 'molly', // crucial in order to figure out the binding where this policy belongs to
          master: e1,
          opacity: 0.5
        }, e3.stylePolicy.synthesizeSubSpec('molly'))
      ]
    }, e3);

    expect(d.stylePolicy).to.eql(expectedInternalSpecD);
    expect(d.stylePolicy.synthesizeSubSpec('foo').synthesizeSubSpec(null)).to.eql({
      name: 'foo',
      fill: Color.gray,
      extent: pt(10, 10)
    });
    expect(d.stylePolicy.synthesizeSubSpec('molly').synthesizeSubSpec(null)).to.eql({
      name: 'molly',
      opacity: 0.5,
      position: pt(45, 45),
      fill: Color.red
    });
  });

  it('removes morphs if declared as such', () => {
    const c = ComponentDescriptor.abstract(() => component(e2, {
      name: 'c',
      submorphs: [
        without('alice')
      ]
    }), {});

    const expectedInternalSpec = new StylePolicy({
      name: 'c',
      submorphs: [
        {
          COMMAND: 'remove',
          target: 'alice'
        }
      ]
    }, e2);

    const expectedBuildSpec = {
      name: 'c',
      master: expectedInternalSpec,
      submorphs: [
        { name: 'bob', master: getSubPolicy(expectedInternalSpec.parent, 'bob') }, // how do we get the proper inline policies?
        {
          name: 'foo',
          master: getSubPolicy(expectedInternalSpec.parent, 'foo'),
          submorphs: [
            { name: 'alice', type: 'text', textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }] },
            { name: 'bob' }
          ]
        },
        {
          name: 'bar'
        }
      ]
    };

    expect(c.stylePolicy).to.eql(expectedInternalSpec);
    expect(c.stylePolicy.getBuildSpec()).to.eql(expectedBuildSpec);
  });

  describe('policy applicators', () => {
    it('can be applied to a morph', () => {
      const m = part(e1);
      const e2Policy = PolicyApplicator.for(e2);
      // completely whipes the appearance, since there is no collapse of overridden props!
      e2Policy.apply(m, true);
      expect(m.fill).to.equal(Color.yellow);
      expect(m.get('bob').fill).to.equal(Color.red);
    });

    it('fully prepares all masters to be policy applicators in build spec', () => {
      // master policies can wrap inline policies, traverse the spec
      // structure and then in turn generate a master policy spec
      // that can be applied to a morph hierarchy, that is each of these
      // policies are directly placed into the morphs in a hierarchy
      // after which the application of the policies can concurr.
      const e2Policy = PolicyApplicator.for(e2);
      const spec = e2Policy.getBuildSpec();
      expect(spec.master).to.be.instanceof(PolicyApplicator);
      expect(spec.submorphs[1].master).to.be.instanceof(PolicyApplicator);
    });

    it('reassigns policy applicators in the hierarchy, once applied', () => {
      const m = part(e1);
      const e2Policy = PolicyApplicator.for(e2);
      expect(m.get('bob').master).to.be.undefined;
      e2Policy.apply(m, true);
      expect(m.get('bob').master).not.to.be.undefined;
      expect(m.get('bob').master).to.equal(e2Policy.spec.submorphs[1]);
      expect(m.master).not.to.equal(e2Policy, 'does not set the root master automatically');
    });

    it('updates the specs of the directly attached component policies on change', () => {
      // FIXME: We still do not assign the proper policy objects onto the morphs
      //        They currently are still ComponentPolicies, however they should become
      //        the same as the inline policies!
      const m = part(e2); // still using the old approach...
      m.master = PolicyApplicator.for(e2);
      m.get('bob').position = pt(40, 40);
      m.get('bob').extent = pt(100, 100);
      m.get('bar').position = pt(25, 25);
      expect(m.get('bob').master.spec.position).to.equal(pt(40, 40));
      expect(m.get('bob').master.spec.extent).to.equal(pt(100, 100));
      expect(m.master.spec.submorphs[3].position).to.equal(pt(25, 25));
    });
  });
});

const d1 = component({ name: 'd1', fill: Color.purple });
const d2 = component({ mame: 'd2', fill: Color.black });
const c1 = component({
  name: 'c1',
  fill: Color.red
});
const c2 = component({
  name: 'c2',
  defaultViewModel: TestViewModel,
  fill: Color.green,
  submorphs: [part(c1, {
    name: 'alice',
    borderColorTop: Color.red,
    submorphs: [add(part(d1, { name: 'bob' }))]
  })]
});
const d3 = component(c2, {
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
const c3 = component({
  name: 'c3',
  fill: Color.orange,
  submorphs: [part(c2, {
    name: 'foo',
    submorphs: [{ name: 'alice', master: d2 }]
  })]
});
const c4 = component(c3, {
  name: 'c4',
  submorphs: [
    { name: 'foo', master: d3 }
  ]
});

describe('components', () => {
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

    expect(A.getComponent().master._overriddenProps.get(A.getComponent())).to.eql({
      fill: true, borderWidth: true, borderRadius: true
    });

    expect(B.getComponent().master._overriddenProps.get(B.getComponent())).to.eql({
      fill: true, borderWidth: true
    });
  });

  it('properly adheres to overridden masters', () => {
    const inst3 = part(c3);
    const alice = inst3.getSubmorphNamed('alice');
    const foo = inst3.getSubmorphNamed('foo');
    const masterAlice = c3.getComponent().getSubmorphNamed('alice');
    const masterFoo = c3.getComponent().getSubmorphNamed('foo');

    // check if master component overridden props match
    expect(masterAlice.master._appliedMaster).to.equal(d2.getComponent());
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
    expect(foo.master.auto).to.equal(c4.getComponent().get('foo').master, 'policy of foo is applied');
    expect(alice.master.auto).to.equal(c4.getComponent().get('alice').master, 'policy of alice is applied');

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
    const bc = b.getComponent();
    const inst = part(b);
    expect(bc.get('bob').master._overriddenProps.get(bc.get('bob'))).to.eql({ master: true });
    expect(inst.get('bob').master.auto).to.equal(bc.get('bob').master);
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
    const t1c = t1.getComponent();
    expect(t1c.master.derivedMorph).not.to.be.undefined;
    expect(t1c.get('bob').master).not.to.be.undefined;
    expect(t1c.get('bob').master._overriddenProps.get(t1c.get('bob')).fill).to.be.true;
    const inst = part(c2, { name: 'troller', master: t1 }); // now we protocol the overridden props within the t1 hierarchy, but these adjusted masters are not yet carried over. Again, we need to mark the master components as "altered" so that the traversal of the master component hierarchy happens further and also reaches down to the bob morph. If this info is not saved within the components directly, the policies have no way of knowing they have to further traverse the hierarchy.
    expect(inst.get('alice').master.managesMorph(inst.get('bob'))).to.be.true;
    expect(inst.get('alice').master.auto).to.eql(t1c.get('alice').master);
    expect(inst.master.auto, 'correctly overrides top level master').to.eql(t1);
    expect(inst.get('bob').master.auto, 'preserves the masters that have not been altered').to.eql(t1c.get('bob').master); // the inline overridden property in the master needs to take precedence here
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

    expect(t1.getComponent().get('bob').master.auto).equals(d1);
  });

  it('serializes inline properties to symbolic expressions', () => {
    const inst = part(TLB);
    const snap = serialize(inst);
    expect(snap.snapshot[snap.snapshot[inst.get('alice').id].props.master.value.id].props.auto.value).to.include('(TLB.isComponentDescriptor ? TLB.getComponent() : TLB).get("alice").master');
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
