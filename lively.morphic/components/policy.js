import { arr, string, tree, promise, obj } from 'lively.lang';
import { pt } from 'lively.graphics';
import { morph, getStylePropertiesFor, getDefaultValueFor } from '../helpers.js';

const skippedValue = Symbol.for('lively.skip-property');
const PROPS_TO_RESET = ['dropShadow', 'fill', 'opacity', 'borderWidth', 'fontColor'];

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
function getEventState (targetMorph, customBreakpoints) {
  if (!customBreakpoints) customBreakpoints = [];
  const { world, eventDispatcher } = targetMorph.env;
  const mode = world && world.colorScheme; // "dark" | "light"
  const isHovered = eventDispatcher && eventDispatcher.isMorphHovered(targetMorph); // bool
  const isClicked = eventDispatcher && isHovered && eventDispatcher.isMorphClicked(targetMorph); // bool
  const matchingBreakpoint = customBreakpoints.find(bp => {
    if (bp.minWidth || bp.maxWidth) {
      const { minWidth = -Infinity, maxWidth = Infinity } = bp;
      return minWidth <= targetMorph.width && targetMorph.width < maxWidth;
    }
    if (bp.minHeight || bp.maxHeight) {
      const { minHeight = -Infinity, maxHeight = Infinity } = bp;
      return minHeight <= targetMorph.height && targetMorph.height < maxHeight;
    }
  });
  return {
    matchingBreakpoint: matchingBreakpoint && matchingBreakpoint.master,
    mode,
    isHovered,
    isClicked
  };
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
  constructor (spec, parent, inheritStructure = true) {
    if (parent) this.parent = parent;
    this.inheritStructure = inheritStructure;
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
    return this.spec.name;
  }

  set name (s) {
    this.spec.name = s;
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
      const { click, hover, light, dark, breakpoints, auto = this._parent } = policyOrDescriptor;
      this._parent = auto;
      this._autoMaster = auto;

      // mouse event component dispatch
      if (click) this._clickMaster = click;
      if (hover) this._hoverMaster = hover;
      // light/dark component dispatch
      if (light) this._lightModeMaster = light;
      if (dark) this._darkModeMaster = dark;
      // breakpoint component dispatch
      if (breakpoints) this._breakpointMasters = breakpoints;
    }
  }

  get isPolicy () { return true; }

  get isEventPolicy () { return this._clickMaster || this._hoverMaster; }

  get isLightDarkModePolicy () { return this._lightModeMaster || this._darkModeMaster; }

  get isBreakpointPolicy () { return !!this._breakpointMasters; }

  /**
   * Evaluates to true, in case the policy changes its style in response to click states.
   */
  get respondsToClick () {
    if (this._clickMaster) return true;
    if (this.spec.master?.click) return true;
    return !!this.parent?.respondsToClick || !!this.overriddenMaster?.respondsToHover;
  }

  /**
   * Evaluates to true, in case the policy changes its style in response to hover events.
   */
  get respondsToHover () {
    if (this._hoverMaster) return true;
    if (this.spec.master?.hover) return true;
    return !!this.parent?.respondsToHover || !!this.overriddenMaster?.respondsToHover;
  }

  /**
   * If there is a locally overridden master in the parent of the scope,
   * it is retrievable via this property.
   * @type { StylePolicy | undefined }
   */
  get overriddenMaster () {
    const overridden = this._getOverriddenMaster(this.spec, this);
    if (overridden && overridden === this) return null; // prevent loops
    if (overridden?.isComponentDescriptor) {
      return overridden.stylePolicy;
    }
    return overridden;
  }

  _getOverriddenMaster (spec, localMaster) {
    let inlineMaster = spec.master?.stylePolicy || spec.master;
    if (inlineMaster && arr.isSubset(obj.keys(inlineMaster), ['click', 'auto', 'hover']) && !inlineMaster.auto) {
      inlineMaster.auto = localMaster.parent; // ensure auto is present
    }
    if (inlineMaster && !inlineMaster.isPolicy) return new PolicyApplicator({}, inlineMaster); // eslint-disable-line no-use-before-define
    return inlineMaster;
  }

  __serialize__ (pool) {
    const meta = this[Symbol.for('lively-module-meta')];
    if (!meta) return;
    return pool.expressionSerializer.exprStringEncode({
      __expr__: meta.exportedName + (meta.path.length ? `.stylePolicy.getSubSpecAt(${meta.path.map(name => JSON.stringify(name)).join(',')})` : '.stylePolicy'),
      bindings: { [meta.moduleId]: meta.exportedName }
    });
  }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    if (this.parent) {
      addFn('parent', this.parent.__serialize__(pool));
    }
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
      spec = spec.spec;
    }
    for (let subSpec of spec.submorphs || []) {
      if (subSpec.COMMAND === 'add') subSpec = subSpec.props;
      this.addMetaInfo({ exportedName, moduleId, path: subSpec.isPolicy ? [...path, subSpec.spec?.name] : path }, subSpec);
    }
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
    const overriddenMaster = this._getOverriddenMaster(spec, this);
    const getLocalMaster = (name) => {
      const localMaster = overriddenMaster && overriddenMaster.getSubSpecFor(name);
      if (localMaster && !localMaster.isPolicy && !localMaster.isComponentDescriptor) return false;
      return localMaster;
    };
    const ensureStylePoliciesInStandalone = (spec) => {
      return tree.mapTree(spec, (node, submorphs) => {
        if (!node.name) { node.name = string.newUUID(); }
        morph.usedNames.add(node.name);
        if (node.isPolicy) return node;
        if (node.master && node !== spec) {
          return new klass({ ...obj.dissoc(node, ['master']), submorphs }, node.master, false);
        }
        if (node.master) {
          return new klass({ ...obj.dissoc(node, ['master']), submorphs }, node.master, false);
        }
        if (node.textAndAttributes) {
          return {
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
        return { ...node, submorphs };
      }, node => node.submorphs || []);
    };
    // scan this.spec and detect overridden/set master props
    // or further refined style policies
    if (!this.parent || !this.inheritStructure) {
      return ensureStylePoliciesInStandalone(spec);
    }

    if (this.parent) {
      // we need to traverse the spec and the parent's build spec simultaneously
      const baseSpec = tree.mapTree(this.parent.spec, (node, submorphs) => {
        if (node.COMMAND === 'add') node = node.props;
        if (node.COMMAND === 'remove') return null;

        let localMaster = getLocalMaster(node.name || node.spec?.name);
        if (node.isPolicy) {
          // create new empty policy, which in turn handles the futher traversal internally
          return new klass(localMaster ? { master: localMaster } : {}, node);
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
        arr.pushAt(parent.submorphs, {
          COMMAND: 'add',
          props: toBeAdded
        }, index);
      };

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
          if (!localSpec.name) localSpec.name = parentSpec.name;
          return;
        }
        if (localSpec.isPolicy) {
          return;
        } // do not tweak root

        let localMaster = localSpec.master || getLocalMaster(parentSpec.name);
        if (localMaster && parentSpec.isPolicy) {
          // rms 13.7.22 OK to get rid of the descriptor here,
          // since we are "inside" of a def which is reevaluated on change anyways.
          localMaster = localMaster.isComponentDescriptor ? localMaster.stylePolicy : localMaster; // ensure the local master
          return replace(parentSpec, new klass({ ...localSpec, master: localMaster }, parentSpec.parent));
        }
        if (localMaster) {
          localMaster = localMaster.isComponentDescriptor ? localMaster.stylePolicy : localMaster; // ensure the local master
          return replace(parentSpec, new klass({ ...localSpec, master: localMaster }, this.parent.extractStylePolicyFor(parentSpec.name)));
        }
        if (parentSpec.isPolicy) {
          return replace(parentSpec, new klass(localSpec, parentSpec.parent)); // insert a different style policy that has the correct overrides
        }

        Object.assign(parentSpec, obj.dissoc(localSpec, ['submorphs'])); // just apply the current local spec
      };

      mergeInHierarchy(baseSpec, spec, mergeSpecs, true, handleRemove, handleAdd);

      if (baseSpec.viewModel && spec.viewModel) {
        spec.viewModel = obj.deepMerge(baseSpec.viewModel, spec.viewModel);
      }

      // replace the marked entries
      return {
        ...obj.dissoc(baseSpec, ['master', 'submorphs', ...getStylePropertiesFor(baseSpec.type)]),
        ...spec,
        submorphs: tree.mapTree(baseSpec, (node, submorphs) => {
          if (toBeReplaced.has(node)) return toBeReplaced.get(node);
          else {
            // this allows us to skip the unnessecary creation of an object
            if (!node.isPolicy && submorphs.length > 0) { node.submorphs = submorphs; }
            return node;
          }
        }, node => node.submorphs || []).submorphs || []
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
    const subSpec = this.getSubSpecFor(specName);
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
    inst.master.applyIfNeeded(true);
    const toAttach = [];
    inst.withAllSubmorphsDo(m => {
      if (m.viewModel) toAttach.unshift(m);
    });
    toAttach.forEach(m => m.viewModel.attach(m));
    return inst;
  }

  /**
   * Synthesizes all contained sub specs up to the first level overridden props,
   * in order to create a build spec that can be used to create a new morph hierarchy.
   * Optionally we can also create the build spec in such a way, that a morph representation
   * of the master component can be generated.
   * Discarding of the style properties can be useful, when we want to
   * utilize this spec to generate source code for component definitions.
   * @param { boolean } discardStyleProps - Wether or not the morph spec should yield an instance or the master component itself.
   * @return { object } The build spec.
   */
  asBuildSpec () {
    const extractBuildSpecs = (specOrPolicy, submorphs) => {
      if (specOrPolicy.COMMAND === 'add') {
        specOrPolicy = specOrPolicy.props;
      }
      if (specOrPolicy.COMMAND === 'remove') return null; // target is already removed so just ignore the command
      if (specOrPolicy.isPolicy) return specOrPolicy.asBuildSpec();
      const modelClass = specOrPolicy.defaultViewModel || specOrPolicy.viewModelClass;
      const modelParams = specOrPolicy.viewModel || {}; // accumulate the derivation chain for the viewModel
      for (let param in modelParams) {
        if (modelParams[param]?.isPolicyApplicator) {
          modelParams[param] = modelParams[param].instantiate();
        }
      }
      specOrPolicy = obj.dissoc(specOrPolicy, ['submorphs', 'defaultViewModel', 'viewModelClass', 'viewModel',
        ...this.parent ? getStylePropertiesFor(specOrPolicy.type) : []
      ]);
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

      return specOrPolicy;
    };
    const buildSpec = tree.mapTree(this.spec, extractBuildSpecs, node => node.submorphs);
    if (this.parent || this.overriddenMaster) buildSpec.master = this;
    return buildSpec;
  }

  /**
   * Returns the appropriate next level master based on the target morph's event state.
   * @param { Morph } targetMorph - The target morph to base the component dispatch on.
   * @returns { StylePolicy } The appropriate policy for the dispatch.
   */
  determineMaster (targetMorph) {
    if (!targetMorph) return this._autoMaster || this._parent; // best guess

    const {
      isHovered,
      isClicked,
      mode,
      breakpointMaster
    } = getEventState(targetMorph, this._breakpointMasters);

    if (this.isEventPolicy) {
      if (isClicked) return this._clickMaster || this._autoMaster;
      if (isHovered) return this._hoverMaster || this._autoMaster;
      return this._autoMaster;
    }

    if (this.isLightDarkModePolicy) {
      switch (mode) {
        case 'dark':
          return this._darkModeMaster;
        case 'light':
          return this._lightModeMaster;
        default:
          return this._autoMaster;
      }
    }

    if (this.isBreakpointPolicy) {
      return breakpointMaster || this._autoMaster;
    }

    return this._parent; // default to the parent if we are neither of the above
  }

  /**
   * Synthesizes the sub spec corresponding to a particular name
   * of a morph in the submorph hierarchy.
   * @param { string } submorphNameInPolicyContext - The name of the sub spec.
   * @param { Morph } ownerOfScope - The top morph for the scope of the policy we synthesize the spec for. This allows us to gather information for dispatching between differnt style policies based on the event state (hover, click).
   * @param { boolean } [skipInstantiationProps = true] - If true, will drop all props in the specs that have `onlyAtInstantiation` set to `true`.
   * @returns { object } The synthesized spec.
   */
  synthesizeSubSpec (submorphNameInPolicyContext, ownerOfScope, skipInstantiationProps = true) {
    let subSpec = this.getSubSpecFor(submorphNameInPolicyContext) || {}; // get the sub spec for the submorphInPolicyContext

    if (subSpec.isPolicy) {
      return subSpec;
    }

    let qualifyingMaster = this.determineMaster(ownerOfScope); // taking into account the target morph's event state

    if (!qualifyingMaster) {
      const rootSpec = { ...subSpec };
      for (let prop of !submorphNameInPolicyContext ? getStylePropertiesFor(rootSpec.type) : []) {
        if (typeof rootSpec[prop] === 'undefined') {
          const defaultVal = getDefaultValueFor(subSpec.type, prop);
          if (typeof defaultVal === 'undefined') continue;
          rootSpec[prop] = {
            value: defaultVal,
            onlyAtInstantiation: true
          };
        }
      }
      return rootSpec; // there are no parents, so we fill in the default values to be used optionally
    }

    let nextLevelSpec = {};
    if (qualifyingMaster.isComponentDescriptor) { // top level component definition referenced
      qualifyingMaster = qualifyingMaster.stylePolicy;
    }

    nextLevelSpec = qualifyingMaster.synthesizeSubSpec(submorphNameInPolicyContext, ownerOfScope, skipInstantiationProps);
    if (nextLevelSpec.isPolicy) return nextLevelSpec;

    let synthesized = {}; let { overriddenMaster } = this;
    // always check the sub spec for the parentInScope, not the current one!
    if (overriddenMaster) {
      const overriddenMasterSynthesizedSpec = overriddenMaster.synthesizeSubSpec(submorphNameInPolicyContext, ownerOfScope);
      for (let prop in overriddenMasterSynthesizedSpec) {
        if (overriddenMasterSynthesizedSpec[prop]?.onlyAtInstantiation) {
          if (skipInstantiationProps) delete overriddenMasterSynthesizedSpec[prop];
        }
      }
      Object.assign(
        synthesized,
        // fill in the top level props just in case they are needed to serve as "defaults" (propably mostly overridden)
        nextLevelSpec,
        // adhere to the overridden props of the structural derivation
        // we sometimes do not apply implicitly assumed default values for props of the overridden master
        // at this point we should provide that
        obj.dissoc(
          overriddenMasterSynthesizedSpec,
          !submorphNameInPolicyContext &&
          !!nextLevelSpec.extent
            ? ['extent']
            : []
        ), // special handling of extent
        subSpec
      );
      // this approach only works for root! We need to be also checking if there is a recently introduced scope?
    } else {
      Object.assign(synthesized, nextLevelSpec, subSpec);
    }

    delete synthesized.submorphs;
    delete synthesized.master;
    delete synthesized.name;
    for (let prop in synthesized) {
      if (synthesized[prop]?.onlyAtInstantiation) {
        if (skipInstantiationProps) delete synthesized[prop];
        else synthesized[prop] = synthesized[prop].value;
      }
    }

    return synthesized;
  }

  /**
   * Returns the sub spec object within the scope of the style policy that matches this particular name.
   * @param { string | null } submorphName - The submorph name for which to find the corresponding sub spec. If null, assume we ask for root.
   * @returns { object } The sub spec corresponding to that name.
   */
  getSubSpecFor (submorphName) {
    if (!submorphName) return this.spec; // assume we ask for root
    let embeddedRes;
    const lookForMartchingSpec = (spec) => tree.find(spec, node => {
      // handle added morphs
      if (node.COMMAND === 'add') return node.props.name === submorphName;
      // handle text and attributes (embedded morphs)
      if (node.textAndAttributes?.find(textOrAttr => {
        if (embeddedRes) return;
        if (textOrAttr?.__isSpec__) embeddedRes = lookForMartchingSpec(textOrAttr);
        if (textOrAttr?.isPolicy && textOrAttr?.name === submorphName) embeddedRes = textOrAttr;
      })) return !!embeddedRes;
      // handle "normal" case
      return node.name === submorphName;
    }, node => node.submorphs || node.props?.submorphs);
    let matchingNode = lookForMartchingSpec(this.spec);
    if (embeddedRes) matchingNode = embeddedRes;
    return matchingNode ? matchingNode.props || matchingNode : null;
  }

  /**
   * Analogous to getSubSpecFor but is able to traverse multiple policy scopes
   * by providing the owner policy names that precede the sub spec name.
   * @param { string[] } path - The names of the parents to ending with the final sub spec or policy to be retrieved.
   * @returns { StylePolicy|object }
   */
  getSubSpecAt (...path) {
    let curr = this.getSubSpecFor(path.shift());
    if (curr && path.length > 0) return curr.getSubSpecAt(path);
    return curr;
  }

  /**
   * Returns wether or not a morph of a given name is managed by this policy.
   * @param { string } nameOfMorph - The name of the morph in question.
   */
  managesMorph (nameOfMorph) {
    if (!nameOfMorph) return true;
    return !!tree.find(this.spec, node => node.name === nameOfMorph, node => node.submorphs);
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
  static for (derivedMorph, args) {
    let newPolicy;

    if (args.constructor === PolicyApplicator) {
      newPolicy = args;
    } else if (args.isComponentDescriptor && args.stylePolicy) {
      newPolicy = new this({}, { auto: args });
    } else if (args.constructor === StylePolicy) {
      newPolicy = new this({}, args);
    } else if (arr.isSubset(obj.keys(args), ['auto', 'hover', 'click'])) {
      newPolicy = new this({}, args);
    }

    if (derivedMorph.master) {
      newPolicy.adoptOverriddenPropsFrom(derivedMorph.master);
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
  apply (targetMorph, isRoot = false) {
    targetMorph.withMetaDo({ metaInteraction: true }, () => {
      this.withSubmorphsInScopeDo(targetMorph, morphInScope => {
        let submorphName = null;
        if (morphInScope !== targetMorph) submorphName = morphInScope.name;
        const synthesizedSpec = this.synthesizeSubSpec(submorphName, targetMorph, false);
        if (obj.isEmpty(synthesizedSpec)) return;
        if (synthesizedSpec.isPolicy) {
          if (morphInScope._skipMasterReplacement) {
            delete morphInScope._skipMasterReplacement;
            return;
          }
          morphInScope.setProperty('master', synthesizedSpec); // might be redundant
          synthesizedSpec.targetMorph = morphInScope;
        } else this.applySpecToMorph(morphInScope, synthesizedSpec, isRoot); // this step enforces the master distribution

        if (morphInScope !== targetMorph && morphInScope.master) {
          morphInScope._requestMasterStyling = false;
          return morphInScope.master.apply(morphInScope); // let the policy handle the traversal
        }
      });
    });
  }

  synthesizeSubSpec (submorphNameInPolicyContext, parentOfScope, skipInstantiationProps = true) {
    const subSpec = super.synthesizeSubSpec(submorphNameInPolicyContext, parentOfScope, skipInstantiationProps);
    if (subSpec.isPolicy && !subSpec.isPolicyApplicator) {
      return new PolicyApplicator({}, subSpec);
    }
    return subSpec;
  }

  applyIfNeeded (needsUpdate = false, animationConfig = false) {
    const needsApplication = needsUpdate && this.targetMorph;
    if (animationConfig && needsApplication) {
      let resolve, animationPromise;
      ({ promise: animationPromise, resolve } = promise.deferred());
      this._animating = animationPromise;
      this.targetMorph.withAnimationDo(() => this.apply(this.targetMorph), animationConfig).then(async () => {
        while (animationPromise !== this._animating) {
          animationPromise = this._animating;
          await this._animating;
        }
        this._animating = false;
        resolve(true);
      });
      return this._animating;
    }
    if (needsApplication) {
      this.apply(this.targetMorph);
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
  applySpecToMorph (morphToBeStyled, styleProps, isRoot) {
    for (const propName of getStylePropertiesFor(morphToBeStyled.constructor)) {
      let propValue = styleProps[propName];
      if (propValue === skippedValue) continue;
      if (propValue?.onlyAtInstantiation) continue;
      if (propValue === undefined) {
        if (PROPS_TO_RESET.includes(propName)) {
          propValue = getDefaultValueFor(morphToBeStyled.constructor, propName);
        }
        if (propValue === undefined) continue;
      }
      if (propName === 'layout') {
        if (morphToBeStyled.layout?.name() === propValue?.name() &&
            morphToBeStyled.layout?.equals(propValue)) { continue; }
        let lv = propValue ? propValue.copy() : undefined;
        if (this._animating) {
          const origCSS = lv.renderViaCSS;
          lv = lv.with({ renderViaCSS: false });
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
        if (resizePolicy.widthPolicy === 'fixed') morphToBeStyled.width = propValue.x;
        if (resizePolicy.heightPolicy === 'fixed') morphToBeStyled.height = propValue.y;
        continue;
      }

      if (isRoot) {
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
    return parentOfScope.withAllSubmorphsDoExcluding(cb, m => parentOfScope !== m && m.master);
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
    let subSpec = this.ensureSubSpecFor(changedMorph);
    if (subSpec?.isPolicyApplicator) {
      return subSpec.onMorphChange(changedMorph, change);
    }
    if (change.value === this) return;
    if (change.selector === 'addMorphAt') {
      this.insertSpecIfMentioned(change.args[0]);
    }
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
  ensureSubSpecFor (submorph) {
    const targetName = this.targetMorph === submorph ? null : submorph.name;
    let currSpec = this.getSubSpecFor(targetName);
    if (currSpec) return currSpec;
    currSpec = { name: submorph.name };
    // ensure we are mentioned in the derivation chain
    if (!this.mentionedInHierarchy(targetName)) return currSpec;
    const parentSpec = this.ensureSubSpecFor(submorph.owner);
    const { submorphs = [] } = parentSpec;
    submorphs.push(currSpec);
    parentSpec.submorphs = submorphs;
    return currSpec;
  }

  /**
   * @param { string } submorphNameInPolicyContext - The name of the submorph to be checked for being mentioned.
   * @returns { boolean } Wether or not the a sub spec for the given name could be found in the derivation chain.
   */
  mentionedInHierarchy (submorphNameInPolicyContext) {
    let mentioned = false; let parent = this;
    while (parent = parent.parent) {
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
    if (this.mentionedInHierarchy(aMorph.name)) {
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
}
