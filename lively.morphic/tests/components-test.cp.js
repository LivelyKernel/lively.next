/* global describe, it, beforeEach */
import { expect } from 'mocha-es6';
import { component, part, add } from '../components/core.js';
import { Color } from 'lively.graphics';

let c1, c2, c3, c4, d1, d2, d3;

describe('components', () => {
  beforeEach(() => {
    d1 = component({ fill: Color.purple });
    d2 = component({ fill: Color.black });
    c1 = component({
      fill: Color.red
    });
    c2 = component({
      fill: Color.green,
      submorphs: [part(c1, {
        name: 'alice',
        submorphs: [add(part(d1, { name: 'bob' }))]
      })]
    });
    d3 = component(c2, {
      fill: Color.cyan,
      submorphs: [
        { name: 'alice', master: d1 }
      ] 
    });
    c3 = component({
      fill: Color.orange,
      submorphs: [part(c2, {
        name: 'foo',
        submorphs: [{ name: 'alice', master: d2 }]
      })] 
    });
    c4 = component(c3, {
      submorphs: [
        { name: 'foo', master: d3 }
      ]  
    });
  });

  it('prevents accumulation of overridden props', () => {
    // let's create a couple of derived component from c1
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
    expect(alice.master._appliedMaster).to.equal(d2);
    expect(alice.master._overriddenProps.get(alice)).to.eql({ master: true });
    
    expect(foo.master._overriddenProps.get(alice)).to.eql({ master: true });

    // check the appearance is according to the expectation
    expect(alice.fill).to.equal(Color.black);
  });

  it('properly applies overridden masters', () => {
    const inst4 = part(c4);
    const alice = inst4.getSubmorphNamed('alice');
    const foo = inst4.getSubmorphNamed('foo');
    expect(foo.master._appliedMaster).to.equal(d3);
    expect(foo.master._overriddenProps.get(foo)).to.eql({ master: true });
    expect(foo.master._overriddenProps.get(alice)).to.eql({});
    expect(alice.master._overriddenProps.get(alice)).to.eql({ master: true });
    // yet the correct master is still applied!
    expect(alice.master._appliedMaster).to.equal(d1);
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
    // fixme: this does not make any sense
    expect(b.get('bob').master._overriddenProps.get(b.get('bob'))).to.eql({ master: true });
    expect(inst.get('bob').master.auto).to.equal(d2);
    expect(inst.get('bob').master._overriddenProps.get(inst.get('bob'))).to.eql({ master: true });
  });
});
