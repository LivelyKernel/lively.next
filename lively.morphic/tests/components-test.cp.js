/* global describe, it, beforeEach */
import { expect } from 'mocha-es6';
import { component, part, add } from '../components/core.js';
import { Color } from 'lively.graphics';

let c1, c2, c3, d1, d2;

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
    c3 = component({
      fill: Color.orange,
      submorphs: [part(c2, {
        name: 'foo',
        submorphs: [{ name: 'alice', master: d2 }]
      })] 
    });
  });
  
  it('properly carries over overridden props between masters', () => {
    const inst3 = part(c3);
    const alice = inst3.getSubmorphNamed('alice');
    const foo = inst3.getSubmorphNamed('foo');
    const masterAlice = c3.getSubmorphNamed('alice');
    const masterFoo = c3.getSubmorphNamed('foo');
    
    expect(masterAlice.master._appliedMaster).to.equal(d2);
    expect(alice.master._appliedMaster).to.equal(d2);
    expect({ master: true, fill: true }).to;
    expect(foo.master._overriddenProps.get(alice)).to.eql({ master: true });
    expect(masterFoo.master._overriddenProps.get(masterAlice)).to.eql({ master: true });
    expect(alice.master._overriddenProps.get(alice)).to.eql({ master: true });
    expect(alice.fill).to.equal(Color.black);
  });
});
