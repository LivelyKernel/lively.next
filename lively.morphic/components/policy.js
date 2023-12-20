import { arr, grid, string, tree, promise, obj } from 'lively.lang';
import { pt } from 'lively.graphics';
import { morph, getDefaultValuesFor, sanitizeFont, getStylePropertiesFor, getDefaultValueFor } from '../helpers.js';
import { withSuperclasses } from 'lively.classes/util.js';
import { ExpressionSerializer, serializeSpec } from 'lively.serializer2';
import { Text, Label, Morph } from 'lively.morphic';
import { Icons } from '../text/icons.js';

const skippedValue = Symbol.for('lively.skip-property');
const PROPS_TO_RESET = ['dropShadow', 'fill', 'opacity', 'borderWidth', 'fontColor'];
const expressionSerializer = new ExpressionSerializer();

export function sanitizeSpec (spec) {
  for (let prop in spec) {
    if (spec[prop]?.isDefaultValue) spec[prop] = spec[prop].value;
  }
  return spec;
}

export function standardValueTransform (key, val, aMorph) {
  if (val && val.isPoint) return val.roundTo(0.1);
  if (key === 'label' || key === 'textAndAttributes') {
    let hit;
    if (Array.isArray(val) && (hit = Object.entries(Icons).find(([iconName, iconValue]) => iconValue.code === val[0]))) {
      return {
        __serialize__ () {
          return {
            __expr__: `Icon.textAttribute("${hit[0]}")`,
            bindings: {
              'lively.morphic/text/icons.js': ['Icon']
            }
          };
        }
      };
    }
  }
  return val;
}

/**
 * Function that will wrap a morph definition and declares
 * that this morph is added to the submorph array it is placed in.
 * This is meant to be used inside overriden props of `part(C, {...})` or `component(C, {...})`
 * calls. It will not make sense on `morph({...})` or `component({...})` calls.
 * If before is specified this will ensure that the morph is added before the morph
 * named as before.
 * @param { object } props - A nested properties object that specs out the submorph hierarchy to be added. (This can also be a `part()` call).
 * @param { string } [before] - An optional parameter that denotes the name of the morph this new one should be placed in front of.
 */
export function add (props, before = null) {
  props.__wasAddedToDerived__ = true;
  return {
    COMMAND: 'add',
    props: props,
    before
  };
}

/**
 * Function that will wrap a morph's name and declare
 * that this morph is removed from the submorph array it is located in.
 * This is meant to be used inside overriden props of `part(C, {...})` or `component(C, {...})`
 * calls. It will not make sense on `morph({...})` or `component({...})` calls.
 * @param { string } removedSiblingName - The name of the submorph that is to be removed from the hierarchy.
 */
export function without (removedSiblingName) {
  return {
    COMMAND: 'remove',
    target: removedSiblingName
  };
}

function handleTextProps (props) {
  if (arr.intersect(
    ['text', 'label', Text, Label], withSuperclasses(props.type)).length === 0) { return props; }
  if (props.textString) {
    props.textAndAttributes = [props.textString, null];
    delete props.textString;
  }
  if (props.value && obj.isArray(props.value)) {
    props.textAndAttributes = props.value;
    delete props.value;
  }
  if (props.value && obj.isString(props.value)) {
    props.textAndAttributes = [props.value, null];
    delete props.value;
  }
  if (props.fontFamily) {
    const ff = props.fontFamily.isDefaultValue ? props.fontFamily.value : props.fontFamily;
    if (ff !== skippedValue) { props.fontFamily = sanitizeFont(ff); }
  }
  return props;
}

/**
 * Merges two different specs.
 */
function mergeInHierarchy (
  root,
  props,
  iterator,
  executeCommands = false,
  removeFn = (parent, aMorph) => aMorph.remove(),
  addFn = (parent, aMorph, before) => parent.addMorph(aMorph, before).__wasAddedToDerived__ = true) {
  iterator(root, props); // this is the place, where we can also replace submorphs entirely...
  let [commands, nextPropsToApply] = arr.partition([...props.submorphs || []], (prop) => !!prop.COMMAND);
  props = nextPropsToApply.shift();
  for (let submorph of root.submorphs || []) {
    if (!props) break;
    if (submorph.name === props.name) {
      mergeInHierarchy(submorph, props, iterator, executeCommands, removeFn, addFn);
      props = nextPropsToApply.shift();
    }
  }
  // finally we apply the commands
  if (!executeCommands) return;
  for (let cmd of commands) {
    if (cmd.COMMAND === 'remove' && root.submorphs) {
      const morphToRemove = root.submorphs.find(m => m.name === cmd.target);
      if (morphToRemove) removeFn(root, morphToRemove);
    }

    if (cmd.COMMAND === 'add') {
      if (!root.submorphs) root.submorphs = [];
      const beforeMorph = cmd.before && root.submorphs.find(m => m.name === cmd.before);
      addFn(root, cmd.props, beforeMorph);
    }
  }
  return root;
}

/**
 * Returns the event state a given morph is currently in.
 * This is usually with respect system specific settings/input, such as: Hover/Click state or light/dark mode.
 * However we can also provide custom breakpoints of the viewport, which coincide with a particular width or height
 * of the morph to check for. With this we are able to implement responsive design with master components.
 * @param { Morph } targetMorph - The morph to check the state for.
 * @param { object[] } customBreakpoints - A list of custom breakpoints in response to the width/height of the `targetMorph`.
 * @returns { object } The event state corresponding to the morph.
 */
function getEventState (targetMorph, breakpointStore, localComponentStates) {
  const stateMaster = localComponentStates?.[targetMorph.master?._componentState];
  const { world, eventDispatcher } = targetMorph.env;
  const mode = world && world.colorScheme; // "dark" | "light"
  const isHovered = eventDispatcher && eventDispatcher.isMorphHovered(targetMorph); // bool
  const isClicked = eventDispatcher && isHovered && eventDispatcher.isMorphClicked(targetMorph); // bool
  const breakpointComponent = breakpointStore?.getMatchingBreakpointMaster(targetMorph);
  return {
    breakpointMaster: breakpointComponent?.stylePolicy,
    mode,
    isHovered,
    isClicked,
    stateMaster
  };
}

export function withAllViewModelsDo (inst, cb) {
  if (inst.master) inst.master.applyIfNeeded(true);
  const toAttach = [];
  inst.withAllSubmorphsDo(m => {
    if (m.viewModel) toAttach.unshift(m);
  });
  toAttach.forEach(cb);
}

export class BreakpointStore {
  constructor () {
    this._horizontalBreakpoints = [0];
    this._verticalBreakpoints = [0];
    this._breakpointMasters = [[null]];
  }

  static from (breakpointSpec) {
    const store = new this();
    const vbps = store._verticalBreakpoints;
    const hbps = store._horizontalBreakpoints;
    breakpointSpec.forEach(([bp, componentDescriptor]) => {
      store.addHorizontalBreakpoint(bp.x);
      store.addVerticalBreakpoint(bp.y);
    });
    breakpointSpec.forEach(([bp, componentDescriptor]) => {
      store.setBreakpointMaster(vbps.indexOf(bp.y), hbps.indexOf(bp.x), componentDescriptor);
    });
    return store;
  }

  getConfig () {
    return arr.compact(grid.map(this._breakpointMasters, (componentDescriptor, row, col) => {
      if (!componentDescriptor) return null;
      const y = this._verticalBreakpoints[row];
      const x = this._horizontalBreakpoints[col];
      if (y === 0 && x === 0) return null;
      return [pt(x, y), componentDescriptor];
    }).flat());
  }

  __serialize__ () {
    if (!arr.compact(this._breakpointMasters.flat()).every(descr => descr[Symbol.for('lively-module-meta')])) return;
    const bindings = { 'lively.graphics': ['pt'] };
    const masterStrings = this.getConfig().map(([pos, componentDescriptor]) => {
      const expr = componentDescriptor.__serialize__();
      Object.assign(bindings, expr.bindings); // FIXME: this is not a proper bindings merge
      return `[${pos.toString()}, ${expr.__expr__}]`;
    });
    if (masterStrings.length === 0) return;
    const __expr__ = `[\n${masterStrings.join(',\n')}\n]`;
    return { __expr__, bindings };
  }

