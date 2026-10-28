/* global System, describe, it */
import { expect } from 'mocha-es6';
import { connect } from 'lively.bindings';
import { Color } from 'lively.graphics';
import { component, part, ComponentDescriptor, ViewModel, Label, Morph } from 'lively.morphic';
import { ExpressionSerializer, serializeSpec } from 'lively.serializer2';
import { LabeledCheckboxLight } from 'lively.components/checkbox.cp.js';
import { Tab } from 'lively.ide/studio/tabs.cp.js';

const moduleId = import.meta.url.replace(System.baseURL, '');

export class ExposedLabelModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () { return ['label', 'enabled', 'details', 'tone', 'transientValue', 'report', { method: 'report', as: 'summarize' }, ['textString', { target: 'caption' }]]; }
      },
      label: {
        defaultValue: 'default',
        set (value) {
          this.setProperty('label', value);
          if (this.view) {
            if (!this.loaded) throw new Error('label applied before viewDidLoad');
            this.ui.caption.textString = value;
          }
        }
      },
      enabled: { defaultValue: true },
      details: { defaultValue: null },
      tone: { defaultValue: Color.blue },
      immutable: { defaultValue: 'read only', readOnly: true },
      transientValue: { defaultValue: null, serialize: false }
    };
  }

  viewDidLoad () {
    super.viewDidLoad();
    this.loaded = true;
    this.ui.caption.textString = this.label;
  }

  report () { return this.label; }
}

export const ExposedLabel = ComponentDescriptor.for(() => component({
  name: 'exposed label',
  defaultViewModel: ExposedLabelModel,
  fill: Color.red,
  submorphs: [{ type: 'label', name: 'caption', textString: 'default' }]
}), { moduleId, exportedName: 'ExposedLabel' });

export const NestedLabels = ComponentDescriptor.for(() => component({
  name: 'nested labels',
  submorphs: [part(ExposedLabel, { name: 'nested', label: 'nested label' })]
}), { moduleId, exportedName: 'NestedLabels' });

export const DerivedLabels = ComponentDescriptor.for(() => component(NestedLabels, {
  submorphs: [{ name: 'nested', label: 'derived label' }]
}), { moduleId, exportedName: 'DerivedLabels' });

export class ReadOnlyCaption extends Label {
  static get properties () {
    return { readonlyCaptionValue: { defaultValue: 'read only', readOnly: true } };
  }
}

export class RedirectedLabelModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return [
            ['label', { model: 'nested' }],
            ['immutable', { model: 'nested' }],
            ['transientValue', { model: 'nested' }],
            ['readonlyCaptionValue', { target: 'caption' }]
          ];
        }
      }
    };
  }
}

export const RedirectedLabel = ComponentDescriptor.for(() => component({
  name: 'redirected label',
  defaultViewModel: RedirectedLabelModel,
  submorphs: [part(ExposedLabel, { name: 'nested', transientValue: 'session only' }), {
    type: ReadOnlyCaption, name: 'caption'
  }]
}), { moduleId, exportedName: 'RedirectedLabel' });

