/* global xit */
/* global describe, it , afterEach */
import { expect } from 'mocha-es6';
import { Color, pt } from 'lively.graphics';
import { tree, grid } from 'lively.lang';
import { serialize } from 'lively.serializer2';
import { ComponentDescriptor, morph } from 'lively.morphic';

import { component, ViewModel, without, part, add } from '../components/core.js';
import { StylePolicy, BreakpointStore, PolicyApplicator } from '../components/policy.js';

const moduleId = import.meta.url.replace(System.baseURL, '');

function edit (componentDescriptor) {
  return morph(componentDescriptor.stylePolicy.asBuildSpec());
}

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

function detach (descriptorOrPolicy) {
  if (descriptorOrPolicy.isComponentDescriptor) descriptorOrPolicy = descriptorOrPolicy.stylePolicy;
  delete descriptorOrPolicy.targetMorph;
  tree.mapTree(descriptorOrPolicy.spec, (node) => {
    if (node.COMMAND === 'add') node = node.props;
    if (node.isPolicy) detach(node);
    return node;
  }, node => node.submorphs);
}

const TLA = ComponentDescriptor.for(() => component({
  name: 'tla',
  fill: Color.orange,
  submorphs: [
    { name: 'alice', fill: Color.yellow }
  ]
}), {
  exportedName: 'TLA',
  moduleId
});