  setBreakpointMaster (vi, hi, componentDescriptor) {
    grid.set(this._breakpointMasters, vi, hi, componentDescriptor);
  }

  setVerticalBreakpointMaster (idx, componentDescriptor) {
    const n = grid.getRow(this._breakpointMasters, 0)?.length || 1;
    grid.setRow(this._breakpointMasters, idx, arr.genN(n, () => componentDescriptor));
  }

  setHorizontalBreakpointMaster (idx, componentDescriptor) {
    const n = grid.getCol(this._breakpointMasters, 0)?.length || 1;
    grid.setCol(this._breakpointMasters, idx, arr.genN(n, () => componentDescriptor));
  }

  addVerticalBreakpoint (bp, componentDescriptor = null) {
    if (this._verticalBreakpoints.includes(bp)) return;
    const n = grid.getRow(this._breakpointMasters, 0)?.length || 1;
    this._verticalBreakpoints.push(bp);
    grid.addRow(this._breakpointMasters, arr.genN(n, () => componentDescriptor));
  }

  addHorizontalBreakpoint (bp, componentDescriptor = null) {
    if (this._horizontalBreakpoints.includes(bp)) return;
    const n = grid.getCol(this._breakpointMasters, 0)?.length || 1;
    this._horizontalBreakpoints.push(bp);
    grid.addCol(this._breakpointMasters, arr.genN(n, () => componentDescriptor));
  }

  removeVerticalBreakpoint (idx) {
    arr.removeAt(this._verticalBreakpoints, idx);
    grid.removeRow(this._breakpointMasters, idx);
  }

  removeHorizontalBreakpoint (idx) {
    arr.removeAt(this._horizontalBreakpoints, idx);
    grid.removeCol(this._breakpointMasters, idx);
  }

  getMatchingBreakpointMaster (targetMorph) {
    const [vbp, hbp] = this.getMatchingBreakpoint(targetMorph);
    return grid.get(this._breakpointMasters, vbp, hbp);
  }

  getMatchingBreakpoint (targetMorph) {
    const hbp = this._horizontalBreakpoints.length - 1 - this._horizontalBreakpoints.toReversed().findIndex((x) => {
      return x <= targetMorph.width;
    });
    const vbp = this._verticalBreakpoints.length - 1 - this._verticalBreakpoints.toReversed().findIndex((y) => {
      return y <= targetMorph.height;
    });
    return [vbp, hbp];
  }
}

/**
 * We use StylePolicies to implement 2 kinds of abstractions in the system:
 * 1. Component Definitions:
 *    These are top level definitions of reusable UI Elements that we can apply to morphs or use to create morphs from.
 *    We can also define new components that are derived from other components.
 * 2. Inline Style Policies:
 *    In cases where we want to reuse a particular component definition, but do not want to create
 *    a dedicated top level definition (since there is not scenario for reuse) we can insert *Inline Policies*
 *    into a component definition.
 */
export class StylePolicy {
  /**
   * Creates a new StylePolicy.
   * @param { object } spec - The structural composition of the component, similar to morphic build specs.
   * @param { StylePolicy | ComponentDescriptor } parent - The policy that we are derived from.
   * @param { boolean } [inheritStructure = true] - Wether or not we are supposed to inherit the structure of the parent policy.
   */
  constructor (spec, parent) {
    if (parent) this.parent = parent;
    this._dependants = new Set();
    this._verticalBreakpoints = [];
    this._horizontalBreakpoints = [];
    this._originalSpec = spec;
    this.spec = this.ensureStylePoliciesInSpec(spec);
    if (this.spec.isPolicy) return this.spec; // eslint-disable-line no-constructor-return
  }

  /**
   * StylePolicies usually have a parent policy they are derived from
   * except if they are are a master component completely created from scratch.
   * @returns { StylePolicy | null } The policy that we are derived from.
   */
  get parent () {
    return this._parent?.isComponentDescriptor ? this._parent.stylePolicy : this._parent;
  }

  /**
   * @type { [string] } The morph type of the root element of this policy.
   */
  get type () {
    return this.spec.type;
  }

  /**
   * @type { [string] } The name of the root element of this policy.
   */
  get name () {
    return this.spec?.name;
  }

  set name (v) {
    this.spec.name = v;
  }

  /**
   * The parent of the policy. If not overridden the `auto` master defaults to this policy.
   * We also inherit all the structure (submorphs) from this policy.
   * @type { object | StylePolicy | ComponentDescriptor }
   */
  set parent (policyOrDescriptor) {
    if (policyOrDescriptor.isPolicy || policyOrDescriptor.isComponentDescriptor) {
      this._parent = policyOrDescriptor;
    } else {
      const { auto, breakpoints } = policyOrDescriptor;
      this._parent = auto?.isComponentDescriptor ? auto.stylePolicy : auto;
      if (!this._parent && breakpoints) {
        this._parent = breakpoints[0][1].stylePolicy;
      }
      this.applyConfiguration(policyOrDescriptor);
    }
  }

  reset () {
    delete this._autoMaster;
    delete this._hoverMaster;
    delete this._clickMaster;
    delete this._localComponentStates;
    delete this._breakpointStore;
  }

  applyConfiguration (config) {
    const {
      click, hover, light, dark, breakpoints, states,
      auto, statePartitionedInline = false
    } = config;
    this._statePartitionedInline = statePartitionedInline;
    if (auto) this._autoMaster = auto.isComponentDescriptor ? auto.stylePolicy : auto;
    // mouse event component dispatch
    if (click) this._clickMaster = click.isComponentDescriptor ? click.stylePolicy : click;
    if (hover) this._hoverMaster = hover.isComponentDescriptor ? hover.stylePolicy : hover;
    // light/dark component dispatch
    if (light) this._lightModeMaster = light.isComponentDescriptor ? light.stylePolicy : light;
    if (dark) this._darkModeMaster = dark.isComponentDescriptor ? dark.stylePolicy : dark;
    // breakpoint component dispatch
    // sort them
    if (breakpoints) {
      this.setBreakpoints(breakpoints);
    }
    if (states) {
      this._localComponentStates = {};
      for (let state in states) {
        this._localComponentStates[state] = states[state]?.isComponentDescriptor ? states[state].stylePolicy : states[state];
      }
    }
  }

  get isPolicy () { return true; }

  get isEventPolicy () { return this._clickMaster || this._hoverMaster; }

  get isLightDarkModePolicy () { return this._lightModeMaster || this._darkModeMaster; }

  get isBreakpointPolicy () {
    return !!this.getBreakpointStore();
  }

  getBreakpointStore () {
    if (this._breakpointStore) return this._breakpointStore;
    return this.parent?.getBreakpointStore();
  }

  /**
   * Allows to set the breakpoints by means of pt(x,y) -> componentDescriptor
   * which allows for convenient definition of breakpoints
   * @param {type} breakpoints - Nested array of [Point, ComponentDescriptor]
   */
  setBreakpoints (breakpointSpec) {
    this._breakpointStore = BreakpointStore.from(breakpointSpec);
  }

  clearBreakpoints () { delete this._breakpointStore; }

  getMatchingBreakpointMaster (targetMorph) {
    return this.getBreakpointStore()?.getMatchingBreakpointMaster(targetMorph);
  }

  needsBreakpointUpdate (target) {
    const matchingBreakpoint = this.getMatchingBreakpointMaster(target);
    if (typeof matchingBreakpoint === 'undefined') return false;
    if (matchingBreakpoint === (target._lastBreakpoint || null)) { return false; }
    target._lastBreakpoint = matchingBreakpoint;
    return true;
  }

