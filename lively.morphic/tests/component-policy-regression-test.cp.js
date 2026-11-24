/* global describe, it, System */
import { expect } from 'mocha-es6';
import { Color } from 'lively.graphics';
import { ComponentDescriptor, Morph, Text } from 'lively.morphic';
import { withSuperclasses } from 'lively.classes/util.js';
import { component, part, replace } from '../components/core.js';
import { PolicyApplicator } from '../components/policy.js';

const moduleId = import.meta.url.replace(System.baseURL, '');

describe('component policy regressions', () => {
  it('E finds the policy of a part embedded in text', () => {
    const Inner = ComponentDescriptor.for(() => component({
      name: 'inner', fill: Color.orange
    }), { exportedName: 'EmbeddedInner', moduleId });
    const Holder = ComponentDescriptor.for(() => component({
      type: Text,
      name: 'holder',
      textAndAttributes: ['x: ', null, part(Inner, { name: 'embedded' }), null]
    }), { exportedName: 'EmbeddedHolder', moduleId });

    const embedded = Holder.stylePolicy.getSubSpecFor('embedded');
    expect(embedded, 'E: embedded lookup must return its policy').to.be.instanceof(PolicyApplicator);
    expect(embedded.name, 'E: lookup must not return the enclosing Text').equals('embedded');
    expect(embedded.parent, 'E: embedded part must retain its component').equals(Inner.stylePolicy);
  });

  it('F leaves descendants controlled by a different master alone', () => {
    const A = ComponentDescriptor.for(() => component({
      name: 'a',
      submorphs: [{ name: 'scope', submorphs: [{ name: 'leaf', fill: Color.red }] }]
    }), { exportedName: 'OuterMaster', moduleId });
    const B = ComponentDescriptor.for(() => component({
      name: 'b', submorphs: [{ name: 'leaf', fill: Color.green }]
    }), { exportedName: 'InnerMaster', moduleId });
    const instance = part(A);
    const scope = instance.get('scope');
    scope.master = B;
    scope.master.applyIfNeeded(true);
    const leaf = scope.get('leaf');
    expect(leaf.fill, 'F: the inner master must be active before the edit').equals(Color.green);
    expect(instance.master.getSubSpecFor('leaf'), 'F: outer instance starts without a leaf override').deep.equals({ name: 'leaf' });

    leaf.fill = Color.blue;

    expect(instance.master.getSubSpecFor('leaf'), 'F: another master must not gain a leaf override').deep.equals({ name: 'leaf' });
    instance.master.applyIfNeeded(true);
    expect(leaf.fill, 'F: reapplying the outer master must preserve the inner override').equals(Color.blue);
  });

  it('F still records overrides through owners without their own master', () => {
    const Base = ComponentDescriptor.for(() => component({
      name: 'base',
      submorphs: [{ name: 'branch', submorphs: [{ name: 'leaf', fill: Color.red }] }]
    }), { exportedName: 'UnmasteredBranch', moduleId });
    const instance = part(Base);
    const leaf = instance.get('leaf');

    leaf.fill = Color.blue;

    expect(instance.master.getSubSpecFor('leaf').fill, 'F: the nearest master must retain a local override').equals(Symbol.for('lively.skip-property'));
    instance.master.applyIfNeeded(true);
    expect(leaf.fill, 'F: reapplying the owning master must preserve its local override').equals(Color.blue);
  });

  it('G clears a runtime add command referring to a removed sibling', () => {
    const Base = ComponentDescriptor.for(() => component({
      name: 'base', submorphs: [{ name: 'y' }]
    }), { exportedName: 'RemovalBase', moduleId });
    const instance = part(Base);
    const y = instance.get('y');
    const x = new Morph({ name: 'x' });
    instance.addMorph(x, y);
    // Live reconciliation records the command after the component is constructed.
    const addition = instance.master.ensureSubSpecFor(x, true);
    addition.before = y.name;
    expect(addition.COMMAND, 'G: setup must retain a runtime add command').equals('add');
    expect(instance.master.getSubSpecFor('x', false, false), 'G: the command must belong to the active policy').equals(addition);
    expect(addition.before, 'G: setup must retain the sibling reference').equals('y');

    y.remove();
    instance.master.removeSpecInResponseTo({ target: instance, args: [y] });

    expect(addition.before, 'G: removal must clear the dangling before reference').equals(null);
    expect(instance.master.getSubSpecFor('y', true), 'G: the inherited sibling must be marked removed').deep.equals({ COMMAND: 'remove', target: 'y' });
    expect(instance.master.asBuildSpec().submorphs.map(spec => spec.name), 'G: rebuilding must retain the added morph').deep.equals(['x']);
  });

  it('A normalizes text for a subclass of a distinct Text class', async () => {
    const { Text: ReloadedText } = await System.import('lively.morphic/text/morph.js?fx3-distinct-text');
    class TextSubclass extends ReloadedText {}
    expect(ReloadedText, 'A: the reloaded Text identity must differ').not.equals(Text);
    expect(withSuperclasses(TextSubclass).includes(Text), 'A: setup must exercise the class-name fallback').equals(false);
    const Base = ComponentDescriptor.for(() => component({
      type: TextSubclass, name: 'distinct text', textString: 'inherited'
    }), { exportedName: 'DistinctTextBase', moduleId });
    const Derived = ComponentDescriptor.for(() => component(Base, {
      textAndAttributes: ['overridden', { fontWeight: 'bold' }]
    }), { exportedName: 'DistinctTextDerived', moduleId });
    const spec = Derived.stylePolicy.synthesizeSubSpec();

    expect(spec.textString, 'A: inherited textString must not survive text normalization').equals(undefined);
    expect(part(Derived).textAndAttributes, 'A: the distinct Text subclass must receive the override').deep.equals(['overridden', { fontWeight: 'bold' }]);
  });

  it('D replaces a Text with a fresh plain morph without an add command', () => {
    const Base = ComponentDescriptor.for(() => component({
      name: 'base', submorphs: [{ type: Text, name: 'old', textString: 'old text' }]
    }), { exportedName: 'PlainReplacementBase', moduleId });
    const Derived = ComponentDescriptor.for(() => component(Base, {
      submorphs: [replace('old', { name: 'replacement', fill: Color.orange })]
    }), { exportedName: 'PlainReplacementDerived', moduleId });
    const instance = part(Derived);
    const replacement = instance.get('old');

    expect(replacement.isText, 'D: a plain replacement must not inherit the old Text type').not.equals(true);
    expect(replacement.textString, 'D: a plain replacement must not inherit the old text').equals(undefined);
    expect(replacement.fill, 'D: the replacement must retain its own style').equals(Color.orange);
    expect(instance.submorphs.map(m => m.name), 'D: the replacement must keep the target name and slot').deep.equals(['old']);
  });
});
