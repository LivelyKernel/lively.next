import { arr, tree, Path, promise, obj } from 'lively.lang';
import { resource } from 'lively.resources';
import { pt } from 'lively.graphics';
import { copy, ExpressionSerializer } from 'lively.serializer2';
import { once } from 'lively.bindings';
import { ProportionalLayout } from '../layout.js';
import { morph, getStylePropertiesFor } from '../helpers.js';

const exprSerializer = new ExpressionSerializer();

// debugging
export function getOverriddenPropsFor (aMorph) {
  const policyOwner = aMorph.ownerChain().find(m => m.master);
  if (aMorph.master) {
    return {
      local: obj.keys(aMorph.master._overriddenProps.get(aMorph)),
      owner: obj.keys(policyOwner?.master._overriddenProps.get(aMorph))
    };
  }
  return policyOwner && obj.keys(policyOwner.master._overriddenProps.get(aMorph));
}

export function printOverriddenProps (aMorph) {
  const overriddenPropsInHierarchy = {};
  const getMasterForMorph = (m) => {
    for (let o of m.ownerChain()) {
      if (o.master?.managesMorph(m)) return o.master;
      if (o === aMorph) return false;
    }
  };
  const gatherOverriddenProps = (m, master) => {
    let info = overriddenPropsInHierarchy[m.name] || [];
    info.push(master.__serialize__().__expr__ + ' => ' + Object.keys(master._overriddenProps.get(m)));
    overriddenPropsInHierarchy[m.name] = info;
  };
  aMorph.withAllSubmorphsDo(m => {
    const master = getMasterForMorph(m);
    if (master) {
      gatherOverriddenProps(m, master);
    }
    if (m.master) {
      gatherOverriddenProps(m, m.master);
    }
  });
  return overriddenPropsInHierarchy;
}

// property merging

export function mergeInHierarchy (
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
}

function getEventState (targetMorph, customBreakpoints) {
  if (!customBreakpoints) customBreakpoints = [];
  const { world, eventDispatcher } = targetMorph.env;
  const mode = world && world.colorScheme; // "dark" | "light"
  const isHovered = eventDispatcher && eventDispatcher.isMorphHovered(targetMorph); // bool
  const isClicked = eventDispatcher && eventDispatcher.isMorphClicked(targetMorph); // bool
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
 * This is an abstract policy, that is not applied to an actual morph
 * but instead is stored inside the internal spec representation of the
 * master component system. Its main purpose is to manage and synthesize
 * specs that can then be used for 1.) deriving new morphs or 2.) applying styles.
 * It is in turn used by ComponentPolicies in order to quickly get the properties
 * to be applied to a styled submorph hierarchy.
 */
export class StylePolicy {
  /**
   * Creates a new Inline Policy. Inline Policies are the underlying building blocks
   * of component definitions. Except for top level component definitions
   * (those that are not derived from any other existing components in the system) most
   * of the components are defined in terms of derivations of other components in the system.
   * A derivation of a component is the reuse of structural and/or style properties within the context
   * of another component.
   * @param { object } spec - The structural composition of the component, similar to morphic build specs.
   * @param { StylePolicy } parent - The inline policies that we are derived from.
   * @param { boolean } [inheritStructure = true] - Wether or not we are supposed to inherit the structure of the parent policy.
   */
  constructor (spec, parent, inheritStructure = true) {
    if (parent) this.parent = parent; // can be either an inline policy or a component descriptor
    this.inheritStructure = inheritStructure;
    this.spec = this.ensureStylePoliciesInSpec(spec);
    // this.prepareIndex(); // synthesizes the policy for quick application and/or spec generation.
    // fixme: What to do about { hover, click, breakpoint } masters? How do they fit into the picture here?
    // Right now the derivation chain only manages the auto, that is default master component and declares that
    // as the parent. In principle that is OK, since if at all, the structure should only be propagated
    // via the parent. However still we need to find a way to handle system/event state dependent
    // master components, that apply themselves instead of the auto master component if the
    // event/system state declares that to be the case.
  }

  /**
   * Inline policies usually have a parent inline policy they are derived from
   * except if they are are a master component completely created from scratch.
   * @returns { StylePolicy | null } The inline policy that we are derived from.
   */
  get parent () {
    return this._parent?.isComponentDescriptor ? this._parent.stylePolicy : this._parent;
  }

  get type () {
    return this.spec.type;
  }

  get name () {
    return this.spec.name; // this is not needed useful for top level inline policies...
  }