  /**
   * Evaluates to true, in case the policy changes its style in response to click states.
   */
  get respondsToClick () {
    if (this._clickMaster) return true;
    if (this._localComponentStates && Object.values(this._localComponentStates).find(policy => policy.respondsToClick)) return true;
    return !!this.parent?.respondsToClick;
  }

  /**
   * Sets the policy to a given component state, that takes precedence over all other
   * dispatched components (i.e. click, hover, auto ...). If we pass null,
   * we reset the component state, reverting to the normal dispatch.
   * @param { null|string} componentState - The string encoding a component state known to the policy.
   */
  setState (componentState) {
    if (this._componentState === componentState) return;
    this._componentState = componentState;
    this.targetMorph?.requestMasterStyling();
  }

  getState () {
    return this._componentState;
  }

  /**
   * Checks wether or not another policy is in the derivation chain of this
   * policy.
   */
  uses (aPolicy, immediate = false) {
    if (aPolicy.isComponentDescriptor) aPolicy = aPolicy.stylePolicy;
    if (this.parent === aPolicy) {
      return true;
    }
    if (obj.equals(
      obj.select(this.parent?.[Symbol.for('lively-module-meta')] || {}, ['moduleId', 'exportedName', 'path']),
      obj.select(aPolicy[Symbol.for('lively-module-meta')] || {}, ['moduleId', 'exportedName', 'path']))) { return true; }
    if (immediate) return false;
    if (this.parent?.uses(aPolicy)) return true;
    return false;
  }

  /**
   * Registers itself as a derived style policy at its parent.
   */
  registerAtParent () {
    const { parent } = this;
    if (parent) {
      const dependants = parent._dependants || new Set();
      dependants.add(expressionSerializer.exprStringEncode(this.__serialize__()));
      parent._dependants = dependants;
    }
  }

  get statePartitionedInline () {
    return this._statePartitionedInline || this.parent?.statePartitionedInline || this.spec.master?.statePartitionedInline;
  }

  /**
   * Evaluates to true, in case the policy changes its style in response to hover events.
   */
  get respondsToHover () {
    if (this._hoverMaster) return true;
    if (this._localComponentStates && Object.values(this._localComponentStates).find(policy => policy.respondsToHover)) return true;
    return !!this.parent?.respondsToHover;
  }

  _getSpecAsExpression (opts = {}) {
    let { __expr__: expr, bindings } = serializeSpec(this.targetMorph, {
      asExpression: true,
      keepFunctions: false,
      exposeMasterRefs: true,
      dropMorphsWithNameOnly: true,
      skipUnchangedFromDefault: true,
      skipUnchangedFromMaster: true,
      onlyIncludeStyleProps: true,
      valueTransform: standardValueTransform,
      ...opts
    }) || { __expr__: false };
    if (!expr) return;
    expr = `${expr.match(/^(morph|part)\(([^]*)\)/)?.[2] || expr}`;
    expr = expr.match(/.*\, (\{[^]*\})/)?.[1] || expr;
    if (this.parent?.[Symbol.for('lively-module-meta')]) {
      delete bindings[this.parent[Symbol.for('lively-module-meta')].exportedName];
    }
    return {
      bindings,
      __expr__: expr
    };
  }

  _generateInlineExpression () {
    const klassName = this.constructor[Symbol.for('__LivelyClassName__')];
    const parentExpr = this.parent?.__serialize__();
    let masterConfigExpr = this.getConfigAsExpression();
    if (masterConfigExpr) masterConfigExpr.__expr__ = 'master: ' + masterConfigExpr.__expr__;
    const specExpression = this._getSpecAsExpression();
    const bindings = { 'lively.morphic/components/policy.js': [klassName] };
    if (parentExpr) Object.assign(bindings, parentExpr.bindings);
    if (masterConfigExpr) Object.assign(bindings, masterConfigExpr.bindings);
    Object.assign(bindings, specExpression.bindings);
    // now we technically also need to properly serialize the spec into an expression...
    return {
      __expr__: `new ${klassName}(${specExpression.__expr__}, ${parentExpr?.__expr__ || 'null'})`,
      bindings
    };
  }

  getConfig () {
    let {
      _autoMaster: auto, _clickMaster: click, _hoverMaster: hover,
      _localComponentStates: states
    } = this;

    const breakpoints = this.getBreakpointStore()?.getConfig();
    const spec = {};
    if (auto) spec.auto = auto;
    if (click) spec.click = click;
    if (hover) spec.hover = hover;
    if (states) spec.states = states;
    if (breakpoints) spec.breakpoints = breakpoints;
    return obj.isEmpty(spec) ? null : spec;
  }

  getConfigAsExpression () {
    const {
      _autoMaster: auto, _clickMaster: click, _hoverMaster: hover,
      _localComponentStates: states
    } = this;
    const bpStore = this.getBreakpointStore();
    if (!arr.compact([auto, click, hover, ...obj.values(states)]).every(c => c[Symbol.for('lively-module-meta')])) return;
    const masters = [];
    const bindings = {};
    if (auto) masters.push(['auto', auto.__serialize__()]);
    if (click) masters.push(['click', click.__serialize__()]);
    if (hover) masters.push(['hover', hover.__serialize__()]);
    if (states) masters.push(['states', Object.entries(states).map(([state, master]) => [state, master.__serialize__()])]);

    let bps;
    if (bpStore && (bps = bpStore.__serialize__())) masters.push(['breakpoints', bps]);
    if (masters.length === 0) return;
    if (masters.length === 1 && auto) {
      return auto.__serialize__();
    }

    const printMasters = (masters) => {
      let __expr__ = '';
      for (let [name, expr] of masters) {
        let printed;
        if (obj.isArray(expr)) printed = `{\n${printMasters(expr)}}`;
        else {
          printed = expr.__expr__;
          if (!printed) continue;
          Object.assign(bindings, expr.bindings); // FIXME: this is not a proper bindings merge
        }
        __expr__ += `${name}: ${printed},\n`;
      }
      return __expr__;
    };

    const printed = printMasters(masters);
    if (printed === '') return;

    return { __expr__: `{\n${printMasters(masters)}}`, bindings };
  }

  __serialize__ () {
    const meta = this[Symbol.for('lively-module-meta')];
    if (!meta) {
      return this._generateInlineExpression();
    }
    return {
      __expr__: meta.exportedName + (meta.path.length ? `.stylePolicy.getSubSpecAt([${meta.path.map(name => JSON.stringify(name)).join(',')}])` : ''),
      bindings: { [meta.moduleId]: [meta.exportedName] }
    };
  }

  /**
   * Add meta info about module and retrieval to policy and its sub policies.
   * @param { object } metaInfo
   * @param { string } metaInfo.exportedName - The exported variable name the root policy.
   * @param { string } metaInfo.moduleId - The module id where this policy was declared in.
   * @param { string[] } metaInfo.path - If we are a sub style policy, this contains the names of the policy's parents. This info is important for expression generation and serialization.
   */
  addMetaInfo ({ exportedName, moduleId, path = [], range = false }, spec = this) {
    if (spec.isPolicy) {
      spec[Symbol.for('lively-module-meta')] = {
        exportedName, moduleId, path, range
      };

      spec.registerAtParent();
      spec = spec.spec;
    }
    for (let subSpec of spec.submorphs || []) {
      if (subSpec.COMMAND === 'add') subSpec = subSpec.props;
      this.addMetaInfo({ exportedName, moduleId, path: subSpec.isPolicy ? [...path, subSpec.name] : [...path], range }, subSpec);
    }
  }

  generateUniqueNameFor (node) {
    const type = node.type?.[Symbol.for('__LivelyClassName__')] || node.type || 'morph';
    let candidate = string.incName(type);
    while (StylePolicy.usedNames.has(candidate)) candidate = string.incName(candidate);
    StylePolicy.usedNames.add(candidate);
    return candidate;
  }

