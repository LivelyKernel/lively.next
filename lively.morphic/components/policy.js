import { arr, tree, Path, promise, obj } from 'lively.lang';
import { resource } from 'lively.resources';
import { pt } from 'lively.graphics';
import { copy, ExpressionSerializer } from 'lively.serializer2';
import { once } from 'lively.bindings';
import { ProportionalLayout } from '../layout.js';

const exprSerializer = new ExpressionSerializer();

// debugging
export function getOverriddenPropsFor (aMorph) {
  const policyOwner = aMorph.ownerChain().find(m => m.master);
  if (aMorph.master) {
    return {
      local: obj.keys(aMorph.master._overriddenProps.get(aMorph)),
      owner: obj.keys(policyOwner && policyOwner.master._overriddenProps.get(aMorph))
    };
  }
  return policyOwner && obj.keys(policyOwner.master._overriddenProps.get(aMorph));
}

export function printOverriddenProps (aMorph) {
  const overriddenPropsInHierarchy = {};
  const getMasterForMorph = (m) => {
    for (let o of m.ownerChain()) {
      if (o.master && o.master.managesMorph(m)) return o.master;
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

export function findLocalComponents (snapshot) {
  return Object
    .values(snapshot)
    .filter(m => Path('props.isComponent.value').get(m) === true)
    .map(m => m.props.name.value);
}

/**
 * This is an abstract policy, that is not applied to an actual morph
 * but instead is stored inside the internal spec representation of the
 * master component system. Its main purpose is to manage and synthesize
 * specs that can then be used for 1.) deriving new morphs or 2.) applying styles
 */
export class InlinePolicy {
  constructor (spec) {
    this.spec = spec;
    this.prepareIndex();
  }

  get isPolicy () { return true; }

  prepareIndex () {
    this.subSpecIndex = {};
    tree.prewalk(this.spec, node => {
      this.subSpecIndex[node.name] = node;
    }, node => !node.isPolicy && node.submorphs);
  }

  determineMaster (targetMorph) {
    const { master } = this.spec; // masters are specified in the spec
    if (!master) return this; // we are the one responsible
    // now return based on the state of target Morph...
  }

  getSubSpecFor (submorphName) {
    return this.subSpecIndex[submorphName]; // this may also be a sub policy!
  }

  // spec stuff
  synthesizeSpec (submorphNameInPolicyContext, policy, targetMorph) {
    let subSpec = policy.getSubSpecFor(submorphNameInPolicyContext); // get the sub spec for the submorphInPolicyContext
    if (!subSpec) return {}; // policy does not manage the morph at all
    const qualifyingMaster = policy.determineMaster(targetMorph);
    let nextLevelSpec = {};
    if (qualifyingMaster.isComponentDescriptor) {
      nextLevelSpec = qualifyingMaster.getSubSpecFor(submorphNameInPolicyContext); // extract the proper sub spec
    }
    if (qualifyingMaster.isPolicy) {
      nextLevelSpec = qualifyingMaster.synthesizeSpec(submorphNameInPolicyContext, qualifyingMaster, targetMorph);
    }

    return { ...nextLevelSpec, ...subSpec };
  }
}

export class ComponentPolicy {
  static for (derivedMorph, args) {
    let newPolicy;

    if (args.constructor === ComponentPolicy) {
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
      // this.withSubmorphsInScopeDo(this.derivedMorph, m => {
      //   if (m.master) m.master = null;
      // });
      return;
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

  isPositionedByLayout (aSubmorph) {
    return aSubmorph.owner &&
      aSubmorph.owner.layout &&
      aSubmorph.owner.layout.layoutableSubmorphs.includes(aSubmorph);
  }

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

  withSubmorphsInScopeDo (scopeMorph, cb) {
    return scopeMorph.withAllSubmorphsDoExcluding(cb, m => scopeMorph !== m && m.master);
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
    const { world, eventDispatcher } = target.env;
    const mode = world && world.colorScheme; // "dark" | "light"
    const isHovered = eventDispatcher && eventDispatcher.isMorphHovered(target); // bool
    const isClicked = eventDispatcher && eventDispatcher.isMorphClicked(target); // bool

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