const TLB = ComponentDescriptor.for(() => component(TLA, {
  name: 'tlb',
  fill: Color.green,
  submorphs: [
    { name: 'alice', master: TLA }
  ]
}), {
  exportedName: 'TLB',
  moduleId
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

const e1 = ComponentDescriptor.for(() => component({
  name: 'e1',
  fill: Color.red,
  submorphs: [
    {
      name: 'alice',
      type: 'text',
      fill: Color.blue,
      textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
    },
    { name: 'bob', fill: Color.orange, submorphs: [{ name: 'lolly', fill: Color.pink }] }
  ]
}), {
  exportedName: 'e1',
  moduleId
});

const e2 = ComponentDescriptor.for(() => component(e1, {
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
      master: e1 // assign master to submorph that was previously not derived from component at all!
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
}), {
  exportedName: 'e2',
  moduleId
});

const e3 = ComponentDescriptor.for(() => component(e2, {
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
}), {
  exportedName: 'e3',
  moduleId
});

const d1 = ComponentDescriptor.for(() => component({ name: 'd1', fill: Color.purple, opacity: 0.5 }), {
  exportedName: 'd1',
  moduleId
});
const d2 = ComponentDescriptor.for(() => component({ name: 'd2', fill: Color.black }));
const c1 = ComponentDescriptor.for(() => component({
  name: 'c1',
  fill: Color.red
}), {
  exportedName: 'c1',
  moduleId
});

const c2 = ComponentDescriptor.for(() => component({
  name: 'c2',
  defaultViewModel: TestViewModel,
  fill: Color.green,
  submorphs: [part(c1, {
    name: 'alice',
    borderColorTop: Color.red,
    submorphs: [add(part(d1, { name: 'bob' }))]
  })]
}), {
  exportedName: 'c2',
  moduleId
});

const d3 = ComponentDescriptor.for(() => component(c2, {
  name: 'd3',
  fill: Color.cyan,
  submorphs: [
    {
      name: 'alice',
      borderRadiusTopLeft: 42,
      master: d1
    }
  ]
}));

const c3 = ComponentDescriptor.for(() => component({
  name: 'c3',
  fill: Color.orange,
  submorphs: [part(c2, {
    name: 'foo',
    submorphs: [{ name: 'alice', master: d2 }]
  })]
}));
const c4 = ComponentDescriptor.for(() => component(c3, {
  name: 'c4',
  submorphs: [
    { name: 'foo', master: d3 }
  ]
}));

const c5 = ComponentDescriptor.for(() => component({
  type: 'text',
  name: 'c5',
  needsDocument: true,
  submorphs: [
    part(c4, { name: 'lively', fill: Color.lively })
  ],
  textAndAttributes: [
    'Something: ', {},
    part(c4, { name: 'holly' }), null,
    'or: ', null,
    morph({ name: 'wood', fill: Color.orange }), null
  ]
}));

const c6 = ComponentDescriptor.for(() => component(c5, {
  name: 'c6',
  needsDocument: true,
  textAndAttributes: [
    'Something: ', {},
    {
      name: 'holly',
      fill: Color.red,
      submorphs: [{
        name: 'foo',
        submorphs: [{
          name: 'alice',
          fill: Color.lively
        }]
      }]
    }, null,
    'or: ', null,
    { name: 'wood', fill: Color.blue }, null
  ]
}));

describe('spec based components', () => {
  afterEach(() => {
    detach(e2);
  });

  it('specs are always fully expanded', () => {
    let alicePolicy = c2.stylePolicy.getSubSpecFor('alice');
    expect(d3.stylePolicy.spec).to.eql({
      name: 'd3',
      fill: Color.cyan,
      defaultViewModel: TestViewModel,
      submorphs: [
        new PolicyApplicator({
          name: 'alice',
          borderRadiusTopLeft: 42,
          master: d1.stylePolicy,
          submorphs: [
            new PolicyApplicator({ name: 'bob' }, alicePolicy.getSubSpecFor('bob'))
          ]
        }, alicePolicy)
      ]
    });

    const fooPolicy = c3.stylePolicy.getSubSpecFor('foo');
    alicePolicy = fooPolicy.getSubSpecFor('alice');
    expect(c4.stylePolicy.spec).to.eql({
      name: 'c4',
      submorphs: [
        new PolicyApplicator({
          name: 'foo',
          master: d3.stylePolicy,
          submorphs: [
            new PolicyApplicator({
              name: 'alice',
              submorphs: [
                new PolicyApplicator({
                  name: 'bob'
                }, alicePolicy.getSubSpecFor('bob'))
              ]
            }, alicePolicy)
          ]
        }, fooPolicy)
      ]
    });
  });

  it('inline policies can be converted to build specs', () => {
    let inline1, inline4;
    const internalSpec = new PolicyApplicator({
      name: 'e2',
      fill: Color.yellow,
      extent: pt(50, 50),
      submorphs: [
        { name: 'alice', fill: Color.black },
        { name: 'bob', master: e1 },
        {
          COMMAND: 'add',
          // ignore the meta prop...
          props: (inline1 = new PolicyApplicator({
            name: 'foo',
            fill: Color.gray,
            submorphs: [{ name: 'bob', fill: Color.green }]
          }, e1), inline1.__wasAddedToDerived__ = true,
          inline1[Symbol.for('lively-module-meta')] = {
            exportedName: 'e2',
            moduleId: 'lively.morphic/tests/components-test.cp.js',
            path: ['foo'],
            range: false
          }, inline1),
          before: null
        },
        {
          COMMAND: 'add',
          props: {
            name: 'bar',
            borderRadius: 5,
            borderColor: Color.black,
            borderWidth: 2,
            __wasAddedToDerived__: true
          },
          before: null
        }
      ]
    }, e1);

    internalSpec._dependants = new Set();
    internalSpec[Symbol.for('lively-module-meta')] = e2.stylePolicy[Symbol.for('lively-module-meta')];

    inline4 = new PolicyApplicator({ name: 'bob', master: e1.stylePolicy }, new PolicyApplicator({
      name: 'bob',
      fill: Color.orange,
      submorphs: [
        {
          name: 'lolly',
          fill: Color.pink
        }
      ]
    }));

    const expectedBuildSpec = {
      name: 'e2',
      master: internalSpec,
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
        {
          name: 'bob',
          master: inline4,
          submorphs: [
            { name: 'lolly' }
          ]
        },
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
              name: 'bob',
              submorphs: [
                { name: 'lolly' }
              ]
            }
          ]
        },
        { name: 'bar', __wasAddedToDerived__: true }
      ]
    };
    expect(internalSpec.asBuildSpec()).to.eql(expectedBuildSpec, 'equals generated');
    expect(e2.stylePolicy.asBuildSpec()).to.eql(expectedBuildSpec, 'equals defined');

    const pa = new PolicyApplicator({}, c3);
    const bs = pa.asBuildSpec();

    expect(bs.master.parent).to.eql(c3.stylePolicy);
    expect(pa.spec.submorphs[0]).not.to.eql(c3.stylePolicy.spec.submorphs[0], 'Inserts empty inline policy');
    expect(bs.submorphs[0].master.parent).to.eql(c3.stylePolicy.spec.submorphs[0], 'Inline policy points to master in component spec');
    expect(bs.submorphs[0].submorphs[0].master.parent).to.eql(c3.stylePolicy.spec.submorphs[0].spec.submorphs[0], 'Points to overridden master policy');
  });

  it('correctly creates build specs for components that have not parent', () => {
    const expectedBuildSpec = {
      name: 'c2',
      viewModel: new TestViewModel(),
      fill: Color.green,
      submorphs: [{
        name: 'alice',
        master: c2.stylePolicy.spec.submorphs[0],
        submorphs: [{ name: 'bob', master: c2.stylePolicy.spec.submorphs[0].spec.submorphs[0].props }]
      }]
    };
    expect(c2.stylePolicy.asBuildSpec()).to.eql(expectedBuildSpec);
  });

  it('properly initializes morphs that resemble the component definition', () => {
    const editableComponent = edit(e2);
    editableComponent.withAllSubmorphsDo(m => m.master && m.master.apply(m));

    expect(editableComponent.get('alice').fill).to.equal(Color.black);
    expect(editableComponent.get('bob').fill).to.equal(Color.red);
    expect(editableComponent.get('foo').master.spec.fill).to.equal(Color.gray, 'does carry over inline policy props');
    expect(editableComponent.get('foo').fill).to.equal(Color.gray);
    expect(editableComponent.get('foo').getSubmorphNamed('bob').fill).to.equal(Color.green);
  });

  it('properly synthesizes style policies', () => {
    expect(e2.stylePolicy.synthesizeSubSpec('bar')).to.eql({
      borderRadius: 5,
      borderColor: Color.black,
      borderWidth: 2,
      __wasAddedToDerived__: true
    });
    const p2 = new PolicyApplicator({
      name: 'foo',
      fill: Color.gray,
      submorphs: [{ name: 'bob', fill: Color.green }]
    }, e1);
    p2.__wasAddedToDerived__ = true;
    expect(e2.stylePolicy.synthesizeSubSpec('foo')).to.eql(p2);
    expect(e3.stylePolicy.synthesizeSubSpec('alice')).to.eql({
      fill: Color.black,
      type: 'text',
      textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
    });
  });

  it('creates properly collapsed overridden properties when master of inline policy gets overridden', () => {
    const c = ComponentDescriptor.for(() => component(e2, {
      name: 'c',
      submorphs: [
        { name: 'foo', master: e2 }
      ]
    }), {});
    const expectedInternalSpecC = new PolicyApplicator({
      name: 'c',
      submorphs: [
        // ad hoc initialized inline policy that is driect descendant of e2
        // and carries over the overridden props that were previously accounted for
        // for the submorph hierarchy of foo
        {
          name: 'foo',
          master: e2
        }
      ]
    }, e2);

    expect(c.stylePolicy).to.eql(expectedInternalSpecC);
    expect(c.stylePolicy.synthesizeSubSpec('foo')).to.eql(new PolicyApplicator({
      name: 'foo',
      master: e2.stylePolicy
    }, e2.stylePolicy.getSubSpecFor('foo'), true));

    const d = ComponentDescriptor.for(() => component(e3, {
      name: 'd',
      submorphs: [
        { name: 'foo', master: e3 }, // causes the collapse of the overridden props of the inline policy of foo
        { name: 'molly', master: e1, opacity: 0.5 } // causes the collapse of the overridden props of the inline policy of molly
      ]
    }));

    const expectedInternalSpecD = new PolicyApplicator({
      name: 'd',
      submorphs: [
        {
          name: 'foo',
          master: e3
        },
        {
          name: 'molly',
          master: e1,
          opacity: 0.5
        }
      ]
    }, e3);

    expect(d.stylePolicy).to.eql(expectedInternalSpecD);
    expect(c.stylePolicy.synthesizeSubSpec('foo').synthesizeSubSpec(null)).to.eql({
      fill: Color.yellow,
      extent: pt(50, 50) // extent is controlled by e3
    });

    expect(d.stylePolicy.synthesizeSubSpec('foo').synthesizeSubSpec(null)).to.eql({
      fill: Color.yellow,
      extent: pt(10, 10) // this is because the encolsing extent "wins"
    });
    expect(d.stylePolicy.synthesizeSubSpec('molly').synthesizeSubSpec(null)).to.eql({
      opacity: 0.5,
      position: pt(45, 45),
      extent: pt(50, 50), // default values in new master do not override custom in original
      fill: Color.red
    });
    expect(d.stylePolicy.synthesizeSubSpec('molly').synthesizeSubSpec('alice')).to.eql({
      fill: Color.blue,
      type: 'text',
      textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }]
    });
  });

  it('can override masters with dispatch logic', () => {
    const c = ComponentDescriptor.for(() => component(e2, {
      name: 'c',
      submorphs: [
        {
          name: 'foo',
          master: {
            auto: d1, hover: d2
          }
        }
      ]
    }), {});
    const inst = part(c);
    inst.master.apply(inst, true);
    expect(inst.get('foo').opacity).to.eql(0.5);
  });

  it('removes morphs if declared as such', () => {
    const c = ComponentDescriptor.for(() => component(e2, {
      name: 'c',
      submorphs: [
        without('alice')
      ]
    }), {});

    const expectedInternalSpec = new PolicyApplicator({
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
        {
          name: 'bob',
          master: new PolicyApplicator({}, getSubPolicy(expectedInternalSpec.parent, 'bob')),
          submorphs: [{ name: 'lolly' }]
        },
        {
          name: 'foo',
          master: new PolicyApplicator({}, getSubPolicy(expectedInternalSpec.parent, 'foo')),
          submorphs: [
            { name: 'alice', type: 'text', textAndAttributes: ['hello', { fontWeight: 'bold' }, 'world', { fontStyle: 'italic' }] },
            { name: 'bob', submorphs: [{ name: 'lolly' }] }
          ]
        },
        {
          __wasAddedToDerived__: true,
          name: 'bar'
        }
      ]
    };

    expect(c.stylePolicy).to.eql(expectedInternalSpec);
    expect(c.stylePolicy.asBuildSpec()).to.eql(expectedBuildSpec);
  });

  describe('policy applicators', () => {
    it('can be applied to a morph', () => {
      const m = part(e1);
      const e2Policy = new PolicyApplicator({}, e2);
      e2Policy.apply(m, true);
      expect(m.fill).to.equal(Color.yellow);
      expect(m.get('bob').fill).to.equal(Color.red); // master not handled properly
    });

    it('fully prepares all masters to be policy applicators in build spec', () => {
      // master policies can wrap inline policies, traverse the spec
      // structure and then in turn generate a master policy spec
      // that can be applied to a morph hierarchy, that is each of these
      // policies are directly placed into the morphs in a hierarchy
      // after which the application of the policies can concurr.
      const e2Policy = new PolicyApplicator({}, e2);
      const c3Policy = new PolicyApplicator({}, c3);
      let spec = e2Policy.asBuildSpec();
      expect(spec.master).to.be.instanceof(PolicyApplicator);
      expect(spec.submorphs[1].master).to.be.instanceof(PolicyApplicator);
      spec = c3Policy.asBuildSpec();
      expect(spec.master.parent).to.eql(c3.stylePolicy);
      expect(spec.submorphs[0].master.parent).to.eql(c3.stylePolicy.spec.submorphs[0]);
      expect(spec.submorphs[0].submorphs[0].master).to.be.instanceof(PolicyApplicator);
    });

    it('reassigns policy applicators in the hierarchy, once applied', () => {
      const m = part(e1);
      const e2Policy = new PolicyApplicator({}, e2);
      const spec = e2Policy.asBuildSpec();
      expect(m.get('bob').master).to.be.undefined;
      e2Policy.apply(m, true);
      expect(m.get('bob').master).not.to.be.undefined;
      expect(m.get('bob').master.parent).to.eql(spec.submorphs[1].master.parent, 'point to the same style policy');
      expect(m.master).not.to.eql(spec.master, 'does not set the root master automatically (still e1)');
    });

    it('updates the specs of the directly attached component policies on change', () => {
      const m = part(e2); // still using the old approach...
      m.master = new PolicyApplicator({}, e2);
      m.get('bob').position = pt(40, 40);
      m.get('bob').extent = pt(100, 100);
      m.get('bar').position = pt(25, 25);
      m.extent = pt(100, 100);
      expect(m.master.spec.extent).to.equal(Symbol.for('lively.skip-property'));
      expect(m.get('bob').master.spec.position).to.equal(Symbol.for('lively.skip-property'));
      expect(m.get('bob').master.spec.extent).to.equal(Symbol.for('lively.skip-property'));
      expect(m.master.spec.submorphs[3].position).to.equal(Symbol.for('lively.skip-property'), 'auto inserts new sub specs if not present before');
    });
  });
});