  /**
   * The main purpose of this method is to properly initialize style policies within our spec in order to reify
   * what is called "inline policies".
   * Usually, we declare an inline policy by placing a part() within one
   * of the submorph arrays in the spec we pass to component().
   * However inline policies can also be declared "implicitly".
   * Overriding the master property in one of our submorphs in the component or
   * declaring a 2nd, 3rd, etc rate inline policy is not signified by a part call. We however we still need to wrap
   * these cases. This is why this routing scans our current spec for these cases and ensures
   * they are stored as StylePolicies accordingly.
   * We also ensure the presence of "empty" style policies, that did not get adressed
   * in the derivation at all. This is mainly for the purpose of simplifying the generation
   * of build specs.
   * @param { object } spec - The spec object to scan for policies that need to be inserted.
   * @returns { object } The spec with the explicit/implicit style policies inserted.
   */
  ensureStylePoliciesInSpec (spec) {
    const klass = this.constructor;

    if (spec.master) {
      if (spec.master.isPolicy || spec.master.isComponentDescriptor) {
        this.applyConfiguration({ auto: spec.master });
      } else {
        this.applyConfiguration(spec.master);
      }
      spec = obj.dissoc(spec, ['master']);
    }
    const ensureStylePoliciesInStandalone = (spec) => {
      return tree.mapTree(spec, (node, submorphs) => {
        if (node.props) {
          if (!node.props.name) { node.props.name = this.generateUniqueNameFor(node); }
        } else if (!node.name && node !== spec) { node.name = this.generateUniqueNameFor(node); }
        if (node.isPolicy) return node.copy(); // duplicate the node to prevent in place modification or the original spec
        if (node.master) {
          return new klass({ ...node, submorphs }, null);
        }
        // The way styles are calculated right now is that we check if there is a autoMaster and if no
        // autoMaster is present (which is rare) we proceed to utilize the default value dictated by the morph class.
        // It may make sense to further dig for more "appropriate" default values by taking a look at other masters
        // such as the ones found in the breakpoints or the custom states.
        const defaultProps = !this._autoMaster?.managesMorph(node !== spec ? node.name : null) && getDefaultValuesFor(node.type || Morph) || {};

        for (let prop in defaultProps) {
          defaultProps[prop] = { isDefaultValue: true, value: defaultProps[prop] };
        }

        if (node.textAndAttributes) {
          return {
            ...defaultProps,
            ...node,
            submorphs,
            textAndAttributes: node.textAndAttributes.map(textOrAttr => {
              if (textOrAttr?.__isSpec__) {
                return ensureStylePoliciesInStandalone(textOrAttr);
              }
              return textOrAttr;
            })
          };
        }
        // also insert the default values here if not defined
        return { ...defaultProps, ...node, submorphs };
      }, node => node.submorphs || []);
    };
    // scan this.spec and detect overridden/set master props
    // or further refined style policies
    if (!this.parent) {
      return ensureStylePoliciesInStandalone(spec);
    }

    if (this.parent) {
      // we need to traverse the spec and the parent's build spec simultaneously
      const baseSpec = tree.mapTree(this.parent.spec, (node, submorphs) => {
        if (node.COMMAND === 'add') {
          node = node.props;
          if (!node.name) { node.name = this.generateUniqueNameFor(node); }
        }
        if (node.COMMAND === 'remove') return null; // drop specs that are removed

        if (node.isPolicy) {
          node._needsDerivation = true;
          return node; // this will be derived and replaced later on
        }
        node = obj.dissoc(node, ['master', 'submorphs', ...getStylePropertiesFor(node.type)]);
        if (node.textAndAttributes) {
          node.textAndAttributes = node.textAndAttributes.map(textOrAttr => {
            if (textOrAttr?.isPolicy) return new klass({}, textOrAttr);
            return textOrAttr;
          });
        }
        if (submorphs.length > 0) node.submorphs = arr.compact(submorphs);
        return node;
      }, node => node.submorphs || node.props?.submorphs || []); // get the fully collapsed spec

      const toBeReplaced = new WeakMap();
      function replace (node, replacement) {
        toBeReplaced.set(node, replacement);
      }

      const handleRemove = (parent, toBeRemoved) => {
        // insert remove command directly into the baseSpec
        replace(toBeRemoved, {
          COMMAND: 'remove',
          target: toBeRemoved.name
        });
      };

      const handleAdd = (parent, toBeAdded, before) => {
        // insert add command directly into the baseSpec
        const index = before ? parent.submorphs.indexOf(before) : parent.submorphs.length;
        if (!toBeAdded.isPolicyApplicator) {
          toBeAdded = ensureStylePoliciesInStandalone(toBeAdded);
        }
        if (!toBeAdded.name) toBeAdded.name = this.generateUniqueNameFor(toBeAdded);
        arr.pushAt(parent.submorphs, {
          COMMAND: 'add',
          props: toBeAdded
        }, index);
      };

      const overriddenMaster = this._autoMaster;
      const partitioningPolicy = overriddenMaster || this;

      const mergeSpecs = (parentSpec, localSpec) => {
        if (localSpec.textAndAttributes && parentSpec.textAndAttributes &&
            localSpec.textAndAttributes.length === parentSpec.textAndAttributes.length) {
          localSpec.textAndAttributes = arr.zip(
            localSpec.textAndAttributes,
            parentSpec.textAndAttributes).map(([localAttr, parentAttr]) => {
            if (parentAttr?.isPolicy) {
              return new klass(localAttr, parentAttr.parent);
            }
            if (parentAttr?.__isSpec__) {
              return mergeInHierarchy({ ...parentAttr }, localAttr, mergeSpecs, true, handleRemove, handleAdd);
            }
            return localAttr;
          });
        }
        // ensure the presence of all nodes
        if (localSpec === spec) {
          if (!localSpec.name && parentSpec.name) localSpec.name = parentSpec.name;
          return;
        }
        if (localSpec.isPolicy) {
          return parentSpec && replace(parentSpec, localSpec.splitBy(partitioningPolicy, parentSpec.name));
        } // do not tweak root

        let localMaster = localSpec.master;
        const overridden = overriddenMaster?.synthesizeSubSpec(localSpec.name);
        localMaster = overridden?.isPolicy && overridden || localMaster;
        delete parentSpec._needsDerivation;
        if (localMaster && parentSpec.isPolicy) {
          // rms 13.7.22 OK to get rid of the descriptor here,
          // since we are "inside" of a def which is reevaluated on change anyways.
          localMaster = localMaster.isComponentDescriptor ? localMaster.stylePolicy : localMaster; // ensure the local master
          return replace(parentSpec, new klass({ ...localSpec, master: localMaster }, parentSpec).splitBy(partitioningPolicy, parentSpec.name));
        }
        if (parentSpec.isPolicy) { // we did not introduce a master and just adjusted stuff
          return replace(parentSpec, new klass(localSpec, parentSpec).splitBy(partitioningPolicy, parentSpec.name)); // insert a different style policy that has the correct overrides
        }
        if (localMaster) { // parent spec is not a policy, and we introduced a master here
          localMaster = localMaster.isComponentDescriptor ? localMaster.stylePolicy : localMaster; // ensure the local master
          return replace(parentSpec, new klass({ ...localSpec, master: localMaster }, this.parent.extractStylePolicyFor(parentSpec.name)).splitBy(partitioningPolicy, parentSpec.name));
        }

        Object.assign(parentSpec, obj.dissoc(localSpec, ['submorphs'])); // just apply the current local spec
      };

      mergeInHierarchy(baseSpec, spec, mergeSpecs, true, handleRemove, handleAdd);

      if (baseSpec.viewModel && spec.viewModel) {
        spec.viewModel = obj.deepMerge(baseSpec.viewModel, spec.viewModel);
      }

      // post process
      const finalSpec = tree.mapTree(baseSpec, (node, submorphs) => {
        if (toBeReplaced.has(node)) return toBeReplaced.get(node);
        else {
          // this allows us to skip the unnessecary creation of an object
          if (!node.isPolicy && submorphs.length > 0) { node.submorphs = submorphs; }
          // if we encounter a node that was left untouched, we need to derive it now
          if (node.isPolicy && node._needsDerivation) {
            delete node._needsDerivation;
            const args = {};
            const overridden = overriddenMaster?.synthesizeSubSpec(node.name);
            if (overridden) args.master = overridden;
            return new klass(args, node).splitBy(partitioningPolicy, node.name);
          }
          return node;
        }
      }, node => node.submorphs || []);

      // replace the marked entries
      return {
        ...obj.dissoc(baseSpec, ['master', 'submorphs', ...getStylePropertiesFor(baseSpec.type)]),
        ...spec,
        submorphs: finalSpec.submorphs || []
      };
    }
  }