  /**
   * We can set a inline policy's parent to be either a descriptor or another inline policy.
   * The nice thing about having descriptors as parents is, that they are immutable references
   * that stay the same, even if their definition changes. That way we can easily stay up to date
   * without a manual update notification mechanism.
   * However this is not really useful between component definitions and inline policies since they are always "re evaluated"
   * anyways. It is useful if an instantiated component sits around and is supposed to have its policy
   * re applied in response to the updated component definition.
   * This however is only handled by component policies, not inline policies.
   * So this feature is not really needed. Maybe remove once we are done with this.
   * @type { object | StylePolicy | ComponentDescriptor }
   */
  set parent (policyOrDescriptor) {
    if (policyOrDescriptor.isPolicy || policyOrDescriptor.isComponentDescriptor) {
      this._parent = policyOrDescriptor;
    } else {
      const { click, hover, light, dark, breakpoints, auto = this._parent } = policyOrDescriptor;
      this._parent = auto;
      // these are ALWAYS top level policies, and therefore Component Descriptors.
      // Dispatch based masters can not be inline policies, since there is no possible way
      // to for click, hover, light/dark or breakpoint masters to serve as structure providers.
      // A inline policy REQUIRES a structure provider in order to be created.
      this._autoMaster = auto; // auto is always defined. We default to the parent, if not specified otherwise.

      // We perform this dance here, in order to provide the user with a little bit
      // more insightful error messages.
      if ((click || hover || light || dark) && !((click || hover) ^ (light || dark))) {
        throw Error('Cannot mix mouse event with light/dark mode dispatch!');
      }

      if ((click || hover || !!breakpoints) && !((click || hover) ^ !!breakpoints)) {
        throw Error('Cannot mix mouse event with breakpoint dispatch!');
      }

      if ((light || dark || !!breakpoints) && !((light || dark) ^ !!breakpoints)) {
        throw Error('Cannot mix light/dark mode with breakpoint dispatch!');
      }

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
   * If there is a locally overridden master in the parent of the scope,
   * it is retrievable via this property.
   * @type { StylePolicy | undefined }
   */
  get overriddenMaster () { return this.spec.master !== this && this.spec.master; }

  /**
   * Usually, we declare inline policies by calling part() within our component() definition.
   * However inline policies can also be declared "implicitly".
   * Overriding the master property in one of our submorphs in the component or
   * declaring a 2nd, 3rd, etc rate inline policy is not signified by a part call. We however still need to wrap
   * these cases. This is why this routing scans our current spec for these cases and ensures
   * they are stored as InlinePolicies accordingly.
   * We also ensure the presence of "empty" style policies, that did not get adressed
   * in the derivation at all. This is mainly for the purpose of simplifying the generation
   * of build specs.
   */
  ensureStylePoliciesInSpec (spec) {
    const klass = this.constructor;
    // scan this.spec and detect overridden/set master components
    // or further refined inline policies
    if (!this.parent || !this.inheritStructure) {
      return tree.mapTree(spec, (node) => {
        // this is no longer really appropriate, leave this master as is
        return !node.isPolicy && node.master && node !== this.spec
          ? { ...node, master: new klass({}, node.master) }
          : node;
      }, node => node.submorphs || []);
    }

    if (this.parent) {
      // we need to traverse the spec and the parent's build spec simultaneously
      const baseSpec = tree.mapTree(this.parent.spec, (node, submorphs) => {
        // weird way of processing the commands of the parent spec
        if (node.COMMAND === 'add') node = node.props;
        if (node.COMMAND === 'remove') return null;
        // FIXME: We possibly create a bunch of intermediate policies that we end up replacing. Maybe instead of replacing, just extend?
        //        Or just return the previous policy here, and defer creation of the inline policy to later!
        //        WRONG: This only makes us replace the policies that are covered by the local spec def
        //               It then skips replacing all the other missing ones...
        if (node.isPolicy) return new klass({}, node); // create new empty policy, which in turn handles the futher traversal internally
        node = obj.dissoc(node, ['master', 'submorphs', ...getStylePropertiesFor(node.type)]);
        if (submorphs.length > 0) node.submorphs = arr.compact(submorphs);
        return node;
      }, node => node.isPolicy ? [] : node.submorphs); // get the fully collapsed spec
      // we are abusing the merging traversal a little in order to perform
      const toBeReplaced = new WeakMap();
      function replace (node, replacement) {
        toBeReplaced.set(node, replacement);
      }
      // in place modifications of our local spec
      mergeInHierarchy(baseSpec, spec, (parentSpec, localSpec) => {
        // ensure the presence of all nodes
        if (localSpec === spec) {
          if (!localSpec.name) localSpec.name = parentSpec.name;
          return;
        }
        if (localSpec.isPolicy) {
          return;
        } // do not tweak root
        // FIXME: how can the plain spec contain a policy directly when we have been derived from a parent?
        //        This does not look like a plausible scenario.
        if (localSpec.master && parentSpec.isPolicy) {
          // return collapsed inline policy
          // return replace(localSpec, parentSpec.master.collapse(localSpec.master));
          // rms 13.7.22 OK to get rid of the descritptors here, since we are "inside" of a def which is reevaluated on change anyways.
          const localMaster = localSpec.master.isComponentDescriptor ? localSpec.master.stylePolicy : localSpec.master;
          return replace(parentSpec, new klass({ ...localSpec, master: localMaster }, parentSpec.parent));
        }
        if (localSpec.master) {
          // return "fresh" inline policy, no overridden props present, except for the local ones!
          // FIXME: This is different to when we overriden a previously derived morph's master property.
          //        In that scenario we keep the derivation chain, and then inject the custom props of the new StylePolicy
          //        when synthesizing props. Is this altered behavior justified? Why do we just drop the props of this spec
          //        further up the derivation chain?
          //        This is justified if we want to enable 2 Scnarios:
          //           1. We have a derivation chain but we also want to patch that derivation chain with a
          // introduce inline policy
          const specName = parentSpec.name;
          const localMaster = localSpec.master.isComponentDescriptor ? localSpec.master.stylePolicy : localSpec.master;
          return replace(parentSpec, new klass({ ...localSpec, master: localMaster }, this.parent.extractInlinePolicyFor(specName)));
        }
        if (parentSpec.isPolicy) {
          // return 2nd degree inline policy, which is derived from a previously existing one
          return replace(parentSpec, new klass(localSpec, parentSpec.parent)); // insert a different style policy that has the correct overrides
        }
        Object.assign(parentSpec, obj.dissoc(localSpec, ['submorphs'])); // just apply the current local spec
      }, true,
      (parent, toBeRemoved) => {
        // insert remove command directly into the baseSpec
        replace(toBeRemoved, {
          COMMAND: 'remove',
          target: toBeRemoved.name
        });
      },
      (parent, toBeAdded, before) => {
        // insert add command directly into the baseSpec
        const index = before ? parent.submorphs.indexOf(before) : parent.submorphs.length;
        if (toBeAdded.master) {
          toBeAdded = new klass(toBeAdded);
        }
        arr.pushAt(parent.submorphs, {
          COMMAND: 'add',
          props: toBeAdded
        }, index);
      });

      // replace the marked entries
      return {
        ...spec,
        submorphs: tree.mapTree(baseSpec, (node, submorphs) => {
          if (toBeReplaced.has(node)) return toBeReplaced.get(node);
          else {
          // this allows us to skip the unnessecary creation of an object
            if (!node.isPolicy && submorphs.length > 0) { node.submorphs = submorphs; } // Policies take care of the traversal on their own
            return node;
          }
        }, node => node.submorphs || []).submorphs || []
      };
    }
  }

  extractInlinePolicyFor (specName) {
    const subSpec = this.getSubSpecFor(specName);
    const klass = this.constructor;
    if (subSpec) return new klass(subSpec, this.parent ? this.parent.extractInlinePolicyFor(specName) : null);
    return null;
  }

  /**
   * Creates a new morph from the fully synthesized spec.
   * @returns { Morph } The new morph based off the sully synthesized spec.
   */
  instantiate () {
    // we may be able to avoid this explicit wrapping of the policies
    // by moving that logic into the master setter at a later stage
    return morph(PolicyApplicator.for(this).asBuildSpecSimple()); // eslint-disable-line no-use-before-define
  }

  asBuildSpecSimple () {
    const buildSpec = tree.mapTree(this.spec, (specOrPolicy, submorphs) => {
      if (specOrPolicy.COMMAND === 'add') {
        specOrPolicy = specOrPolicy.props;
        // FIXME: we also need to make sure that the build spec places the added submorph at the correct position
      }
      if (specOrPolicy.COMMAND === 'remove') return null; // target is already removed so just ignore the command
      if (specOrPolicy.isPolicy) return specOrPolicy.asBuildSpecSimple();
      specOrPolicy = obj.dissoc(specOrPolicy, ['submorphs', ...getStylePropertiesFor(specOrPolicy.type)]);
      if (submorphs.length > 0) specOrPolicy.submorphs = arr.compact(submorphs);
      return specOrPolicy;
    }, node => node.submorphs);
    if (this.parent) buildSpec.master = this;
    if (this.overriddenMaster) buildSpec.master = this; // this is not the right way to do this
    return buildSpec;
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
  asBuildSpec (discardStyleProps = () => true) {
    // FIXME: Just a flag to indicate the discarding of next level style props is not enough to
    //        cover all desirable use cases for this routine.
    //        We want the following cases:
    //        1.) Not carry over any style props since all is managed by the component policies.
    //        2.) Carry over the 1st level style props, in general to reify the master components as morphs.
    //        3.) Carry over all the n-1 style props (excluding the root) in order to basically collapse all
    //            the overridden properties in the policy chain into one spec.
    // important also, to create a completely new spec structure, such that
    // we do not accidentally alter the specs of parent policies.
    const filterProps = (owner, submorphs, discardStyleProps) => {
      // ensure that inline policies are treated correctly...
      let subSpec = owner;
      if (owner.isPolicy) {
        return owner.asBuildSpec(discardStyleProps); // always discard the build specs of the parent
      } else if (discardStyleProps(this)) {
        subSpec = {
          ...obj.dissoc(owner, ['master', ...getStylePropertiesFor(owner.type)])
        };
      }
      if (submorphs.length > 0) subSpec.submorphs = submorphs;

      return subSpec;
    };

    function filterSpec (spec) {
      return tree.mapTree(spec, (owner, submorphs) => {
        return filterProps(owner, submorphs, discardStyleProps);
      }, props => props.submorphs || []);
    }

    let buildSpec;
    if (!this.parent) {
      buildSpec = filterSpec(this.spec);
      return buildSpec;
    } else {
      buildSpec = this.parent.asBuildSpec(); // always discard the style props from our parent, regardless
    }

    if (discardStyleProps(this)) buildSpec.master = this; // always return a new policy

    // fixme: what if we are configure not to inherit the structure of the parent?
    //        In this case we need to kick out all of the subspecs that are not
    //        explicitly mentioned in our own spec.

    if (!this.inheritStructure) {
      // buildSpec, this.spec => traverse buildSpec and synthesize but also kick out any subspecs that are not present in this.spec (via name)
      // we need to traverse the spec and the parent's build spec simultaneously
      // we are abusing the merging traversal a little in order to perform
      const toBeKept = new Set();
      function keep (node) {
        toBeKept.add(node);
      }
      // in place modifications of our local spec
      mergeInHierarchy(buildSpec, this.spec, (specToKeep) => {
        keep(specToKeep);
      });

      // remove all unmarked sub specs
      buildSpec = tree.mapTree(buildSpec, (node, submorphs) => {
        node.submorphs = submorphs.filter(m => toBeKept.has(m));
        return node;
      }, node => node.submorphs);
      // after that proceed with the usual merging in of props
    }

    mergeInHierarchy(buildSpec, this.spec, (curr, props) => {
      const styleProperties = getStylePropertiesFor(curr.type || props.type);
      if (props.isPolicy) {
        // if we encounter an inline policy
        // first we clear all style props from curr:
        for (let key in styleProperties) delete curr[key];

        // then we need to do do either one of two things:
        if (discardStyleProps(this)) {
          // we discard the local props and just assign the inline policy as the master
          curr.master = props;
        }

        if (!discardStyleProps(this)) {
          // we return the first level build spec of the policy
          Object.assign(curr, props.asBuildSpec(discardStyleProps));
          if (props.parent) curr.master = props.parent;
        }

        return;

        // Q: Why is it OK to completely "discard" the current entry as defined by the build spec?
        // A: For that we need to differntiate further: If we encounter an inline policy its one of two "kinds":
        //    1. An overriding inline policy, which means it assigns or overrides the master at this point
        //       to an enirely different top level component. In this case it is OK to just discard the preexisting parent entry.
        //       We also do not need to worry about the "bookkeeping" of overridden props in the previous inline policy chain since that
        //       is already taken care of by the implicit policy generation routine run at creation time.
        //    2. An extending inline policy, which derives from the previously existing inline policy in the parent.
        //       This is also suitable to completely discard the existing entry, since it keeps track of the parent policy,
        //       and can traverse its derivation chain by itself and correctly inform us about the synthesized props on its own.
      }

      // what if the props are themselves inline policies?
      if (discardStyleProps(this)) {
        Object.assign(curr, obj.dissoc(props, [...styleProperties, 'master', 'submorphs']));
      }

      if (!discardStyleProps(this)) {
        Object.assign(curr, obj.dissoc(props, ['submorphs'])); // include all properties, submorphs will be handled by merge
      }

      // Question: The performance of initializing a morph from a "lean" spec could be unnessecary slow,
      //           since we initially apply a bunch of default values, which alter on are "corrected" after the
      //           component policies are applied. Instead of kicking those out, cant we just return them in the
      //           first place? In the future we want to remove the "treating morphs as component data structures" - scheme
      //           anyways and cleanup morph.js. After that, we will not use the preexisting properties on
      //           morphs to detect overrides any more, making this discarding to style props only useful for code generation.
      //
      //           1. Get rid of parametrized props after we have transitioned to lean components. (morph.js)
      //           2. Manage overrides entirely within component policies and inline policies.
      //           3. Flip the logic here and allow to instead produce "fully synthesized" morph hierarchies OR reduced style properties
      //              for the sake of source code generation.
    },
    true,
    (parent, toBeRemoved) => {
      arr.remove(parent.submorphs, toBeRemoved);
    },
    (parent, toBeAdded, before) => {
      const index = before ? parent.submorphs.indexOf(before) : parent.submorphs.length;
      // also make sure the added elements are actually filtered props
      // fixme: perform mapTree of toBeAdded to also filter its props accordingly
      let subSpec;
      if (toBeAdded.isPolicy) {
        subSpec = toBeAdded.asBuildSpec(discardStyleProps); // carry that over
        if (discardStyleProps(this)) subSpec.master = toBeAdded;
        else if (toBeAdded.parent) subSpec.master = toBeAdded.parent;
      } else {
        subSpec = filterSpec(toBeAdded);
      }
      arr.pushAt(parent.submorphs, subSpec, index);
    });

    // how do we build up the morph spec?
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
      if (isClicked) return this._clickMaster;
      if (isHovered) return this._hoverMaster;
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
   * @param { Morph } parentOfScope - The top morph for the scope of the policy we synthesize the spec for. This allows us to gather information for dispatching to other inline policies.
   * @param { function } [checkNext = () => true] - Custom checker that allows us to control how far we traverse the derivation chain to synthesize the sub spec.
   * @returns { object } The synthesized spec.
   */
  synthesizeSubSpec (submorphNameInPolicyContext, parentOfScope, checkNext = () => true) {
    if (!checkNext(this)) return {};
    let subSpec = this.getSubSpecFor(submorphNameInPolicyContext) || {}; // get the sub spec for the submorphInPolicyContext

    let qualifyingMaster = this.determineMaster(parentOfScope); // taking into account the target morph's event state

    if (subSpec.isPolicy || !qualifyingMaster) return subSpec;

    let nextLevelSpec = {};
    if (qualifyingMaster.isComponentDescriptor) { // top level component definition referenced
      qualifyingMaster = qualifyingMaster.stylePolicy;
    }

    if (checkNext(qualifyingMaster)) {
      nextLevelSpec = qualifyingMaster.synthesizeSubSpec(submorphNameInPolicyContext, parentOfScope, checkNext);
      if (nextLevelSpec.isPolicy) return nextLevelSpec;
    }

    let synthesized = {};

    // always check the sub spec for the parentInScope, not the current one!
    if (this.overriddenMaster) {
      let topLevelComponent = qualifyingMaster;
      while (topLevelComponent.parent) topLevelComponent = topLevelComponent.parent;
      Object.assign(
        synthesized,
        // fill in the top level props just in case they are needed (propably mostly overridden)
        topLevelComponent.synthesizeSubSpec(submorphNameInPolicyContext, parentOfScope),
        // add in the style props for the adjusted master
        this.overriddenMaster.synthesizeSubSpec(null, parentOfScope),
        // adhere to the overridden props of the structural derivation
        qualifyingMaster.synthesizeSubSpec(submorphNameInPolicyContext, parentOfScope, (next) => next !== topLevelComponent),
        subSpec
      );
      // this approach only works for root! We need to be also checking if there is a recently introduced scope?
    } else {
      Object.assign(synthesized, nextLevelSpec, subSpec);
    }

    return obj.dissoc(synthesized, ['submorphs', 'master', 'name']); // not really needed since we do not traverse submorph prop anyways
  }

  /**
   * Returns the sub spec object within the scope of the style policy that matches this particular name.
   * @param { string | null } submorphName - The submorph name for which to find the corresponding sub spec. If null, assume we ask for root.
   * @returns { object } The sub spec corresponding to that name.
   */
  getSubSpecFor (submorphName) {
    if (!submorphName) return this.spec; // assume we ask for root
    // just find the correct sub spec inside our spec
    // if no entry is present for this name,
    // we escalate the query to the parent (structure provider)
    const matchingNode = tree.find(this.spec, node => {
      if (node.COMMAND === 'add') return node.props.name === submorphName;
      return node.name === submorphName;
    }, node => node.submorphs);
    return matchingNode ? matchingNode.props || matchingNode : null;
  }

  managesMorph (aMorph) {
    return aMorph === this.targetMorph || !!this.getSubSpecFor(aMorph.name);
  }

  /**
   * Check wether or not a particular morph is actively positioned by a comprising layout.
   * @param {Morph} aSubmorph - The morph to check for.
   * @returns { boolean } Wether or not the morph's position is by a layout.
   */
  isPositionedByLayout (aSubmorph) {
    return aSubmorph.owner &&
      aSubmorph.owner.layout &&
      aSubmorph.owner.layout.layoutableSubmorphs.includes(aSubmorph);
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
 * Compared to InlinePolicies, the PolicyApplicator is able to dynamically
 * detect overridden props, with respect to changes in the morph props.
 * PolicyApplicator serializes to a form, where overridden props (which vary
 * from a case by case basis) are serialized as well.
 * Can be derived from either a StylePolicy OR ComponentDescriptor.
 * Knows, how it can be applied to a morph hierarchy!
 */
export class PolicyApplicator extends StylePolicy {
  // turns a policy or a descriptor
  // into a nested construct of policy applicators
  // who in turn can be 1.) assigned as masters to morphs
  // and 2.) Know how to apply the style properties to the
  // morph hierarchy.
  static for (policyOrDescriptor, props = {}) {
    // we actually need a little bit more then just that...
    // the index that holds the overridden props for each of the morphs
    // in the scope, as well as refs to other MasterPolicies in the
    // subsequent scopes.
    return new this(props, policyOrDescriptor, true);
    // this is creating a slightly incorrect structure with StylePolices instead of PolicyApplicators...
    // ... that has however no effect, since the application ensures the style policies are referenced entirely
    // ... but it is better to fix rather than having dangling in between policies!
    // self.ensureImplicitInlinePolicies();;
  }

  get isPolicyApplicator () { return true; }

  toString () { return '<PolicyApplicator>'; }

  asBuildSpec (discardStyleProps = () => true) {
    const spec = super.asBuildSpec(discardStyleProps);
    // this does not ensure that overridden props are getting carried over
    // we need to directly initialize the applicators with the overriden props properly
    return tree.mapTree(spec, (node, submorphs) => {
      if (node.master && !node.master.isPolicyApplicator) {
        return { ...node, submorphs, master: PolicyApplicator.for(node.master) };
      } else { return { ...node, submorphs }; }
    }, node => node.submorphs);
  }

  // APPLICATION TO MORPH HIERARCHIES

  attach (targetMorph) {
    this.targetMorph = targetMorph;
  }

  /**
   * Given a target morph, traverse the submorph hierarchy
   * covering the policy's scope and apply the style properties
   * according to the synthesized sub spec.
   * At the border of the scope, we in turn ask the encountered inline policies
   * to apply themselves to the remainder of the submorph hierarchy.
   * @param { Morph } targetMorph - The root morph of the hierarchy.
   */
  apply (targetMorph, isRoot = false) {
    targetMorph.withMetaDo({ metaInteraction: true }, () => {
      this.withSubmorphsInScopeDo(targetMorph, morphInScope => {
        let submorphName = null;
        if (morphInScope !== targetMorph) submorphName = morphInScope.name;
        const synthesizedSpec = this.synthesizeSubSpec(submorphName, targetMorph);
        if (synthesizedSpec.isPolicy) {
          morphInScope.setProperty('master', synthesizedSpec); // might be redundant
          synthesizedSpec.targetMorph = morphInScope;
        } else this.applySpecToMorph(morphInScope, synthesizedSpec, isRoot); // this step enforces the master distribution

        if (morphInScope !== targetMorph && morphInScope.master) {
          return morphInScope.master.apply(morphInScope); // let the policy handle the traversal
        }
      });
    });
  }

  synthesizeSubSpec (submorphNameInPolicyContext, parentOfScope, checkNext = () => true) {
    const subSpec = super.synthesizeSubSpec(submorphNameInPolicyContext, parentOfScope, checkNext);
    if (subSpec.isPolicy && !subSpec.isPolicyApplicator) {
      return PolicyApplicator.for(subSpec);
    }
    return subSpec;
  }

  applyIfNeeded () {

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
    for (const propName of arr.intersect(getStylePropertiesFor(morphToBeStyled.constructor), obj.keys(styleProps))) {
      if (propName === 'layout') {
        if (morphToBeStyled.layout && styleProps.layout &&
            morphToBeStyled.layout.name() === styleProps.layout.name() &&
            morphToBeStyled.layout.equals(styleProps.layout)) { continue; }
        morphToBeStyled.layout = styleProps.layout ? styleProps.layout.copy() : undefined;
        continue;
      }

      if (this.isPositionedByLayout(morphToBeStyled) && propName === 'position') continue;
      let resizePolicy;
      if ((resizePolicy = this.isResizedByLayout(morphToBeStyled)) && propName === 'extent') {
        if (resizePolicy.widthPolicy === 'fixed') morphToBeStyled.width = styleProps.extent.x;
        if (resizePolicy.heightPolicy === 'fixed') morphToBeStyled.height = styleProps.extent.y;
        continue;
      }

      if (isRoot) {
        if (propName === 'extent' &&
            !morphToBeStyled.extent.equals(pt(10, 10)) &&
            (
              !morphToBeStyled.owner ||
               morphToBeStyled.owner.isWorld ||
               morphToBeStyled.ownerChain().find(m => m.master && m.master.managesMorph(morphToBeStyled)))
        // not already styled by other master
        ) continue;
        if (propName === 'position') continue;
      }

      // fixme: other special cases??
      if (morphToBeStyled.isLabel && propName === 'extent') continue;

      if (['border', 'borderTop', 'borderBottom', 'borderRight', 'borderLeft'].includes(propName)) continue; // handled by sub props;

      if (!obj.equals(morphToBeStyled[propName], styleProps[propName])) {
        morphToBeStyled[propName] = styleProps[propName];
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
    if (change.meta.metaInteraction || !this.targetMorph) return;
    let subSpec = this.ensureSubSpecFor(changedMorph);
    if (change.value === this) return;
    if (change.prop) { subSpec[change.prop] = change.value; }
  }

  /**
   * Scans the master component derivation chain in order to
   * determine the path to the sub spec that is then created
   * on the spot.
   * @param { string } submorphName - The name of the sub spec. If ambiguous the first one starting from root is picked.
   */
  ensureSubSpecFor (submorph) {
    const targetName = this.targetMorph === submorph ? null : submorph.name;
    let currSpec = this.getSubSpecFor(targetName);
    if (currSpec) return currSpec;
    currSpec = { name: submorph.name };
    const parentSpec = this.ensureSubSpecFor(submorph.owner);
    const { submorphs = [] } = parentSpec;
    submorphs.push(currSpec);
    parentSpec.submorphs = submorphs;
    return currSpec;
  }
}

// FIXME: The stuff below is deprecated and to be removed once the above is able
//        to handle all the styles in the system.

/**
 * This is a component policy that is directly applied to a concrete morph.
 * It references one or more master component definitions as style guides and
 * dispatches between them depending on the morph's event state.
 * The component policy also allows to manually trigger certain event states manually
 * by means of a meta programming API. This is useful for programmer workflows and tool support in general.
 * Aside from event state, there is also the ability to define viewport specific breakpoints and dispatch between
 * different master components in order to enable responsive design.
 * Lastly component policies can dispatch between the light/dark themes as specified by the current media query in the client.
 */
export class ComponentPolicy {
  static for (derivedMorph, args) {
    let newPolicy;

    if (args.isComponentDescriptor && args.stylePolicy) {
      return PolicyApplicator.for(derivedMorph, args);
    } else if (args.constructor === PolicyApplicator) {
      return args;
    } else if (args.constructor === StylePolicy) {
      return PolicyApplicator.for(args);
    } else if (args.constructor === ComponentPolicy) {
      newPolicy = args;
    } else newPolicy = new this(derivedMorph, args);

    if (derivedMorph.master) {
      newPolicy.adoptOverriddenPropsFrom(derivedMorph.master);
    }

    return newPolicy;
  }

  constructor (derivedMorph, args) {
    this.derivedMorph = derivedMorph;

    // this is reconstructed by traversing the submorph hierarchy based on the current master on save and keeping all refs
    // where managesMorph(m) returns true
    this._overriddenProps = new WeakMap(); // keep the list of props that are overridden by that morph and not affected by master components

    if (args.isMorph || typeof args === 'string' || args.isComponentDescriptor) {
      this.auto = args;
      if (args.isMorph && !args.isComponent) {
        this.auto.isComponent = true;
      }
      // Via direct manipulation this should never be nessecary.
      // In code this can happen, when the user forgets to set this flag.
      if (typeof args === 'string') this.resolveMasterComponents();

      // in order to honor changes in the submorph masters, we reset the master in this scope for now
      return;
    }

    // FIXME: temporary in order to make old and new components work simultaneously
    if (args.constructor === StylePolicy) {
      this.auto = args;
    }

    const { click, auto, hover, light = {}, dark = {} } = args;
    if (light) this.light = light;
    if (dark) this.dark = dark;
    if (click) this.click = click;
    if (auto) this.auto = auto;
    if (hover) this.hover = hover;
    if ([light, dark, click, auto, hover].find(v => typeof v === 'string')) { this.resolveMasterComponents(); }
  }

  get isPolicy () { return true; }

  applyOverriddenPropsOnAttach (overriddenProps) {
    // manually apply the overridden properties now
    this._overriddenPropsToApply = overriddenProps;
  }

  uses (masterComponent) {
    this.updateComponentsFromModules();
    return [this.auto, this.click, this.hover].includes(masterComponent);
  }

  spec () {
    const spec = obj.select(this, ['auto', 'click', 'hover', 'light', 'dark']);
    spec.overriddenProps = {};
    this.withSubmorphsInScopeDo(this.derivedMorph, m => {
      spec.overriddenProps[m === this.derivedMorph ? '__root__' : m.name] = copy(obj.select(m, obj.keys(this._overriddenProps.get(m))));
    });
    return spec;
  }

  equals (other) {
    if (!other) return false;
    if (other.auto === this) return true;
    for (const master of ['auto', 'click', 'hover']) {
      if ((this[master] || null) !== (other[master] || null)) return false;
    }
    return true;
  }

  /**
   * Walk throught the managed submorphs and clear the overridden props that are directly present in the
   * auto master hierarchy.
   * @param { ComponentPolicy } oldPolicy - The previous policy that we will carry the overridden props from.
   */
  adoptOverriddenPropsFrom (oldPolicy) {
    // new strategy:
    // 1.) traverse the (auto)policy chain up to the top level component and collect all the overridden props
    // 2.) install these overridden props on the new master accordingly]
    this._overriddenProps = new WeakMap();
    const { derivedMorph } = oldPolicy; // the old policy's derived morph is ours too!
    if (!oldPolicy.managesMorph(oldPolicy.derivedMorph) && derivedMorph._parametrizedProps) {
      // attempt to retrieve the overridden props from the parametrized ones
      oldPolicy.prepareSubmorphsToBeManaged(derivedMorph, oldPolicy);
    }
    if (!oldPolicy._appliedMaster) {
      oldPolicy.applyIfNeeded(true); // if the policy has not been applied yet our assumptions break down
    }
    this.withSubmorphsInScopeDo(derivedMorph, m => {
      let overridden = {};
      const res = oldPolicy.synthesizeProperties(m, oldPolicy /* makes us traverse the previous policy chain */, derivedMorph, false);
      for (let prop in res) {
        overridden[prop] = true;
      }
      if (oldPolicy.managesMorph(m) && oldPolicy._overriddenProps.get(m).master) overridden.master = true;
      this._overriddenProps.set(m, overridden);
    });
  }

  // called on serialization of Component
  getManagedMorphs () {
    const managedMorphs = [];
    this.derivedMorph.withAllSubmorphsDo(m => {
      if (this.managesMorph(m)) {
        const propKeys = Object.keys(this._overriddenProps.get(m)).filter(k => k !== '_rev');
        if (propKeys.length > 0) { managedMorphs.push([m, Object.keys(this._overriddenProps.get(m))]); }
      }
    });
    return managedMorphs;
  }

  getManagedMorph (name) {
    const managed = this.derivedMorph.getSubmorphNamed(name);
    if (this.managesMorph(managed)) return managed;
  }

  generateExprForPolicy (aPolicy) {
    const { derivedMorph } = aPolicy;
    const owners = derivedMorph.ownerChain();
    const topLevelComponent = arr.last([derivedMorph, ...owners]);
    const policiesInHierarchy = [...owners.filter(m => m.owner && m.master).map(m => m.name).reverse(), derivedMorph.name];
    const { export: exportedName, module: modulePath } = topLevelComponent[Symbol.for('lively-module-meta')];
    return {
      // fixme: remove ternary expression
      __expr__: `(${exportedName}.isComponentDescriptor ? ${exportedName}.getComponent() : ${exportedName})` + policiesInHierarchy.map(policyOwner => `.get("${policyOwner}")`).join('') + '.master',
      bindings: { [modulePath]: [exportedName] }
    };
  }

  get __only_serialize__ () { return ['derivedMorph']; }

  __additionally_serialize__ (snapshot, ref, pool, addFn) {
    for (let stateName of ['auto', 'click', 'hover']) {
      if (!this[stateName]) continue;
      if (this[stateName].isPolicy) {
        addFn(stateName, pool.expressionSerializer.exprStringEncode(this.generateExprForPolicy(this[stateName])));
        continue;
      }
      if (!this[stateName][Symbol.for('lively-module-meta')]) {
        addFn(stateName, this[stateName]);
        continue;
      }

      const { export: exportedName, module: modulePath } = this[stateName][Symbol.for('lively-module-meta')];
      addFn(stateName, pool.expressionSerializer.exprStringEncode({
        __expr__: exportedName,
        bindings: { [modulePath]: [exportedName] }
      }));
    }
  }

  __after_deserialize__ (snapshot, objRef) {
    this._overriddenProps = new WeakMap();
    delete this.managedMorphs;
    const { light, dark, click, auto, hover } = this;
    if ([light, dark, click, auto, hover].find(v => typeof v === 'string')) { this.resolveMasterComponents(); }
  }

  async whenApplied () {
    if (this._appliedMaster) return true;
    const { promise: p, resolve: r } = promise.deferred();
    once(this, '_appliedMaster', r);
    await this._hasUnresolvedMaster;
    if (!this._appliedMaster) await p; // continue waiting until applied
    return true;
  }

  async whenReady () {
    await this._hasUnresolvedMaster;
  }

  async resolveMasterComponents () {
    const res = promise.deferred();
    this._hasUnresolvedMaster = res.promise;
    const { light = {}, dark = {} } = this;
    const states = ['auto', 'click', 'hover'];
    const resolvedComponents = [];
    try {
      for (const state of states) {
        if (typeof this[state] === 'string') { this[state] = await resource(this[state]).read(); }
        if (typeof light[state] === 'string') { light[state] = await resource(light[state]).read(); }
        if (typeof dark[state] === 'string') { dark[state] = await resource(dark[state]).read(); }
        resolvedComponents.push(this[state], light[state], dark[state]);
      }
    } catch (e) {
      throw Error('Encountered invalid master component reference: ' + e.message);
    }

    arr.compact(resolvedComponents).forEach(component => {
      if (!component.isComponent) { component.isComponent = true; } // just to make sure...
    });

    res.resolve();
    this._hasUnresolvedMaster = false;
  }

  /*
    This method is invoked right before a morph is about to render.
    Component styles are invoked only for rendered morphs (i.e. the ones inside the world).

    We check if the master component updated in the mean time and we need to trigger a style application of our submorph hierarchy.
  */

  applyAnimated (config = { duration: 1000 }) {
    const { promise: p, resolve: r } = promise.deferred();
    this.applyIfNeeded(true, config);
    once(this, '_animationConfig', r);
    return p;
  }

  applyIfNeeded (needsUpdate = false, animationConfig = false) {
    if (animationConfig) this._animationConfig = animationConfig;
    const target = this.derivedMorph;

    if (this._hasUnresolvedMaster) {
      this._originalOpacity = target.opacity;
      // fixme: this may still be too late if applyIfNeeded is triggered at render time
      // hide the component until it is applied
      target.withMetaDo({ metaInteraction: true }, () => {
        if (!animationConfig &&
            ![target, ...target.ownerChain()].find(m => m.isComponent)) {
          target.opacity = 0;
        }
      });

      return this._hasUnresolvedMaster.then(() => {
        this.applyIfNeeded(needsUpdate);
        target.withMetaDo({ metaInteraction: true }, () => {
          const opacityOverridden = typeof this._overriddenProps.get(target).opacity !== 'undefined';
          target.opacity = this._appliedMaster && !opacityOverridden ? this._appliedMaster.opacity : this._originalOpacity;
        });
        delete this._originalOpacity;
        delete this._capturedExtents;
      });
    }
    const master = this.determineMaster(target);
    if (master && needsUpdate) {
      this.apply(target, master);
      this._appliedMaster = master;
    }

    let overriddenProps;
    if (overriddenProps = this._overriddenPropsToApply) {
      delete this._overriddenPropsToApply;
      this.withSubmorphsInScopeDo(target, m => {
        if (m === target) Object.assign(m, overriddenProps.__root__ || {});
        else Object.assign(m, overriddenProps[m.name] || {}); // override the stuff
      });
    }
  }

  getStyleProperties (masterComponent) {
    const { properties, order } = masterComponent.propertiesAndPropertySettings();
    const styleProps = [];
    let foundLayout = false;
    for (const prop of order) {
      if (prop === 'layout') {
        foundLayout = true; // layouts can be sensitive to initial state, so apply them last always
        continue;
      }
      if (properties[prop].isStyleProp) {
        styleProps.push(prop);
      }
    }
    if (foundLayout) styleProps.push('layout');
    return styleProps;
  }

  /**
   * Check wether or not a particular morph is actively positioned by a comprising layout.
   * @param {Morph} aSubmorph - The morph to check for.
   * @returns { boolean } Wether or not the morph's position is by a layout.
   */
  isPositionedByLayout (aSubmorph) {
    return aSubmorph.owner &&
      aSubmorph.owner.layout &&
      aSubmorph.owner.layout.layoutableSubmorphs.includes(aSubmorph);
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
   * Traverse all the submorphs within the scope of the component policy.
   * @param { Morph } parentOfScope - The morph that sits at the top of the policy scope.
   * @param { function } cb - The callback function to invoke for each of the morphs in the scope.
   */
  withSubmorphsInScopeDo (parentOfScope, cb) {
    return parentOfScope.withAllSubmorphsDoExcluding(cb, m => parentOfScope !== m && m.master);
  }

  /**
   * Generates a synthesized object the comprises all the properties
   * with respect to the overriden properties in the policy chain.
   * @param { Morph } submorphInPolicyContext - The current morph in the policy context to consult.
   * @param { ComponentPolicy } policy - The current policy to check for overridden props.
   * @param { Morph } targetMorph - The morph the policy is going to apply to.
   * @param { boolean } includeTopLevelComponent - Wether or not to collect the properties in the top level component as well.
   */
  synthesizeProperties (submorphInPolicyContext, policy, targetMorph, includeTopLevelComponent = true) {
    // recursively synthesize the style properties
    if (!policy.managesMorph(submorphInPolicyContext)) return includeTopLevelComponent ? submorphInPolicyContext : {};
    const isRoot = policy.derivedMorph === submorphInPolicyContext;
    const overriddenProps = policy._overriddenProps.get(submorphInPolicyContext);
    const synthesizedProps = {};
    const nextLevelSynthesizedProps = new WeakMap();
    const qualifyingMaster = policy.determineMaster(targetMorph);
    let correspondingMasterSubmorph;
    if (qualifyingMaster.isComponent) {
      correspondingMasterSubmorph = isRoot ? qualifyingMaster : this.findCorrespondingMasterIn(qualifyingMaster, submorphInPolicyContext); // why is this separate search needed?
    }
    let synthesizedPropsOfTopLevelMaster;
    // this needs to be done only if the master is overridden locally
    // if the master is somewhere overridden down the line, we inevitably block
    // any styles controlled by inline policies
    for (let prop of this.getStyleProperties(submorphInPolicyContext)) {
      // 1. if the property is overridden in the context of the policy return the value of the submorph here
      if (overriddenProps[prop]) {
        synthesizedProps[prop] = submorphInPolicyContext[prop]; // ref issue are handled by the application code
        continue;
      }
      // 2. if the property is not overridden locally, then we investigate further and ask the appropriate
      //    qualifying master the policy would suggest instead
      // 2.A: The qualifying master is itself again a policy
      if (qualifyingMaster.isPolicy) {
        // we recursively synthesize the properties and cache them for efficiency reasons
        const nextLevelPolicy = qualifyingMaster;
        let next = nextLevelSynthesizedProps.get(nextLevelPolicy);
        if (!next) {
          const submorphInNextPolicyContext = isRoot ? nextLevelPolicy.derivedMorph : nextLevelPolicy.getManagedMorph(submorphInPolicyContext.name);
          if (!submorphInNextPolicyContext) {
            if (includeTopLevelComponent) { synthesizedProps[prop] = submorphInPolicyContext[prop]; } // ref issue are handled by the application code
            continue; // treat this like an overridden prop
          }
          next = nextLevelPolicy.synthesizeProperties(submorphInNextPolicyContext, nextLevelPolicy, targetMorph, includeTopLevelComponent);
          nextLevelSynthesizedProps.set(nextLevelPolicy, next);
        }
        if (!includeTopLevelComponent && next[prop] === undefined) continue;
        synthesizedProps[prop] = next[prop];
        continue;
      }

      // 2.B The qualifying master is just a top level component and does not own a policy.
      //     So all we need to do is find the corresponding master submorph
      if (includeTopLevelComponent) {
        if (!correspondingMasterSubmorph) {
          synthesizedProps[prop] = submorphInPolicyContext[prop]; // fallback
          continue;
        }

        // 2.B.1 The qualifying master is a top level component BUT again owns a custom policy that requires us to further dig down the rabbit hole
        if (qualifyingMaster.master) {
          if (!synthesizedPropsOfTopLevelMaster) {
            // this causes a problem in cases where there is not corresponding master submorph
            synthesizedPropsOfTopLevelMaster = this.synthesizeProperties(correspondingMasterSubmorph, qualifyingMaster.master, targetMorph, true);
          }
          synthesizedProps[prop] = synthesizedPropsOfTopLevelMaster[prop];
        } else {
          synthesizedProps[prop] = correspondingMasterSubmorph[prop];
        }
      }
    }

    return synthesizedProps;
  }

  findCorrespondingMasterIn (masterComponent, morphInPolicyContext) {
    let found;
    this.withSubmorphsInScopeDo(masterComponent, m => {
      // fixme: cancel further traversal once found?
      if (found) return;
      if (m.name === morphInPolicyContext.name) found = m;
    });
    return found;
  }

  apply (derivedMorph, master, animationConfig = this._animationConfig) {
    if (this._applying) return;
    this._applying = true;

    let policyToSynthesize;
    if (master.isPolicy) {
      // the actual solution is to do both things: further dig down the actual master component
      // and then derive the value for a property based on the derivation chain of policies up to the master component
      // each property is synthesized on the sport here, potentially cached if performance becomes an issue
      policyToSynthesize = master;
      master = master.derivedMorph; // that does not honor the click/hover/auto state by itself...
    }

    if (master.isComponent && master.master) {
      policyToSynthesize = master.master;
    }

    try {
      const apply = () => derivedMorph.withMetaDo({ metaInteraction: true }, () => {
        const nameToStylableMorph = this.prepareSubmorphsToBeManaged(derivedMorph, master);
        this.withSubmorphsInScopeDo(master, masterSubmorph => {
          const isRoot = masterSubmorph === master;
          let morphToBeStyled = isRoot ? derivedMorph : nameToStylableMorph[masterSubmorph.name]; // get all named?
          // morph to be styled is not present. can this happen?
          // Not when working via direct manipulation tools. But can happen when you work in code purely. In those cases we resort to silent ignore.
          if (!morphToBeStyled) return;
          if (obj.isArray(morphToBeStyled)) morphToBeStyled = morphToBeStyled.pop();

          if (masterSubmorph.master && !isRoot) { // the root is already taken care of so we do not want to enter an infine loop here.
            // only assign the policy if the local policy is not equal to the one in the master
            if (Path('master.auto').get(morphToBeStyled) !== masterSubmorph.master &&
                !this._overriddenProps.get(morphToBeStyled).master) {
              // fixme: this needs to be considering the overridden props as well
              //        just carrying over the same master will not apply the expected style.
              //        right now overridden props are only carried over if we instantiate from
              //        a component hierarchy. If we however swap out master components, we do not
              //        apply the correct overridden prop values. SOLUTION: utilize policies as master components
              //        thereby synthesizing the current property based on the overridden props in the chain of policies
              //        and the top level master component property.
              morphToBeStyled.master = { auto: masterSubmorph.master }; // use policy as the master!
            }
          }
          if (morphToBeStyled.master && !isRoot) {
            const overriddenProps = morphToBeStyled.master._overriddenProps.get(morphToBeStyled) || morphToBeStyled._parametrizedProps || {};

            // but enforce extent and position since that is not done by the master itself
            if (!overriddenProps.position) {
              morphToBeStyled.position = masterSubmorph.position;
            }
            if (!overriddenProps.extent) {
              morphToBeStyled.extent = masterSubmorph.extent;
            }
            return; // style application is handled by that master so nothing needs to be done here
          }

          // now that we are about to style the submorph, we need to sythesize the properties accordingly
          // honoring the derivation chain of policies/top level master components
          const synthesizedProperties = policyToSynthesize ? this.synthesizeProperties(masterSubmorph, policyToSynthesize, derivedMorph) : masterSubmorph;

          for (const propName of this.getStyleProperties(masterSubmorph)) {
            if (this._overriddenProps.get(morphToBeStyled)[propName]) {
              if (propName === 'extent' &&
                  Path('owner.layout.constructor').get(morphToBeStyled) === ProportionalLayout &&
                  !morphToBeStyled.master && !isRoot && morphToBeStyled.isLayoutable) {
                // still apply initially since extents can be valuable for layouts even if they ovverride them
                if (this._appliedMaster) {
                  // do not do this when we have been already applied once!
                  continue;
                }
              } else {
                continue; // skip the application since this is a locally overridden property
              }
            }
            // secial handling for ... layout (copy())
            if (propName === 'layout') {
              if (morphToBeStyled.layout && synthesizedProperties.layout &&
                  morphToBeStyled.layout.name() === synthesizedProperties.layout.name() &&
                  morphToBeStyled.layout.equals(synthesizedProperties.layout)) { continue; }
              morphToBeStyled.layout = synthesizedProperties.layout ? synthesizedProperties.layout.copy() : undefined;
              continue;
            }

            if (this.isPositionedByLayout(morphToBeStyled) && propName === 'position') continue;
            let resizePolicy;
            if ((resizePolicy = this.isResizedByLayout(morphToBeStyled)) && propName === 'extent') {
              if (resizePolicy.widthPolicy === 'fixed') morphToBeStyled.width = synthesizedProperties.extent.x;
              if (resizePolicy.heightPolicy === 'fixed') morphToBeStyled.height = synthesizedProperties.extent.y;
              continue;
            }

            if (isRoot) {
              if (propName === 'extent' &&
                  !morphToBeStyled.extent.equals(pt(10, 10)) &&
                  (
                    !morphToBeStyled.owner ||
                     morphToBeStyled.owner.isWorld ||
                     morphToBeStyled.ownerChain().find(m => m.master && m.master.managesMorph(morphToBeStyled)))
                  // not already styled by other master
              ) continue;
              if (propName === 'position') continue;
            }

            // fixme: other special cases??
            if (morphToBeStyled.isLabel && propName === 'extent') continue;

            if (['border', 'borderTop', 'borderBottom', 'borderRight', 'borderLeft'].includes(propName)) continue; // handled by sub props;

            if (!obj.equals(morphToBeStyled[propName], synthesizedProperties[propName])) {
              morphToBeStyled[propName] = synthesizedProperties[propName];
            }

            // we may be late for the game when setting these props
            // se we need to make sure, we restore the morphs "intended extent"
            // for this purpose we enforce the masterSubmorph extent
            if (['fixedHeight', 'fixedWidth'].includes(propName) &&
                morphToBeStyled._parametrizedProps &&
                morphToBeStyled._parametrizedProps.extent) {
              morphToBeStyled.extent = morphToBeStyled._parametrizedProps.extent;
            }
          }
          if (morphToBeStyled._parametrizedProps) { delete morphToBeStyled._parametrizedProps; }
        });
      });
      if (animationConfig) {
        derivedMorph.withAnimationDo(apply, animationConfig).then(() => {
          this._animationConfig = false;
          this._applying = false;
        });
      } else derivedMorph.dontRecordChangesWhile(apply); // also make sure that when we are a master, not to propagate styles in this situtation
    } finally {
      if (!animationConfig) this._applying = false;
      delete derivedMorph._parametrizedProps; // needs to be done for all managed submorphs
    }
  }

  clearOverriddenPropertiesFor (derivedMorph, propsToClear) {
    const overriddenProps = this._overriddenProps.get(derivedMorph);
    this._overriddenProps.set(derivedMorph, obj.dissoc(overriddenProps, propsToClear));
  }

  /*
    Morphs in the styled hierarcht that define their own stling scope via master
    are not traversed further. They manage themselves and their own hierarchy, so the
    responsibility of the enclosing master component ends here.
  */

  prepareSubmorphsToBeManaged (derivedMorph, master) {
    if (master.isPolicy) master = master.derivedMorph;
    const nameToStylableMorph = {};
    this.withSubmorphsInScopeDo(derivedMorph, m => {
      if (nameToStylableMorph[m.name]) {
        if (!obj.isArray(nameToStylableMorph[m.name])) {
          nameToStylableMorph[m.name] = [nameToStylableMorph[m.name], m];
        } else nameToStylableMorph[m.name].push(m);
      }
      nameToStylableMorph[m.name] = m;
    });
    // assign these based on the current master
    this.withSubmorphsInScopeDo(master, masterSubmorph => {
      let morphToBeStyled = masterSubmorph === master ? derivedMorph : nameToStylableMorph[masterSubmorph.name];
      if (!morphToBeStyled) return;
      if (obj.isArray(morphToBeStyled)) morphToBeStyled = morphToBeStyled.pop();
      this.prepareMorphToBeManaged(morphToBeStyled);
    });

    return nameToStylableMorph;
  }

  /*
    now we have applied everything except for submorphs.
    do we want these to be applied too? That would be useful if we alter the structure of a master component
    later in the game and want that to be reflected in all its derived morphs.
    By what policy are we going to reconcile this change? Via the submorphs names:
  */

  get managedMorphs () {
    const nameToMorphs = arr.groupBy(this.derivedMorph.withAllSubmorphsSelect(m => this.managesMorph(m)), m => m.name);
    for (const name in nameToMorphs) nameToMorphs[name] = nameToMorphs[name][0];
    return nameToMorphs;
  }

  managesMorph (m) {
    // fixme: this wont work if nothing has been overridden so far
    return this._overriddenProps && this._overriddenProps.has(m); // confusing, but works
  }

  propsToSerializeForMorph (m, candidateProps) {
    if (!this.managesMorph(m)) return candidateProps;
    const excludedProps = [];
    const locallyOverridden = this._overriddenProps.get(m); // this.synthesizeProperties(m, this, this.derivedMorph, false);
    for (const propName of this.getStyleProperties(m)) {
      if (locallyOverridden[propName]) continue; // include this if prop is locally overridden
      if (propName === 'position' && m === this.derivedMorph) continue;
      if (propName === 'extent' && m === this.derivedMorph) continue;
      excludedProps.push(propName);
    }
    return arr.withoutAll(candidateProps, excludedProps);
  }

  getOverriddenPropsInMasterContext (submorph) {
    let { auto } = this;
    if (auto.isPolicy) auto = auto.derivedMorph;
    if (auto.isComponentDescriptor) auto = auto.getComponent();
    const nextPolicy = auto && auto.master;
    const correspondingMorph = this.derivedMorph === submorph ? auto : this.findCorrespondingMasterIn(auto, submorph);
    if (nextPolicy && correspondingMorph && nextPolicy.managesMorph(correspondingMorph)) {
      const overridden = obj.keys(nextPolicy._overriddenProps.get(correspondingMorph));
      // only consider the properties "handled" whose value is equal to the corresponding morph in the master hierarchy
      return overridden.filter(prop => obj.equals(submorph[prop], correspondingMorph[prop]));
    }
    if (!nextPolicy &&
        correspondingMorph &&
        obj.equals(correspondingMorph.master, submorph.master)) return ['master'];
    return [];
  }

  prepareMorphToBeManaged (derivedSubmorph) {
    if (!this._overriddenProps.has(derivedSubmorph)) {
      const spec = {};
      const handledByMaster = this.getOverriddenPropsInMasterContext(derivedSubmorph);
      for (const prop in derivedSubmorph._parametrizedProps) {
        if (prop === '__takenFromSnapshot__') continue;
        // we skip the master property if the corresponding master submorph
        // has the master prop directly overridden. In this case we assume it
        // handles this fine already from the start.
        if (handledByMaster.includes(prop)) continue;
        spec[prop] = true;
      }
      this._overriddenProps.set(derivedSubmorph, spec);
    }
  }

  updateComponentsFromModules () {
    const { auto } = this;
    let mod, expr;
    if (auto && auto[Symbol.for('lively-module-meta')]) {
      ({ module: mod, export: expr } = auto[Symbol.for('lively-module-meta')]);
      this.auto = exprSerializer.deserializeExprObj({
        __expr__: expr,
        bindings: { [mod]: [expr] }
      });
    }
  }

  determineMaster (target) {
    const { isHovered, isClicked, mode } = getEventState(target);

    // fixme: also do the proper separation into mouse event / light dark / breakpoints policies
    let master = this.getMasterForState(this, { isHovered, isClicked });

    if (this.light && mode === 'light') {
      master = this.getMasterForState(this.light, { isHovered, isClicked }) || master;
    }
    if (this.dark && mode === 'dark') {
      master = this.getMasterForState(this.light, { isHovered, isClicked }) || master;
    }

    return master;
  }

  getMasterForState ({ auto, hover, click }, { isHovered, isClicked }) {
    let master = auto;
    if (isHovered) {
      if (hover) master = hover;
    }
    if (isClicked) {
      if (click) master = click;
    }
    if (master && master.isComponentDescriptor) return master.getComponent();
    return master;
  }

  // invoked whenever a morph within the managed submorph hierarchy changes
  // we check if the morph is managed and update the overridden props
  onMorphChange (morph, change) {
    if (this._applying) return;
    if (Path('meta.metaInteraction').get(change)) return;
    if (['_rev', 'name'].includes(change.prop)) return;
    if (change.prop === 'opacity') delete this._originalOpacity;

    if (change.prop === 'master' && this.managesMorph(morph)) {
      this._overriddenProps.get(morph).master = true;
    }

    if (morph.styleProperties.includes(change.prop)) {
      if (this.managesMorph(morph)) {
        if (morph.master && morph.master !== this) {
          if (!['extent', 'position'].includes(change.prop)) return;
        }
        this._overriddenProps.get(morph)[change.prop] = true;
        return;
      }

      if (morph._parametrizedProps) morph._parametrizedProps[change.prop] = change.value;
      else morph._parametrizedProps = { [change.prop]: change.value };
    }
  }
}
