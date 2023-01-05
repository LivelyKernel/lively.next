import { num, promise, string, arr } from 'lively.lang';
import { Color, pt, Rectangle } from 'lively.graphics';
import { Point } from 'lively.graphics/geometry-2d.js';
import { ShadowObject, part } from 'lively.morphic';
import { module } from 'lively.modules/index.js';
import { browserForFile } from '../js/browser/ui.cp.js';
import { parse } from 'lively.ast';

/**
 * The following setup performs randomized operations on a component morph,
 * constantly altering the component definition. This allows us to capture
 * edge cases in the source ransformation that lead to unvalid syntax or
 * overly verbose component definitions.
 */

/**
 * Randomly selects a descendant of this morph, or the morph itself if no submorphs present;
 * @param { Morph } aMorph - The morph whose descendants to traverse.
 * @returns { Morph } The randomly selected morph.
 */
function randomSelectChild (aMorph) {
  if (aMorph.submorphs.length === 0) return aMorph;
  return arr.shuffle(aMorph.withAllSubmorphsDo((m) => m))[0];
}

function generateValueFor (propSpec) {
  let { defaultValue, type, values, min = 0, max = 100 } = propSpec;
  if (!defaultValue && !type) return;
  if (!type) {
    type = defaultValue.constructor?.name;
    if (!type) return;
  }
  switch (type) {
    case 'Boolean': return !!num.random(0, 1);
    case 'String': return string.newUUID();
    case 'Enum': return arr.shuffle(values)[0];
    case 'Color': return Color.random();
    // ColorGradient,
    // Layout,
    case 'Rectangle': return Rectangle.fromAny(Point.random(pt(500, 500)), Point.random(pt(500, 500)));
    case 'Number': return num.random(min, max) || num.random();
    case 'Shadow': return new ShadowObject({});
    case 'Point': return Point.random(pt(500, 500));
  }
}

/**
 * Generates a randomized set of properties that can be applied to the given morph.
 * @param { Morph } aMorph - The morph to generate the props for.
 */
function generatePropsFor (aMorph) {
  const props = aMorph.propertiesAndPropertySettings().properties;
  const { styleProperties } = aMorph;
  const selectedProps = arr.shuffle(styleProperties).slice(0, num.random(0, styleProperties.length / 4));
  const generated = {};
  for (let propName of selectedProps) {
    generated[propName] = generateValueFor(props[propName]);
    if (typeof generated[propName] === 'undefined') delete generated[propName];
  }
  return generated;
}

let editableComponent;
const testModuleId = 'local://lively-object-modules/Test/component-monkey-patch-test-a.cp.js';
const initSource = `
import { part, component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color, pt} from 'lively.graphics';
import { Text } from "lively.morphic";

component.DescriptorClass = InteractiveComponentDescriptor;

const C = component({
  fill: Color.grey,
});

const D = component({
  fill: Color.purple,
  submorphs: [{
    name: 'a deep morph',
    fill: Color.orange
  }]
});

const A = component({
  fill: Color.red,
  extent: pt(100,100),
  submorphs: [{
    type: Text,
    name: 'some submorph',
    extent: pt(50,50),
    fixedWidth: true,
    fixedHeight: true,
    fill: Color.yellow,
  },part(D, { name: 'some ref'})]
});

const Monkey = component(A, {
  submorphs: [{
    name: 'some submorph',
    fill: Color.green
  }]
});

component.DescriptorClass = ComponentDescriptor;

export { A, C, D, Monkey };
`;

async function ensureModule () {
  let testComponentModule = module(testModuleId);

  await testComponentModule.reset();
  if (testComponentModule.format() === 'global') {
    await testComponentModule.changeSource('', { moduleId: testModuleId });
    await testComponentModule.reload();
    await testComponentModule.setFormat('register');
    await testComponentModule.changeSource(initSource, { moduleId: testModuleId });
    await testComponentModule.reload();
  } else {
    // reset the module to its original code
    await testComponentModule.changeSource(initSource, { moduleId: testModuleId });
  }
}

let Monkey, A, C, D;

async function createSetup () {
  await ensureModule();
  const testComponentModule = module(testModuleId);
  ({ Monkey, A, C, D } = await testComponentModule.load());
  editableComponent = await Monkey.edit();
  return await $world.execCommand('open browser', { moduleName: testModuleId, packageName: 'Test', reuse: true });
}

// performNextChange()

async function performNextChange () {
  // pick between adding a new morph,
  // removing a morph
  // or changing a prop
  const target = randomSelectChild(editableComponent);
  switch (arr.shuffle(['add', 'remove', 'prop'])[0]) {
    case 'add':
      let newChild = part(arr.shuffle([A, C, D])[0], { name: string.newUUID() });
      editableComponent.withMetaDo({ reconcileChanges: true }, () => {
        target.addMorph(newChild, arr.shuffle(target.submorphs)[0]);
      });
      return ['add', target, newChild];
      break;
    case 'remove':
      if (target !== editableComponent) {
        const ownerChain = target.ownerChain().map(m => m.name);
        editableComponent.withMetaDo({ reconcileChanges: true }, () => {
          target.remove();
        });
        return ['remove', target, ownerChain];
      }
    case 'prop':
      let props = generatePropsFor(target);
      editableComponent.withMetaDo({ reconcileChanges: true }, () => {
        Object.assign(target, props);
      });
      return ['apply props', target, props];
  }
}

// errorChange = await runSteps(1000);
// errorChange[1].name
// errorChange[2]
// errorChange[3]

async function runSteps (n) {
  let sourceBefore;
  const b = await createSetup();
  await b.whenRendered();
  const editor = b.get('source editor');
  editor.scrollPageDown();
  await b.whenRendered();
  while (n-- > 0) {
    await editor.whenRendered();
    sourceBefore = editor.textString;
    const change = await performNextChange();
    try {
      parse(editor.textString);
    } catch (err) {
      b.getWindow().remove();
      change.push(sourceBefore);
      change.push(editor.textString);
      return change;
    }
    if (editor.textString.match(/part\((A|B|C)\)/)) debugger;
  }
}