  /**
   * Turns a spec object that used to not be a style policy before into a style policy.
   * This involves traversing the parents and initializing the previously missing style policies
   * for every time the sub spec was mentioned. Note, that this process does not "alter" the parent
   * component definitions.
   * @param { string } specName - The name of the sub spec.
   * @returns { StylePolicy|null} If sub spec is found in this policy, the newly initialized style policy based on that sub spec.
   */
  extractStylePolicyFor (specName) {
    const subSpec = this.lookForMatchingSpec(specName, this._originalSpec, false);
    const klass = this.constructor;
    if (subSpec) return new klass(subSpec, this.parent ? this.parent.extractStylePolicyFor(specName) : null);
    return null;
  }

  /**
   * Creates a new morph from the fully synthesized spec.
   * @returns { Morph } The new morph based off the sully synthesized spec.
   */
  instantiate (props = {}) {
    // we may be able to avoid this explicit wrapping of the policies
    // by moving that logic into the master setter at a later stage
    const inst = morph(new PolicyApplicator(props, this).asBuildSpec()); // eslint-disable-line no-use-before-define
    // FIXME: This is temporary and should be moved into the viewModel setter after transition is complete.
    withAllViewModelsDo(inst, m => m.viewModel.attach(m));
    return inst;
  }

  /**
   * Synthesizes all contained sub specs up to the first level overridden props,
   * in order to create a build spec that can be used to create a new morph hierarchy.
   * Optionally we can also create the build spec in such a way, that a morph representation
   * of the master component can be generated.
   * Discarding of the style properties can be useful, when we want to
   * utilize this spec to generate source code for component definitions.
   * @param { boolean } asComponent - Wether or not the morph spec should yield an instance or the master component itself.
   * @return { object } The build spec.
   */
  asBuildSpec (asComponent = false) {
    const extractBuildSpecs = (specOrPolicy, submorphs) => {
      if (specOrPolicy.COMMAND === 'add') {
        specOrPolicy = specOrPolicy.props;
      }
      if (specOrPolicy.COMMAND === 'remove') return null; // target is already removed so just ignore the command
      if (specOrPolicy.isPolicy) return specOrPolicy.asBuildSpec(asComponent);
      const modelClass = specOrPolicy.defaultViewModel || specOrPolicy.viewModelClass;
      const modelParams = { ...specOrPolicy.viewModel } || {}; // accumulate the derivation chain for the viewModel
      specOrPolicy = obj.dissoc(specOrPolicy, ['submorphs', 'defaultViewModel', 'viewModelClass', 'viewModel',
        ...this.parent ? getStylePropertiesFor(specOrPolicy.type) : []
      ]);
      if (!this.parent) {
        // remove the props that are equal to the default value
        getStylePropertiesFor(specOrPolicy.type).forEach(prop => {
          if (specOrPolicy[prop]?.isDefaultValue) {
            delete specOrPolicy[prop];
          }
        });
      }
      // special handling for text attributes
      if (specOrPolicy.textString) {
        specOrPolicy.textAndAttributes = specOrPolicy.textAndAttributes || [specOrPolicy.textString, null];
        delete specOrPolicy.textString;
      }
      if (specOrPolicy.textAndAttributes) {
        specOrPolicy.textAndAttributes = specOrPolicy.textAndAttributes.map(textOrAttr => {
          if (textOrAttr?.__isSpec__) return morph(tree.mapTree(textOrAttr, extractBuildSpecs, node => node.submorphs)); // ensure sub build specs...
          if (textOrAttr?.isPolicy) return textOrAttr.instantiate();
          return textOrAttr;
        });
      }
      if (specOrPolicy.layout) specOrPolicy.layout = specOrPolicy.layout.copy();
      if (submorphs.length > 0) {
        let transformedSubmorphs = submorphs.filter(spec => spec && !spec.__before__);
        for (let spec of submorphs) {
          if (spec?.__before__ !== undefined) {
            {
              const idx = transformedSubmorphs.findIndex(m => m.name === spec.__before__);
              arr.pushAt(transformedSubmorphs, spec, idx);
              delete spec.__before__;
            }
          }
        }
        specOrPolicy.submorphs = transformedSubmorphs;
      }
      if (modelClass) specOrPolicy.viewModel = new modelClass(modelParams);

      if (!specOrPolicy.isPolicy) return sanitizeSpec(specOrPolicy);

      return specOrPolicy;
    };
    const buildSpec = tree.mapTree(this.spec, extractBuildSpecs, node => node.props?.submorphs || node.submorphs);
    if (this.__wasAddedToDerived__) buildSpec.__wasAddedToDerived__ = true;
    buildSpec.master = this;
    return buildSpec;
  }

  /**
   * Returns the appropriate next level master based on the target morph's event state.
   * @param { Morph } targetMorph - The target morph to base the component dispatch on.
   * @returns { StylePolicy } The appropriate policy for the dispatch.
   */
  determineMaster (targetMorph) {
    let qualifyingMaster = this.dispatchMaster(targetMorph);

    if (qualifyingMaster?.isComponentDescriptor) { // top level component definition referenced
      qualifyingMaster = qualifyingMaster.stylePolicy;
    }
    return qualifyingMaster;
  }

  dispatchMaster (targetMorph) {
    const defaultMaster = this._autoMaster || this._parent;
    if (!targetMorph) return defaultMaster; // best guess

    const {
      isHovered,
      isClicked,
      mode,
      breakpointMaster,
      stateMaster
    } = getEventState(targetMorph, this.getBreakpointStore(), this._localComponentStates);

    if (stateMaster) return stateMaster;

    if (breakpointMaster) targetMorph._lastBreakpoint = breakpointMaster;

    if (this.isEventPolicy) {
      if (isClicked && this._clickMaster) return this._clickMaster;
      if (isHovered && this._hoverMaster) return this._hoverMaster;
    }

    if (this.isLightDarkModePolicy) {
      switch (mode) {
        case 'dark':
          return this._darkModeMaster;
        case 'light':
          return this._lightModeMaster;
        default:
          return defaultMaster;
      }
    }

    if (breakpointMaster) {
      return breakpointMaster;
    }

    return defaultMaster; // default to the parent if we are neither of the above
  }