describe('components', () => {
  afterEach(() => {
    detach(c3);
  });

  it('prevents accumulation of overridden props', () => {
    const A = ComponentDescriptor.for(() => component(c1, {
      name: 'A',
      fill: Color.green,
      borderWidth: 5,
      borderRadius: 10
    }));

    const B = ComponentDescriptor.for(() => component(A, {
      name: 'B',
      fill: Color.orange,
      borderWidth: 0
    }));

    expect(A.stylePolicy.spec).to.eql({
      name: 'A',
      fill: Color.green,
      borderWidth: 5,
      borderRadius: 10,
      submorphs: []
    });

    expect(B.stylePolicy.spec).to.eql({
      name: 'B',
      fill: Color.orange,
      borderWidth: 0,
      submorphs: []
    });
  });

  it('properly adheres to overridden masters', () => {
    const master3 = edit(c3);
    const masterAlice = master3.getSubmorphNamed('alice');
    const masterFoo = master3.getSubmorphNamed('foo');

    expect(masterFoo.master).to.eql(c3.stylePolicy.spec.submorphs[0]);
    expect(masterFoo.master.spec).not.to.have.property('master');
    expect(masterAlice.master.spec.master).to.eql(d2.stylePolicy, 'stores inline master in spec');

    const inst3 = part(c3);
    const alice = inst3.getSubmorphNamed('alice');
    const foo = inst3.getSubmorphNamed('foo');

    alice.master.apply(alice, true);

    expect(foo.master.spec).to.have.keys('name', 'submorphs', 'defaultViewModel');
    expect(foo.master.parent).to.eql(c3.stylePolicy.spec.submorphs[0]);
    expect(alice.master.parent).to.eql(c3.stylePolicy.spec.submorphs[0].spec.submorphs[0]);
    expect(alice.master.spec).to.have.keys('name', 'submorphs');

    expect(alice.fill).to.equal(Color.black);
  });

  it('does not drop assigned master for nested components', () => {
    const instC2 = part(c2);
    instC2.master = d3;
    instC2.get('alice').master = c4;
    instC2.master.applyIfNeeded(true);
    expect(instC2.get('alice').master.overriddenMaster.parent).eql(c4.stylePolicy);
  });

  it('properly applies overridden masters', async () => {
    const inst4 = part(c4);
    const cp4 = edit(c4);
    const alice = inst4.getSubmorphNamed('alice');
    const foo = inst4.getSubmorphNamed('foo');

    expect(foo.master.parent).to.equal(cp4.get('foo').master, 'policy of foo is applied');
    expect(alice.master.parent).to.equal(cp4.get('alice').master, 'policy of alice is applied');
    expect(foo.master.getSubSpecFor(null)).to.have.keys('name', 'submorphs', 'defaultViewModel');
    expect(foo.master.getSubSpecFor('alice').parent).to.eql(cp4.get('alice').master);
    expect(alice.master.getSubSpecFor(null)).to.have.keys('name', 'submorphs');
  });

  it('does not create superflous overridden props', () => {
    const B = ComponentDescriptor.for(() => component(c2, {
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
    }));
    const bc = edit(B);
    const inst = part(B);
    expect(B.stylePolicy.getSubSpecFor('alice').getSubSpecFor('bob').spec).to.have.property('master');
    expect(inst.get('bob').master.parent).to.equal(bc.get('bob').master);
    expect(inst.get('bob').master.spec).to.have.keys('name', 'submorphs');
  });

  it('does honor overridden props in case of nested masters when manually applied to different hierarchy', () => {
    const T1 = ComponentDescriptor.for(() => component(c2, {
      master: d3,　// this master again does not override the locally overridden props
      name: 't1',
      submorphs: [
        {
          name: 'alice',
          fill: Color.blue,
          submorphs: [{
            name: 'bob',
            fill: Color.red // this overridden property needs to be considered when the policy attached to bob is applied to the new hierarchy
          }]
        }
      ]
    }));
    const t1c = edit(T1);

    t1c.master.apply(t1c, true);

    expect(T1.stylePolicy.spec.master).not.to.be.undefined;
    expect(t1c.get('bob').master).not.to.be.undefined;
    expect(t1c.get('bob').fill).to.eql(Color.red);
    expect(t1c.get('bob').master.synthesizeSubSpec(null).fill).not.to.be.undefined;
    expect(t1c.get('alice').fill).to.eql(Color.blue);

    let inst = part(T1);
    inst.master.apply(inst, true);
    expect(inst.get('bob').fill).to.eql(Color.red);
    expect(inst.get('alice').fill).to.eql(Color.blue);
    expect(inst.fill).to.eql(Color.cyan);
    inst = part(c2, { name: 'troller', master: T1 });
    expect(inst.master.overriddenMaster, 'correctly overrides top level master').to.eql(T1.stylePolicy);
    inst.master.apply(inst, true);
    expect(inst.get('alice').master.spec.master, 'Injects intermediary inline master').to.eql(T1.stylePolicy.getSubSpecFor('alice'));
    expect(inst.get('bob').master.spec.master, 'Injects intermediary inline master').to.eql(T1.stylePolicy.getSubSpecFor('alice').getSubSpecFor('bob'));
    expect(inst.get('alice').fill, 'styles the morphs according to the overridden properties in the assigned master').to.equals(Color.blue);
    expect(inst.get('bob').fill, 'styles the morphs according to the overridden properties in the assigned master').equals(Color.red);
  });

  it('preserves all overridden properties on reset of policy up to top level master', async () => {
    const c = part(d3);
    c.master.apply(c, true);
    expect(c.get('alice').fill).to.equal(Color.purple);
    expect(c.get('alice').borderColorTop).to.equal(Color.red);
    expect(c.get('alice').borderRadiusTopLeft).to.equal(42);
    expect(c.get('alice').master.isPolicy).to.be.true;
    c.get('alice').master = new PolicyApplicator({}, d2);
    c.get('alice').master.apply(c.get('alice'), true);
    expect(c.get('alice').fill).to.equal(Color.black);
    expect(c.get('alice').borderColorTop).to.equal(Color.red, 'border color keeps being overridden');
    expect(c.get('alice').borderRadiusTopLeft).to.equal(42, 'border radius keeps being overridden');
  });

  it('does not enforce masters on newly introduced morphs with a different master', () => {
    const T1 = ComponentDescriptor.for(() => component(c2, {
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
    }));

    expect(part(T1).get('bob').master.parent.spec.master).to.eql(T1.stylePolicy.getSubSpecFor('bob').spec.master);
    expect(part(T1).get('bob').master.parent.parent).to.eql(d1.stylePolicy, 'wraps an unnessecary in between policy');
  });

  it('includes added morphs into inline policies', () => {
    const t1 = ComponentDescriptor.for(() => component(c2, {
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
    }));
    const inst = part(t1);
    expect(inst.master.getSubSpecFor('bob')).not.to.be.undefined;
  });

  it('does not serialize bindings but reconstructs them reliably', () => {
    const inst = part(c2);
    expect(inst.viewModel).not.to.be.undefined;
    expect(inst.get('alice').attributeConnections).not.to.be.undefined;
    const snap = serialize(inst);
    expect(snap.snapshot[inst.get('alice').id].props.attributeConnections).to.eql({ value: [] }, 'ensure bindings not inside snapshot');
  });

  it('serializes inline properties to symbolic expressions', () => {
    const inst = part(TLB);
    const snap = serialize(inst);
    expect(snap.snapshot[snap.snapshot[inst.get('alice').id].props.master.value.id].props._parent.value).to.include('TLB.stylePolicy.getSubSpecAt(["alice"])');
  });

  it('does not accidentally create overridden masters when serializing', () => {
    const inst = part(TLB);
    const instOverridden = part(TLB, {
      submorphs: [
        { name: 'alice', master: TLB }
      ]
    });
    const copied = inst.copy();
    const copied2 = instOverridden.copy();
    expect(inst.master.getSubSpecFor()).has.keys('name', 'submorphs');
    expect(copied.master.getSubSpecFor()).has.keys('name', 'submorphs');
    expect(instOverridden.master.getSubSpecFor('alice').spec).has.keys('name', 'submorphs', 'master');
    expect(instOverridden.master.getSubSpecFor('alice').spec.master).to.eql(TLB.stylePolicy);
    expect(copied2.master.getSubSpecFor('alice').spec).has.keys('name', 'submorphs', 'master');
  });

  it('initializes embedded morphs in textAndAttributes correctly', () => {
    const m = part(c5);
    const m1 = part(c5);
    expect(m.get('holly')).not.to.be.null;
    expect(m1.get('wood')).not.to.be.null;
    expect(m.get('wood')).not.to.be.null;
  });

  xit('attaches the proper style policies to embedded morphs', () => {
    const m = part(c5);
    expect(m.get('lively').master.parent.parent).equals(c4.stylePolicy, 'properly assigns style policies');
    expect(m.get('holly').master.parent.parent).equals(c4.stylePolicy, 'properly assigns style polcies');
    expect(c5.stylePolicy.getSubSpecFor('holly')).to.be.instanceof(PolicyApplicator);
    expect(c5.stylePolicy.getSubSpecFor('wood')).to.be.instanceof(Object);
  });

  xit('applies style policies correctly to embedded morphs', () => {
    const m = morph({
      type: 'text',
      needsDocument: true,
      textAndAttributes: [
        'Something: ', {},
        morph({ name: 'holly', fill: Color.blue }), null,
        'or: ', null,
        morph({ name: 'wood', fill: Color.yellow }), null
      ],
      submorphs: [
        { name: 'lively', fill: Color.red }
      ]
    });
    m.master = c5;
    m.master.applyIfNeeded(true);
    expect(m.get('wood').fill).to.eql(Color.orange);
    expect(m.get('lively').fill).to.eql(Color.lively);
    expect(m.get('holly').fill).to.eql(Color.orange);
  });

  xit('properly merges submorphs embedded in text attributes', () => {
    const m = part(c6);
    expect(m.get('wood').fill).to.eql(Color.blue);
    expect(m.get('holly').fill).to.eql(Color.red);
    expect(m.get('holly').getSubmorphNamed('alice').fill).to.eql(Color.lively);
  });

  it('properly assigns custom generated names in case of a conflict', () => {
    const C = ComponentDescriptor.for(() => component(c6, {
      submorphs: [
        add(
          part(c1, {
            submorphs: [add(part(c2)), add(part(c2))]
          }), 'lively'
        ),
        add(part(c1), 'lively')
      ]
    }));
    const m = part(C);
    expect(m.submorphs[0].name).to.eql('c1');
    expect(m.submorphs[1].name).not.to.eql('c1');
    expect(m.submorphs[0].submorphs[0].name).to.eql('c2');
    expect(m.submorphs[0].submorphs[1].name).not.to.eql('c2');
  });
});

describe('breakpoints', () => {
  it('propertly initializes breakpoints from spec', () => {
    const bpStore = BreakpointStore.from([
      [pt(100, 0), d2],
      [pt(0, 100), d3],
      [pt(200, 100), null]
    ]);
    expect(bpStore._horizontalBreakpoints).equals([0, 100, 200]);
    expect(bpStore._verticalBreakpoints).equals([0, 100]);
    expect(grid.get(bpStore._breakpointMasters, 0, 1)).equals(d2);
    expect(grid.get(bpStore._breakpointMasters, 1, 0)).equals(d3);
    expect(grid.get(bpStore._breakpointMasters, 1, 2)).equals(null);
  });
});