describe('exposed component properties', () => {
  it('accepts and round-trips the reported labeled checkbox example', () => {
    const checkbox = part(LabeledCheckboxLight, { label: '1233', checked: true });
    expect(checkbox.label).equals('1233');
    expect(checkbox.get('label').textString).equals('1233');
    expect(checkbox.get('checkbox').checked).equals(true);
    const expression = serializeSpec(checkbox, { asExpression: true, exposeMasterRefs: true });
    expect(expression.__expr__).not.includes('isCheckbox:');
    const restored = new ExpressionSerializer().deserializeExprObj(expression);
    expect(restored.label).equals('1233');
    expect(restored.get('label').textString).equals('1233');
    expect(restored.get('checkbox').checked).equals(true);
  });

  it('applies top-level data after the view model loads and keeps style overrides', () => {
    const label = part(ExposedLabel, { label: '1233', enabled: false, details: { answer: 42 }, fill: Color.green });
    expect(label.label).equals('1233');
    expect(label.get('caption').textString).equals('1233');
    expect(label.enabled).equals(false);
    expect(label.details).deep.equals({ answer: 42 });
    expect(label.fill).equals(Color.green);
    expect(part(ExposedLabel).label).equals('default');
  });

  it('keeps exposed overrides across derived components', () => {
    const derived = component(component(ExposedLabel, { label: 'first' }), { label: 'second' });
    expect(part(derived).label).equals('second');
    expect(part(derived, { label: 'instance' }).label).equals('instance');
  });

  it('keeps nested overrides through derivation and instance customization', () => {
    expect(part(NestedLabels).get('nested').label).equals('nested label');
    expect(part(DerivedLabels).get('nested').label).equals('derived label');
    const instance = part(DerivedLabels, { submorphs: [{ name: 'nested', label: 'instance label', fill: Color.green }] });
    expect(instance.get('nested').label).equals('instance label');
    expect(instance.get('caption').textString).equals('instance label');
    expect(instance.get('nested').fill).equals(Color.green);
  });

  it('applies redirected properties after nested morphs are available', () => {
    const label = part(ExposedLabel, { textString: 'redirected' });
    expect(label.textString).equals('redirected');
    expect(label.get('caption').textString).equals('redirected');
  });

  it('round-trips exposed data and styles through a part expression', () => {
    const label = part(ExposedLabel, { label: 'serialized', enabled: false, details: ['one', 2], tone: Color.orange, transientValue: 'session only', fill: Color.green });
    const expression = serializeSpec(label, {
      asExpression: true,
      exposeMasterRefs: true,
      onlyIncludeStyleProps: true,
      skipUnchangedFromMaster: true
    });
    expect(expression.__expr__).includes('part(ExposedLabel');
    expect(expression.__expr__).not.matches(/\b(?:report|summarize):/);
    expect(expression.__expr__).not.includes('transientValue:');
    const restored = new ExpressionSerializer().deserializeExprObj(expression);
    expect(restored.label).equals('serialized');
    expect(restored.enabled).equals(false);
    expect(restored.details).deep.equals(['one', 2]);
    expect(restored.tone).equals(Color.orange);
    expect(restored.transientValue).equals(null);
    expect(restored.fill).equals(Color.green);
    expect(restored.report()).equals('serialized');
    expect(restored.summarize()).equals('serialized');
  });

  it('round-trips runtime changes in nested derived components', () => {
    const instance = part(DerivedLabels);
    instance.get('nested').label = 'changed after instantiation';
    const expression = serializeSpec(instance, {
      asExpression: true,
      exposeMasterRefs: true,
      onlyIncludeStyleProps: true,
      skipUnchangedFromMaster: true,
      dropMorphsWithNameOnly: true
    });
    const restored = new ExpressionSerializer().deserializeExprObj(expression);
    expect(restored.get('nested').label).equals('changed after instantiation');
    expect(restored.get('caption').textString).equals('changed after instantiation');
  });

  it('keeps exposed values out of non-expression specs', () => {
    const label = part(ExposedLabel, { label: 'ordinary spec', details: { answer: 42 } });
    const spec = serializeSpec(label);
    expect(spec).not.property('label');
    expect(spec).not.property('details');
  });

  it('round-trips a tab without serializing its external morph content', () => {
    const content = new Morph({ name: 'external tab content' });
    const tab = part(Tab, { caption: 'a tab', content });
    const expression = serializeSpec(tab, { asExpression: true, exposeMasterRefs: true });
    expect(expression.__expr__).not.includes('content:');
    expect(expression.__expr__).not.includes('external tab content');
    const restored = new ExpressionSerializer().deserializeExprObj(expression);
    expect(restored.caption).equals('a tab');
    expect(restored.content).equals(undefined);
    expect(tab.content).equals(content);
  });

  it('skips runtime objects, functions, morph references and cycles in exposed data', () => {
    const external = new Morph({ name: 'external target' });
    const cyclic = {};
    cyclic.self = cyclic;
    const label = part(ExposedLabel);
    for (const value of [{ target: external }, [external], { callback: () => 23 }, new Map(), cyclic]) {
      label.details = value;
      const expression = serializeSpec(label, { asExpression: true, exposeMasterRefs: true });
      expect(expression.__expr__).not.includes('details:');
      const restored = new ExpressionSerializer().deserializeExprObj(expression);
      expect(restored.details).equals(null);
      expect(label.details).equals(value);
    }
  });

  it('respects skipUnchangedFromDefault for exposed values', () => {
    const label = part(ExposedLabel);
    const options = { asExpression: true, exposeMasterRefs: true };
    const minimal = serializeSpec(label, { ...options, skipUnchangedFromDefault: true });
    expect(minimal.__expr__).not.matches(/\b(?:label|enabled|details|tone):/);
    const complete = serializeSpec(label, { ...options, skipUnchangedFromDefault: false });
    expect(complete.__expr__).matches(/\blabel:/);
    expect(complete.__expr__).matches(/\benabled:/);
    expect(complete.__expr__).matches(/\btone:/);
    label.enabled = false;
    const changed = serializeSpec(label, { ...options, skipUnchangedFromDefault: true });
    expect(changed.__expr__).matches(/\benabled:\s*false/);
  });

  it('serializes redirected values after their original targets are renamed', () => {
    const label = part(RedirectedLabel, { label: 'renamed target data' });
    label.get('nested').name = 'renamed nested';
    label.get('caption').name = 'renamed caption';
    expect(label.label).equals('renamed target data');
    const expression = serializeSpec(label, { asExpression: true, exposeMasterRefs: true });
    expect(expression.__expr__).includes('renamed target data');
    expect(expression.__expr__).not.matches(/\b(?:immutable|transientValue|readonlyCaptionValue):/);
  });

  it('keeps redirected property settings when bindings wrap the exposed getter', () => {
    const label = part(RedirectedLabel, { label: 'connected target data' });
    const connections = ['label', 'immutable', 'transientValue', 'readonlyCaptionValue']
      .map(name => connect(label, name, {}, 'value'));
    try {
      label.get('nested').name = 'renamed nested';
      label.get('caption').name = 'renamed caption';
      const expression = serializeSpec(label, { asExpression: true, exposeMasterRefs: true });
      expect(expression.__expr__).includes('connected target data');
      expect(expression.__expr__).not.matches(/\b(?:immutable|transientValue|readonlyCaptionValue):/);
    } finally { connections.forEach(connection => connection.disconnect()); }
  });

  it('respects readOnly and serialize settings on redirected models and morphs', () => {
    const label = part(RedirectedLabel, { label: 'redirected data' });
    const expression = serializeSpec(label, { asExpression: true, exposeMasterRefs: true });
    expect(expression.__expr__).not.matches(/\b(?:immutable|transientValue|readonlyCaptionValue):/);
    const restored = new ExpressionSerializer().deserializeExprObj(expression);
    expect(restored.label).equals('redirected data');
    expect(restored.immutable).equals('read only');
    expect(restored.readonlyCaptionValue).equals('read only');
    expect(restored.get('nested').transientValue).equals('session only');
  });
});