  /**
   * Synthesizes the sub spec corresponding to a particular name
   * of a morph in the submorph hierarchy.
   * @param { string } submorphNameInPolicyContext - The name of the sub spec.
   * @param { Morph } ownerOfScope - The top morph for the scope of the policy we synthesize the spec for. This allows us to gather information for dispatching between differnt style policies based on the event state (hover, click).
   * @returns { object } The synthesized spec.
   */
  synthesizeSubSpec (submorphNameInPolicyContext, ownerOfScope, previousTarget) {
    const isRoot = !submorphNameInPolicyContext;
    const transformProps = ['extent', 'position', 'rotation', 'scale', 'lineHeight'];
    let subSpec = this.getSubSpecFor(submorphNameInPolicyContext) || {}; // get the sub spec for the submorphInPolicyContext

    if (subSpec.isPolicy) {
      return subSpec;
    }

    // regardless, we always need to factor in the parent spec as well
    let qualifyingMaster = this.determineMaster(this.statePartitionedInline ? previousTarget : ownerOfScope);

    if (!qualifyingMaster) {
      return { ...subSpec };
    }

    if (qualifyingMaster.isComponentDescriptor) { // top level component definition referenced
      qualifyingMaster = qualifyingMaster.stylePolicy;
    }

    const requiresPropsFromParent = qualifyingMaster && this.parent && qualifyingMaster !== this.parent;

    let nextLevelSpec = qualifyingMaster.synthesizeSubSpec(submorphNameInPolicyContext, ownerOfScope, previousTarget);
    if (nextLevelSpec.isPolicy) return nextLevelSpec;

    let parentSpec = {};
    if (requiresPropsFromParent) {
      parentSpec = this.parent.synthesizeSubSpec(submorphNameInPolicyContext, ownerOfScope, previousTarget);
    }

    if (isRoot) {
      for (let prop of transformProps) {
        if (parentSpec[prop]) delete nextLevelSpec[prop];
      }
    }

    let synthesized = {};

    delete parentSpec.__wasAddedToDerived__;
    delete nextLevelSpec.__wasAddedToDerived__;

    for (let prop in subSpec) {
      if (subSpec[prop]?.isDefaultValue) synthesized[prop] = subSpec[prop];
    }

    Object.assign(
      synthesized,
      parentSpec,
      nextLevelSpec);

    for (let prop in subSpec) {
      if (!subSpec[prop]?.isDefaultValue) synthesized[prop] = subSpec[prop];
    }

    delete synthesized.submorphs;
    delete synthesized.master;
    delete synthesized.name;

    return handleTextProps(synthesized);
  }

  /**
   * Returns the sub spec object within the scope of the style policy that matches this particular name.
   * @param { string | null } submorphName - The submorph name for which to find the corresponding sub spec. If null, assume we ask for root.
   * @returns { object } The sub spec corresponding to that name.
   */
  getSubSpecFor (submorphName, includeWithoutCalls = false, unwrapAddCalls = true) {
    if (!submorphName) return this.spec; // assume we ask for root
    let embeddedRes;

    let matchingNode = this.lookForMatchingSpec(submorphName, this.spec, includeWithoutCalls);
    if (embeddedRes) matchingNode = embeddedRes;
    return matchingNode ? (unwrapAddCalls && matchingNode.props) || matchingNode : null;
  }

  /**
   * Analogous to getSubSpecFor but is able to traverse multiple policy scopes
   * by providing the owner policy names that precede the sub spec name.
   * @param { string[] } path - The names of the parents to ending with the final sub spec or policy to be retrieved.
   * @returns { StylePolicy|object }
   */
  getSubSpecAt (path, includeWithoutCalls = false, unwrapAddCalls = true) {
    if (path.length === 0) return this;
    let curr = this.getSubSpecFor(path.shift(), includeWithoutCalls, unwrapAddCalls);
    if (curr && path.length > 0) return curr.getSubSpecAt(path, includeWithoutCalls, unwrapAddCalls);
    return curr;
  }

  /**
   * Convenience method, that allows us to directly retrieve sub specs
   * that style a particular morph.
   * @param {Morph} aMorph - The morph that is being styled by a spec.
   * @returns {Object|StylePolicy} The spec or style policy in question.
   */
  getSubSpecCorrespondingTo (aMorph) {
    if (aMorph === this.targetMorph) return this; // not need to search
    try {
      return this.getSubSpecAt([...aMorph.ownerChain().filter(m => m.master && !m.isComponent).map(m => m.name).reverse(), aMorph.name]);
    } catch (err) {
      return null;
    }
  }

  /**
   * Convenience method that retrieves the (sub) policy which controls the hierarchy the morph is embedded in.
   * @param {Morph} aMorph - The morph whose scope policy we are interested in.
   * @returns {StylePolicy} The policy in question.
   */
  getSubPolicyFor (aMorph) {
    const isRoot = aMorph.isComponent || this.targetMorph === aMorph;
    if (isRoot) return this;
    while (aMorph && !aMorph.master && aMorph.owner) aMorph = aMorph.owner;
    return this.getSubSpecCorrespondingTo(aMorph);
  }

  splitBy (partitioningPolicy, submorphName) {
    const {
      _autoMaster, parent, _clickMaster, _hoverMaster,
      _localComponentStates
    } = partitioningPolicy;
    const auto = (_autoMaster || parent)?.getSubSpecFor(submorphName);
    const click = _clickMaster?.getSubSpecFor(submorphName);
    const hover = _hoverMaster?.getSubSpecFor(submorphName);
    const breakpoints = partitioningPolicy._breakpointStore?.getConfig();
    let states;
    for (let state in _localComponentStates) {
      if (!states) states = {};
      states[state] = _localComponentStates[state].getSubSpecFor(submorphName);
    }
    const statePartitionedInline = !!(click || hover || states);
    if (!statePartitionedInline) return this;
    return new this.constructor(this.spec, {
      auto, click, hover, states, statePartitionedInline, breakpoints
    });
  }

  copy () {
    const masterConfig = this.getConfig();
    const policyCopy = new this.constructor({
      ...this._originalSpec,
      ...masterConfig
        ? {
            master: masterConfig
          }
        : {}
    }, this.parent);

    if (this[Symbol.for('lively-module-meta')]) { policyCopy.addMetaInfo(this[Symbol.for('lively-module-meta')]); }
    return policyCopy;
  }

  /**
   * Returns wether or not a morph of a given name is managed by this policy.
   * @param { string } nameOfMorph - The name of the morph in question.
   */
  managesMorph (nameOrMorph) {
    if (!nameOrMorph) return true;
    if (nameOrMorph.isMorph) {
      if (this.targetMorph === nameOrMorph) return true;
      const relativePath = [nameOrMorph.name];
      for (let m of nameOrMorph.ownerChain()) {
        if (m.master) {
          if (m.master === this) break;
          return false;
        }
        relativePath.push(m.name);
      }
      let curr = this.spec;
      while (curr && relativePath.length) {
        const name = relativePath.pop();
        curr = curr.submorphs?.find(m => m.name === name);
      }
      return !!curr;
    }
    return !!tree.find(this.spec, node => node.name === nameOrMorph, node => node.submorphs);
  }

  /**
   * Check wether or not a particular morph is actively positioned by a comprising layout.
   * @param {Morph} aSubmorph - The morph to check for.
   * @returns { boolean } Wether or not the morph's position is by a layout.
   */
  isPositionedByLayout (aSubmorph) {
    const layout = aSubmorph.owner?.layout;
    return layout?.name() !== 'Constraint' && layout?.layoutableSubmorphs?.includes(aSubmorph);
  }

  /**
   * Check wether or not a particular morph is actively resized by a comprising layout.
   * @param {Morph} aSubmorph - The morph to check for.
   * @returns { boolean | object } Wether or not size is controlled via layout and if so, the concrete policy.
   */
  isResizedByLayout (aSubmorph) {
    const layout = aSubmorph.owner && aSubmorph.owner.layout;
    if (!layout) return false;
    if (layout.resizePolicies) {
      const heightPolicy = layout.getResizeHeightPolicyFor(aSubmorph);
      const widthPolicy = layout.getResizeWidthPolicyFor(aSubmorph);
      if (heightPolicy === 'fill' || widthPolicy === 'fill') return { widthPolicy, heightPolicy };
    }
    return false;
  }

  /**
   * Returns a spec inside the scope of the policy,
   * that matches the given `specName`.
   */
  lookForMatchingSpec (specName, spec = this.spec, includeWithoutCall = false) {
    let embeddedRes;
    return tree.find(spec, node => {
      // handle added morphs
      if (includeWithoutCall && node.COMMAND === 'remove') return node.target === specName;
      if (node.COMMAND === 'add') return node.props.name === specName;
      // handle text and attributes (embedded morphs)
      if (node.textAndAttributes?.find(textOrAttr => {
        if (embeddedRes) return;
        if (textOrAttr?.__isSpec__) embeddedRes = this.lookForMatchingSpec(specName, textOrAttr);
        if (textOrAttr?.isPolicy && textOrAttr?.name === specName) embeddedRes = textOrAttr;
      })) return !!embeddedRes;
      // handle "normal" case
      return node.name === specName;
    }, node => node.submorphs || node.props?.submorphs) || null;
  }
}

