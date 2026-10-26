/* global System, describe, it */
import { expect } from 'mocha-es6';
import { Color } from 'lively.graphics';
import { component, part, ComponentDescriptor, ViewModel } from 'lively.morphic';
import { ExpressionSerializer, serializeSpec } from 'lively.serializer2';
import { LabeledCheckboxLight } from 'lively.components/checkbox.cp.js';

const moduleId = import.meta.url.replace(System.baseURL, '');

export class ExposedLabelModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () { return ['label', 'enabled', 'details', 'tone', 'report', { method: 'report', as: 'summarize' }, ['textString', { target: 'caption' }]]; }
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
      tone: { defaultValue: Color.blue }
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
    const label = part(ExposedLabel, { label: 'serialized', enabled: false, details: ['one', 2], tone: Color.orange, fill: Color.green });
    const expression = serializeSpec(label, {
      asExpression: true,
      exposeMasterRefs: true,
      onlyIncludeStyleProps: true,
      skipUnchangedFromMaster: true
    });
    expect(expression.__expr__).includes('part(ExposedLabel');
    expect(expression.__expr__).not.matches(/\b(?:report|summarize):/);
    const restored = new ExpressionSerializer().deserializeExprObj(expression);
    expect(restored.label).equals('serialized');
    expect(restored.enabled).equals(false);
    expect(restored.details).deep.equals(['one', 2]);
    expect(restored.tone).equals(Color.orange);
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
});