/**
 * While we use StylePolicy to model the component definitions
 * themselves, we need something a little different, when we turn
 * to actual morphs and their respective master component policies.
 * Compared to StylePolices, the PolicyApplicator is able to dynamically
 * detect overridden props, with respect to changes in the morph props.
 * PolicyApplicator serializes to a form, where overridden props (which vary
 * from a case by case basis) are serialized as well.
 * Can be derived from either a StylePolicy OR ComponentDescriptor.
 * Knows, how it can be applied to a morph hierarchy!
 */
export class PolicyApplicator extends StylePolicy {
  static for (derivedMorph, args, parent) {
    let newPolicy;

    if (args.constructor === PolicyApplicator) {
      newPolicy = args;
    } else if (args.isComponentDescriptor && args.stylePolicy) {
      newPolicy = new this({}, { auto: args });
    } else if (args.constructor === StylePolicy) {
      newPolicy = new this({}, args);
    } else if (arr.isSubset(obj.keys(args), ['auto', 'hover', 'click', 'states', 'breakpoints'])) {
      newPolicy = new this({}, { auto: parent, ...args });
    }

    return newPolicy;
  }

  get isPolicyApplicator () { return true; }

  toString () { return '<PolicyApplicator>'; }

  // APPLICATION TO MORPH HIERARCHIES

  attach (targetMorph) {
    this.targetMorph = targetMorph;
  }

  /**
   * Given a target morph, traverse the submorph hierarchy
   * covering the policy's scope and apply the style properties
   * according to the synthesized sub spec.
   * At the border of the scope, we in turn ask the encountered style policies
   * to apply themselves to the remainder of the submorph hierarchy.
   * @param { Morph } targetMorph - The root morph of the hierarchy.
   */
  apply (targetMorph, previousTarget) {
    targetMorph.withMetaDo({ metaInteraction: true }, () => {
      this.withSubmorphsInScopeDo(targetMorph, morphInScope => {
        let submorphName = null;
        if (morphInScope !== targetMorph) submorphName = morphInScope.name;
        const synthesizedSpec = this.synthesizeSubSpec(submorphName, targetMorph, previousTarget, false);
        if (obj.isEmpty(synthesizedSpec)) return;
        if (synthesizedSpec.isPolicy) {
          if (morphInScope._skipMasterReplacement) {
            delete morphInScope._skipMasterReplacement;
            return;
          }
          morphInScope.setProperty('master', synthesizedSpec); // might be redundant
          synthesizedSpec.targetMorph = morphInScope;
        } else this.applySpecToMorph(morphInScope, synthesizedSpec); // this step enforces the master distribution

        if (morphInScope !== targetMorph && morphInScope.master) {
          morphInScope._requestMasterStyling = false;
          return morphInScope.master.apply(morphInScope, targetMorph); // let the policy handle the traversal
        }
      });
    });
  }

  synthesizeSubSpec (submorphNameInPolicyContext, parentOfScope, previousTarget) {
    const subSpec = super.synthesizeSubSpec(submorphNameInPolicyContext, parentOfScope, previousTarget);
    if (subSpec.isPolicy && !subSpec.isPolicyApplicator) {
      return new PolicyApplicator({}, subSpec);
    }
    return subSpec;
  }

  applyIfNeeded (needsUpdate = false, animationConfig = false) {
    const needsApplication = needsUpdate && !!this.targetMorph;
    if (!needsApplication) return;
    const superMaster = arr.findAndGet(this.targetMorph.ownerChain(), m => m.master);
    const previousTarget = superMaster?.managesMorph(this.targetMorph.name) && superMaster.targetMorph;
    if (animationConfig) {
      let resolve, animationPromise;
      ({ promise: animationPromise, resolve } = promise.deferred());
      this._animating = animationPromise;
      this.targetMorph.withAnimationDo(() => this.apply(this.targetMorph, previousTarget), animationConfig).then(async () => {
        while (animationPromise !== this._animating) {
          animationPromise = this._animating;
          await this._animating;
        }
        this._animating = false;
        resolve(true);
      });
      return this._animating;
    }
    if (!this._animating) {
      this.apply(this.targetMorph, previousTarget);
    }
  }

  async whenApplied () {
    // do nothing
  }

  applyAnimated (config = { duration: 1000 }) {
    return this.applyIfNeeded(true, config);
  }

  /**
   * For a particular morph, handle the application of a set of style properties.
   * Aside from proper order of application, this method also attempts to avoid
   * redundant or unnessecary property applications.
   * @param { Morph } morphToBeStyled - The morph we apply the props to.
   * @param { object } styleProps - The props to be applied as key,value pairs.
   * @param { boolean } isRoot - Wether or not this is the top most morph in the policy scope.
   */
  applySpecToMorph (morphToBeStyled, styleProps) {
    if (styleProps.__wasAddedToDerived__) morphToBeStyled.__wasAddedToDerived__ = true;
    styleProps = sanitizeSpec(styleProps);
    for (const propName of getStylePropertiesFor(morphToBeStyled.constructor)) {
      let propValue = styleProps[propName];
      if (propValue === skippedValue) continue;
      if (propValue === undefined) {
        if (PROPS_TO_RESET.includes(propName)) {
          propValue = getDefaultValueFor(morphToBeStyled.constructor, propName);
        }
        if (propValue === undefined) continue;
      }
      if (propName === 'layout') {
        if (morphToBeStyled.layout?.name() === propValue?.name() &&
            morphToBeStyled.layout?.equals(propValue) &&
            (!this._animating || !this._animating === !!propValue.renderViaCSS)
        ) { continue; }
        let lv = propValue ? propValue.copy() : undefined;
        if (this._animating) {
          const origCSS = lv.renderViaCSS;
          lv = lv.with({ renderViaCSS: false });
          lv.lastAnim = morphToBeStyled.layout?.lastAnim;
          lv.applyRequests = morphToBeStyled.layout?.applyRequests;
          this._animating.then(() =>
            morphToBeStyled.withMetaDo({ metaInteraction: true }, () => {
              morphToBeStyled.layout = lv.with({ renderViaCSS: origCSS });
            }));
        }
        morphToBeStyled.layout = lv;
        continue;
      }

      if (this.isPositionedByLayout(morphToBeStyled) && propName === 'position') continue;
      let resizePolicy;
      if (propName === 'extent' && (resizePolicy = this.isResizedByLayout(morphToBeStyled))) {
        if (resizePolicy.widthPolicy === 'fixed' && morphToBeStyled.width !== propValue.x) morphToBeStyled.width = propValue.x;
        if (resizePolicy.heightPolicy === 'fixed' && morphToBeStyled.height !== propValue.y) morphToBeStyled.height = propValue.y;
        continue;
      }

      if (morphToBeStyled.isComponent) {
        if (propName === 'extent' &&
            !morphToBeStyled.extent.equals(pt(10, 10)) &&
            (!morphToBeStyled.owner ||
             morphToBeStyled.owner.isWorld ||
             morphToBeStyled.ownerChain().find(m => m.master && m.master.managesMorph(morphToBeStyled.name)))
        // not already styled by other master
        ) continue;
        if (propName === 'position') continue;
      }

      // FIXME: other special cases??
      if (morphToBeStyled.isText &&
          !morphToBeStyled.fixedWidth &&
          !morphToBeStyled.fixedHeight &&
          propName === 'extent') continue;

      if (['border', 'borderTop', 'borderBottom', 'borderRight', 'borderLeft'].includes(propName)) continue; // handled by sub props;

      if (!obj.equals(morphToBeStyled[propName], propValue)) {
        morphToBeStyled[propName] = propValue;
      }

      // we may be late for the game when setting these props
      // se we need to make sure, we restore the morphs "intended extent"
      // for this purpose we enforce the masterSubmorph extent
      if (['fixedHeight', 'fixedWidth'].includes(propName) &&
          morphToBeStyled._parametrizedProps?.extent) {
        morphToBeStyled.extent = morphToBeStyled._parametrizedProps.extent;
      }
    }
  }

  /**
   * Traverse all the submorphs within the scope of the component policy.
   * @param { Morph } parentOfScope - The morph that sits at the top of the policy scope.
   * @param { function } cb - The callback function to invoke for each of the morphs in the scope.
   */
  withSubmorphsInScopeDo (parentOfScope, cb) {
    return parentOfScope.withAllSubmorphsDoExcluding(cb, m => parentOfScope !== m && (m.master || m.isComponent));
  }

  get isStaleComponentContext () {
    return [this.targetMorph, ...this.targetMorph.ownerChain()].find(m => m.isComponent && !m.viewModel?.view);
  }

  /**
   * Callback that is invoked once a morph that is managed by the applicator changes.
   * In general this means that if the change is a style property, we override this style prop locally.
   * @param { Morph } changedMorph - The morph the change applies to.
   * @param { object } change - The change object
   */
  onMorphChange (changedMorph, change) {
    if (change.meta?.metaInteraction ||
        !this.targetMorph ||
        !![
          changedMorph,
          ...changedMorph.ownerChain()
        ].find(m => m.master?._animating)
    ) return;
    if (changedMorph._isDeserializing) return;
    if (this.isStaleComponentContext) return;
    if (change.value === this) return;

    let subSpec = this.ensureSubSpecFor(changedMorph);
    if (!subSpec) return;
    if (subSpec?.isPolicyApplicator) {
      return subSpec.onMorphChange(changedMorph, change);
    }

    if (this[Symbol.for('lively-module-meta')]) return;

    if (getStylePropertiesFor(changedMorph.constructor).includes(change.prop)) {
      subSpec[change.prop] = skippedValue;
    }
    if (change.prop === 'extent') {
      if (change.value.y !== change.prevValue.y) subSpec.height = skippedValue;
      if (change.value.x !== change.prevValue.x) subSpec.width = skippedValue;
    }
  }

  /**
   * Scans the master component derivation chain in order to
   * determine the path to the sub spec that is then created
   * on the spot. If the a morph with this name was never mentioned
   * in the derivation chain, we return an empty object.
   * @param { string } submorphName - The name of the sub spec. If ambiguous the first one starting from root is picked.
   */
  ensureSubSpecFor (submorph, wrapAsAdded = false) {
    const isRoot = this.targetMorph === submorph || submorph.isComponent;
    const targetName = isRoot ? null : submorph.name;
    let currSpec = this.getSubSpecFor(targetName);
    if (currSpec) return currSpec;

    // spec could not be found, so we prepare for inserting a spec
    currSpec = submorph.master || { };
    currSpec.name = submorph.name;
    if (this.parent && !this.mentionedByParents(targetName)) {
      // if we have a parent policy, this means we are derived
      // and if none of our parents mentioned a morph with this name
      // that means it needs to be wrapped as added in order to be added
      // to this policy. If we declare the spec not to be wrapped as added,
      // something is wrong.
      if (!wrapAsAdded) return currSpec;
    }
    const parentSpecOrPolicy = this.ensureSubSpecFor(submorph.owner);
    let parentSpec;
    if (parentSpecOrPolicy.isPolicy) parentSpec = parentSpecOrPolicy.spec;
    else parentSpec = parentSpecOrPolicy;
    const { submorphs = [] } = parentSpec;
    if (wrapAsAdded) currSpec = add(currSpec);
    submorphs.push(currSpec);
    parentSpec.submorphs = submorphs;
    return currSpec;
  }

  /**
   * Assumes the addedMorph is not yet reflected in the spec.
   * @param { Morph } addedMorph - The morph that was added and prompt the clear the without() call
   */
  removeWithoutCall (addedMorph) {
    let parentSpec = this.getSubSpecCorrespondingTo(addedMorph.owner);
    if (parentSpec.isPolicy) parentSpec = parentSpec.spec;
    const withoutCallSpec = this.getSubPolicyFor(addedMorph.owner)?.getSubSpecFor(addedMorph.name, true);

    if (parentSpec && withoutCallSpec) {
      arr.remove(parentSpec.submorphs, withoutCallSpec);
    }
  }

  removeSpecInResponseTo (removeChange, insertRemoveIfNeeded = true) {
    const { target: prevOwner, args: [removedMorph] } = removeChange;
    // at any rate, remove the sub spec if present
    let ownerSpec = this.getSubPolicyFor(prevOwner)?.ensureSubSpecFor(prevOwner);
    if (!ownerSpec) return; // nothing to remove
    if (ownerSpec.isPolicyApplicator) ownerSpec = ownerSpec.spec;
    const removedMorphSpec = ownerSpec.submorphs?.find(spec => (spec.props?.name || spec.name) === removedMorph.name);
    if (removedMorphSpec) {
      arr.remove(ownerSpec.submorphs, removedMorphSpec);
    }
    if (insertRemoveIfNeeded && !removedMorph.__wasAddedToDerived__) {
      // insert the without call, but only for non propagation changes
      if (!ownerSpec.submorphs) ownerSpec.submorphs = [];
      ownerSpec.submorphs.push(without(removedMorph.name));
    }

    return removedMorphSpec?.props || removedMorphSpec;
  }

  /**
   * Checks if the submorph name was mentioned by any of the parent policies if present
   * @param { string } submorphNameInPolicyContext - The name of the submorph to be checked for being mentioned.
   * @returns { boolean } Wether or not the a sub spec for the given name could be found in the derivation chain.
   */
  mentionedByParents (submorphNameInPolicyContext) {
    let mentioned = false; let parent = this;
    while ((parent = parent.parent) && !mentioned) {
      mentioned = !!parent.getSubSpecFor(submorphNameInPolicyContext);
    }
    return mentioned;
  }

  /**
   * Given two a morph, ensure that a subspec be present, if its mentioned in the structural derivation chain.
   * @param { Morph } aMorph - The morph in question.
   * @returns { object|null } If mentioned, the corresponding sub spec.
   */
  insertSpecIfMentioned (aMorph) {
    if (this.mentionedByParents(aMorph.name)) {
      return this.ensureSubSpecFor(aMorph);
    }
    return null;
  }

  adoptOverriddenPropsFrom (otherPolicy) {
    mergeInHierarchy(this.spec, otherPolicy.spec, (localSpec, otherSpec) => {
      if (localSpec.isPolicy && otherSpec.isPolicy) {
        localSpec.adoptOverriddenPropsFrom(otherSpec);
      }
      for (let prop of arr.intersect(obj.keys(otherSpec), getStylePropertiesFor(otherSpec.type))) {
        localSpec[prop] = otherSpec[prop];
      }
    });
  }

  ensureNoNameCollisionInDerived (nameCandidate, descriptor, skip = false) {
    // check if there is a spec in the scope, that has the name of the addedMorph already
    const generateAlternativeName = (conflictingName) => {
      return string.incName(conflictingName);
    };

    const originalCandidate = nameCandidate;
    let conflictingSpec = this.lookForMatchingSpec(nameCandidate);
    if (!skip && conflictingSpec) {
      return this.ensureNoNameCollisionInDerived(generateAlternativeName(nameCandidate), descriptor);
    }
    if (descriptor) {
      descriptor.withDerivedComponentsDo(descr => {
        nameCandidate = descr.ensureNoNameCollisionInDerived(nameCandidate);
      });
    }
    // after running through all of these ensure that we are still OK with the outcome
    if (nameCandidate === originalCandidate) return nameCandidate;
    conflictingSpec = this.lookForMatchingSpec(nameCandidate);
    if (conflictingSpec) {
      return this.ensureNoNameCollisionInDerived(generateAlternativeName(nameCandidate), descriptor);
    }
    return nameCandidate;
  }
}
