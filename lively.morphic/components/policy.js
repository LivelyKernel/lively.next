import { arr, Path, promise, obj } from 'lively.lang';
import { registerExtension, Resource, resource } from 'lively.resources';
import { pt } from 'lively.graphics';
import { ObjectPool, copy, ExpressionSerializer, allPlugins, normalizeOptions } from 'lively.serializer2';
import { subscribeOnce } from 'lively.notifications';
import { once } from 'lively.bindings';
import * as ast from 'lively.ast';

import MorphicDB from '../morphicdb/db.js';
import { ProportionalLayout } from '../layout.js';
import { deserializeMorph, loadPackagesAndModulesOfSnapshot } from '../serialization.js';

let localNamePromise;
const modulesToLoad = modulesToLoad || {}; // eslint-disable-line no-use-before-define
const masterComponentFetches = masterComponentFetches || {}; // eslint-disable-line no-use-before-define
const worldToUrl = worldToUrl || {}; // eslint-disable-line no-use-before-define

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

function getProjectName (world) {
  return Path('metadata.commit.name').get(world) || world.name;
}

function ensureAbsoluteComponentRefs (
  {
    snapshotAndPackages,
    localComponents = findLocalComponents(snapshot),
    localWorldName = Path('metadata.commit.name').get($world)
  }) {
  const { packages } = snapshotAndPackages;
  // transform the code inside tha packages in case the reference local components
  Object.values(packages['local://lively-object-modules/'] || {}).forEach(pkgModules => {
    // parse each module for local component references part://$world or styleguide://$world and replace
    // with absolute version
    // IF THE SNAPSHOT DOES NOT INCLUDE THAT LOCAL COMPONENT
    Object.entries(pkgModules).forEach(([moduleName, source]) => {
      if (moduleName.endsWith('.json')) return;
      const parsed = ast.parse(source);
      const nodesToReplace = [];
      ast.AllNodesVisitor.run(parsed, (node, path) => {
        if (node.type === 'Literal' && typeof node.value === 'string') {
          if (node.value.match(/^styleguide:\/\/\$world\/.+/) && !localComponents.includes(node.value.replace('styleguide://$world/', ''))) {
            nodesToReplace.push({
              target: node,
              replacementFunc: () => JSON.stringify(node.value.replace('$world', localWorldName))
            });
          }
          if (node.value.match(/^part:\/\/\$world\/.+/) && !localComponents.includes(node.value.replace('part://$world/', ''))) {
            nodesToReplace.push({
              target: node,
              replacementFunc: () => JSON.stringify(node.value.replace('$world', localWorldName))
            });
          }
        }
      });
      pkgModules[moduleName] = ast.transform.replaceNodes(nodesToReplace, source).source;
    });
  });
}

const exprSerializer = new ExpressionSerializer();

export class StyleguidePlugin {
  afterSerialization (pool, snapshot, rootId) {
    // determine all components that are part of this snapshot and could be resolved locally
    // all the other ones are left as absolute paths

    // also check for all morphs that can not be resolved locally yet declared as local
    // in those cases convert to absolute references
    const masterURLRemapping = {};
    const localComponentUrl = `styleguide://${getProjectName($world)}`;
    findLocalComponents(snapshot).forEach(componentName =>
      masterURLRemapping[`${localComponentUrl}/${componentName}`] = `styleguide://$world/${componentName}`
    );
    Object.values(snapshot).forEach((entry) => {
      if (!entry.props) return;
      const { master } = entry.props;
      if (master && master.value && obj.isString(master.value)) {
        for (const url in masterURLRemapping) {
          if (Object.values(pool.expressionSerializer.deserializeExpr(master.value)).includes(url)) {
            master.value = master.value.split(url).join(masterURLRemapping[url]);
          }
        }
        // master.value = master.value.split(localComponentUrl).join('styleguide://$world'); // NO! this can not nessecarily be resolved since the master components are not carried over. what is this supposed to do??
      }
    });
  }
}

// once(ComponentPolicy[Symbol.for("lively-module-meta")].package, 'name', () => { debugger })
// ComponentPolicy[Symbol.for("lively-module-meta")].package.name
// meta = ComponentPolicy[Symbol.for("lively-module-meta")]
// meta === ComponentPolicy[Symbol.for("lively-module-meta")]
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

    if (args.isMorph || typeof args === 'string') {
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
      spec.overriddenProps[m == this.derivedMorph ? '__root__' : m.name] = copy(obj.select(m, obj.keys(this._overriddenProps.get(m))));
    });
    return spec;
  }

  equals (other) {
    if (!other) return false;
    if (typeof other === 'string') {
      other = other.replace('styleguide://$world', `styleguide://${getProjectName($world)}`);
      let self = this.getResourceUrlFor(this.auto);
      if (self) self = self.replace('styleguide://$world', `styleguide://${getProjectName($world)}`);
      return self === other;
    }
    if (other.auto === this) return true;
    for (const master of ['auto', 'click', 'hover']) {
      if (typeof other[master] === 'string') {
        if (this.getResourceUrlFor(this[master]) !== other[master] || null) return false;
      } else if ((this[master] || null) !== (other[master] || null)) return false;
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
    this.withSubmorphsInScopeDo(derivedMorph, m => {
      let overridden = {};
      const res = oldPolicy.synthesizeProperties(m, oldPolicy /* makes us traverse the previous policy chain */, derivedMorph, false);
      for (let prop in res) {
        overridden[prop] = true;
      }
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
    // we also need to take into account the master scoping
    // avoiding ambiguos/clashing names!
    const policiesInHierarchy = [...owners.filter(m => m.owner && m.master).map(m => m.name).reverse(), derivedMorph.name];
    const { export: exportedName, module: modulePath } = topLevelComponent[Symbol.for('lively-module-meta')];
    // this may just be leading to incorrect masters because the policies are not yet fully applied
    return {
      __expr__: exportedName + policiesInHierarchy.map(policyOwner => `.get("${policyOwner}")`).join('') + '.master',
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

  getResourceUrlFor (component) {
    if (!component) return null;
    if (component._resourceHandle) return component._resourceHandle.url.replace('$world', getProjectName($world)); // we leave this being for remote masters :)
    if (component.name === undefined) return null;
    // else we assume the component resides within the current world
    return `styleguide://${getProjectName($world)}/${component.name}`;
  }

  getWorldUrlFor (component) {
    const worldOfMaster = resource(typeof component === 'string ' ? component : this.getResourceUrlFor(component)).worldName;
    if (worldOfMaster === getProjectName($world)) {
      return document.location.href;
    }
    return worldToUrl[worldOfMaster];
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
    // when does this happen???
    
    if (!this._requestedDelayedExecution && !(target.env.world || target.env.eventDispatcher)) {
      // wait for env to be installed but already prepare the morph
      // such that in case it is getting copied before the first application
      // the overridden props are carried over properly
      if (!this._hasUnresolvedMaster) this.prepareSubmorphsToBeManaged(target, this.auto);
      target.env.onSetWorldDo(this._requestedDelayedExecution = () => {
        // remove the parametrized props from the submorph hierarchy here
        if (this.derivedMorph.master === this) { this.applyIfNeeded(needsUpdate, animationConfig); }
      });
      return;
    }
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
    if (master 
    // && this._appliedMaster !== master // fixme: find a better heuristic for need to update
    ) needsUpdate = true;
    if (master && needsUpdate) {
      this.apply(target, master);
      this._appliedMaster = master;
    }
    
    let overriddenProps;
    if (overriddenProps = this._overriddenPropsToApply) {
      delete this._overriddenPropsToApply;
      this.withSubmorphsInScopeDo(target, m => {
        if (m == target) Object.assign(m, overriddenProps.__root__ || {});
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
   * @param { boolean } includeTopLevelComponent - Wether or not to collect to properties in the top level component as well.
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
    if (qualifyingMaster && qualifyingMaster.isComponent) {
      correspondingMasterSubmorph = isRoot ? qualifyingMaster : this.findCorrespondingMasterIn(qualifyingMaster, submorphInPolicyContext);
    }
    let synthesizedPropsOfTopLevelMaster;
    for (let prop of this.getStyleProperties(submorphInPolicyContext)) {
      // 1. if the property is overridden in the context of the policy return the value of the submorph here
      if (overriddenProps[prop]) {
        synthesizedProps[prop] = submorphInPolicyContext[prop]; // ref issue are handled by the application code
        continue;
      }
      // 2. if the property is not overridden locally, then we investigate further and ask the approproiate
      //    qualifying master the policy would suggest instead
      // 2.A: The qualifying master is itself again a policy
      if (qualifyingMaster.isPolicy) {
        // we recursively synthesize the properties and cache them for efficiency reasons
        const nextLevelPolicy = qualifyingMaster;
        let next = nextLevelSynthesizedProps.get(nextLevelPolicy);
        if (!next) {
          const submorphInNextPolicyContext = isRoot ? nextLevelPolicy.derivedMorph : nextLevelPolicy.getManagedMorph(submorphInPolicyContext.name);
          if (!submorphInNextPolicyContext) {
            synthesizedProps[prop] = submorphInPolicyContext[prop]; // ref issue are handled by the application code
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
            // if this is a sub-master that has not changed, there still may be
            // a sub-sub... master that has some overridden properties and still needs to be visited
            morphToBeStyled.requestMasterStyling(); // always trigger the master styling here
            // 
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
    for (const propName of this.getStyleProperties(m)) {
      if (this._overriddenProps.get(m)[propName]) continue;
      if (propName === 'position' && m === this.derivedMorph) continue;
      if (propName === 'extent' && m === this.derivedMorph) continue;
      excludedProps.push(propName);
    }
    return arr.withoutAll(candidateProps, excludedProps);
  }

  getOverriddenPropsInMasterContext (submorph) {
    let { auto } = this;
    if (auto.isPolicy) auto = auto.derivedMorph;
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
      // else if (master && master.isComponent) { // referencing a top level component
      //   // drill down in the master chain if a different hover can be found on this component
      //   let nextPolicy = master && master.master;
      //   const seen = [];
      //   while (nextPolicy) {
      //     if (nextPolicy.hover) {
      //       master = nextPolicy.hover;
      //       break;
      //     }
      //     nextPolicy = Path('auto.master').get(nextPolicy); // if this references a policy again we break 
      //     if (seen.includes(nextPolicy)) break; // break circular refs
      //     seen.push(nextPolicy);
      //   }
      // }
    }
    if (isClicked) {
      // master = auto; // start from beginning
      if (click) master = click;
      // else {
      //   // drill down in the master chain if a different click can be found
      //   let superMaster = master && master.master;
      //   const seen = [];
      //   while (superMaster) {
      //     if (superMaster.click) {
      //       // take into account the overridden props of the masters in between
      //       master = superMaster.click;
      //       break;
      //     }
      //     superMaster = Path('auto.master').get(superMaster);
      //     if (seen.includes(superMaster)) break;
      //     seen.push(superMaster);
      //   }
      // }
    }
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

/*
  use like:

  by just passing a default single master (default):

  morph({
    master: masterMorph;
      => ComponentPolicy(masterMorph);
  })

  or via style-guide url: (useful for tool support)

  morph({
    master: "styleguide://StyleGuideWorldName/path/based/master/name"
      => ComponentPolicy("styleguide://StyleGuideWorldName/path/based/master/name")
  })

  by passing different masters for hover/click states:

  morph({
    master: {
      hover: hoverMasterMorph,
      auto: defaultMasterMorph,
      click: "styleguide://StyleGuideWorldName/masterName/clicked", // also possible via paths
    }
      => ComponentPolicy({
      hover: hoverMasterMorph,
      auto: defaultMasterMorph,
      click: "styleguide://StyleGuideWorldName/masterName/clicked", // also possible via paths
    })
  })

  also can distinguish between light and dark mode theme

  morph({
    master: {
      light: {
        hover: hoverMasterMorph,
        auto: defaultMasterMorph,
        click: "styleguide://StyleGuideWorldName/masterName/clicked", // also possible via paths
      },
      dark: {
        ...
      }
    }
  })

  // can be applied animated

  m.animate({ master: newMaster, duration: 500 }) // applies the new master via transition

  => a morph can become a master

  // components can not be dropped into itself!

  aMorph.isComponent => true
  aMorph._derivedMorphs => ["morph-uuid1", "morph-uuid", ...]

  // on change of prop, all derived morphs need to be updated. But only the one to be found in the world (i.e the ones that are rendered. When a morph get's added to the world somewhere, he automatically requests updated styling from its master)

  // can also manage "remote components", i.e. use components from a different world

*/

// STYLEGUIDE RESOURCE EXTENSION

/*

when master components and derived morphs reside within the same world, everything is simple: Freezing just fetches the needed referenced master components => small loading footprint.

What happens if we import master components from another style guide? Basically a style guide is any world that contains components. You can uniquely identify such a component by the following url identifier:

    "styleguide://StyleGuideWorldName/path/based/master/name"

This identifier is resolved and fetched in a way that requires the least amount of data transfer, while also importing the components in a way the gives rise to the smallest data footprint.

   => we do not want to load the complete world if we just want to fetch a couple of master components from it
   => we do want master components to share the same derived masters as possible to reduce snapshot size (especially in frozen morphs)

This is done by mainating a local registry, where the resource extension keeps an object pool and on demand incrementally deserializes master components as needed. Furthermore these mastercomponents are declared as EPI morphs such that they are not stored with the world they are imported in. ComponentPolicys which are serialized with these identifiers fetch the most recent version of these style guides the next time they are loaded. That way styling is kept up to date across the whole system.

*/

const styleGuideURLRe = /^styleguide:\/\/([^\/]+)\/(.*)$/;

const fetchedSnapshots = fetchedSnapshots || {}; // eslint-disable-line no-use-before-define
const fetchedMasters = fetchedMasters || {}; // eslint-disable-line no-use-before-define
const resolvedMasters = resolvedMasters || {}; // eslint-disable-line no-use-before-define

/*
async function findUnresolvedMasters() {
  const masterNames = new Set(Object.keys(fetchedMasters));
  Object.entries(fetchedMasters).forEach(([key, val]) => {
    val.then(() => masterNames.delete(key))
  })
  await promise.delay(100)
  return [...masterNames]
}
await findUnresolvedMasters()
*/

export { resolvedMasters };

export function reset () {
  localNamePromise = null;
}

export function clearSnapshot (name) {
  delete fetchedSnapshots[name];
}

export class StyleGuideResource extends Resource {
  get canDealWithJSON () { return false; }

  get componentName () {
    const match = this.url.match(styleGuideURLRe);
    const [_, __, name] = match;
    return name;
  }

  get worldName () {
    const match = this.url.match(styleGuideURLRe);
    let [_, worldName, __] = match;
    if (worldName === '$world') worldName = this.localWorldName();
    return worldName;
  }

  async dirList (depth, opts) {
    // provide dir last by filtering the components inside the world via the slash based naming scheme
    if (this.worldName === getProjectName($world)) {
      return arr.uniq([...$world.localComponents, ...$world.withAllSubmorphsSelect(m => m.isComponent)]);
    }

    const remoteMasters = resolvedMasters[this.worldName];
    if (remoteMasters) return Object.values(remoteMasters);

    return [];
  }

  localWorldName () {
    let localName;

    if (localName = getProjectName($world)) {
      return localName;
    }

    if (localNamePromise) { return localNamePromise; }

    let resolve;
    ({ resolve, promise: localNamePromise } = promise.deferred());

    if (resource(document.location.href).query().name === '__newWorld__') {
      resolve('__newWorld__');
      return localNamePromise;
    }

    subscribeOnce('world/loaded', () => {
      resolve(getProjectName($world));
    }, System);

    return localNamePromise;
  }

  fetchFromMasterDir (masterDir, name) {
    const res = masterDir.join(this.worldName).join(name + '.json');
    if (masterComponentFetches[res.url]) return masterComponentFetches[res.url];
    masterComponentFetches[res.url] = (async () => deserializeMorph(await res.readJson()))();
    return masterComponentFetches[res.url];
  }

  async read () {
    const name = this.componentName;
    const worldName = await this.worldName;
    let component = Path([worldName, this.componentName]).get(resolvedMasters);
    if (component) return component;

    // check if an isolated file exists before fetching the entire world snapshot
    const isolatedSnap = resource(System.baseURL).join('components_cache').join(worldName).join(name + '.json');
    if (typeof fetchedMasters[isolatedSnap.url] === 'undefined') {
      let resolveMasterDirectly;
      ({ resolve: resolveMasterDirectly, promise: fetchedMasters[isolatedSnap.url] } = promise.deferred());
      if (await this.localWorldName() === worldName) {
        component = typeof $world !== 'undefined' && ($world.localComponents.find(c => c.name === name));
        if (!component) { throw Error(`Master component "${name}" can not be found in "${worldName}"`); }
        resolveMasterDirectly(component); // proceed in original control flow
      } else if (await isolatedSnap.exists()) {
        // this can only happen from json stored core styleguides
        try {
          worldToUrl[worldName] = resource(System.baseURL).join('worlds/load').withQuery({
            file: 'lively.morphic/styleguides/' + worldName + '.json'
          }).url;
          const snapshot = await isolatedSnap.readJson();
          await loadPackagesAndModulesOfSnapshot(snapshot);
          component = deserializeMorph(snapshot);
          await this.resolveComponent(component);
          resolveMasterDirectly(component); // notify other waiting
        } catch (err) {
          resolveMasterDirectly(null); // no direct resolution possible
        }
      } else {
        resolveMasterDirectly(null); // no direct resolution possible
      }
    } else component = await fetchedMasters[isolatedSnap.url];

    if (component) return component;
    // announce we are about to fetch this snapshot;
    let resolveSnapshot;
    if (!fetchedSnapshots[worldName]) {
      console.log('scheduling fetch of', worldName);
      ({ resolve: resolveSnapshot, promise: fetchedSnapshots[worldName] } = promise.deferred());
    }

    let snapshot;
    if (resolveSnapshot) {
      const db = MorphicDB.default;
      if ((await db.fetchCommit('world', worldName))) {
        snapshot = await db.fetchSnapshot('world', worldName);
        worldToUrl[worldName] = resource(System.baseURL).join('worlds/load').withQuery({
          name: worldName
        }).url;
      } else {
        // try to get the JSON (fallback)
        const jsonRes = resource(System.baseURL).join('lively.morphic/styleguides').join(worldName + '.json');
        if (await jsonRes.exists()) {
          snapshot = await jsonRes.readJson();
          worldToUrl[worldName] = resource(System.baseURL).join('worlds/load').withQuery({
            file: 'lively.morphic/styleguides/' + worldName + '.json'
          }).url;
        } else resolveSnapshot(null); // total fail
      }
      // transpile the packages
      ensureAbsoluteComponentRefs({ snapshotAndPackages: snapshot, localComponents: [], localWorldName: this.worldName });
      await loadPackagesAndModulesOfSnapshot(snapshot); // this takes a looong time... and loads a bunch of stuff we often never need, only load the stuff that is directly required by the sub-snap
      // fix all the references to $world inside that snapshot
      Object.values(snapshot.snapshot)
        .filter(m => m.props.master)
        .forEach(m => {
          const masterExpr = m.props.master.value;
          if (obj.isString(masterExpr)) {
            m.props.master.value = masterExpr.split('$world').join(this.worldName);
          }
        });
      resolveSnapshot(snapshot);
    } else snapshot = await fetchedSnapshots[worldName];

    const pool = new ObjectPool(normalizeOptions({
      plugins: [new StyleguidePlugin(), ...allPlugins]
    }));

    const [idToDeserialize] = Object.entries(snapshot.snapshot).find(([k, v]) => {
      return Path('props.isComponent.value').get(v) && Path('props.name.value').get(v) === name;
    }) || [];

    if (!idToDeserialize) throw Error(`Master component "${name}" can not be found in "${worldName}"`);

    // load modules for that part of the snap, if it is required

    component = pool.resolveFromSnapshotAndId({ ...snapshot, id: idToDeserialize });

    return await this.resolveComponent(component);
  }

  async resolveComponent (component) {
    const name = this.componentName;
    if (resolvedMasters[this.worldName]) resolvedMasters[this.worldName][name] = component;
    else resolvedMasters[this.worldName] = { [name]: component };

    component._resourceHandle = this;

    if (component._pool && component._pool.mastersInSubHierarchy) {
      // fixme: apply these in hierarchical order
      for (const master of component._pool.mastersInSubHierarchy) {
        await master.applyIfNeeded(true);
        if (!master.derivedMorph.ownerChain().includes(component)) {
          master.derivedMorph.requestMasterStyling();
        }
      }
      delete component._pool;
    }

    return component;
  }

  async write (source) {
    throw Error('Master Components can not be written to!');
  }

  async exists () {
    // checks if the morph exists
    const component = typeof $world !== 'undefined' && $world.localComponents.find(m => m.name === this.morphName);
    return component && component.isComponent;
  }

  async remove () {
    // revokes the component
    const component = typeof $world !== 'undefined' && $world.localComponents.find(m => m.name === this.morphName);
    if (component) component.isComponent = false;
    return true;
  }
}

export const resourceExtension = {
  name: 'styleguide',
  matches: (url) => url.match(styleGuideURLRe),
  resourceClass: StyleGuideResource
};

registerExtension(resourceExtension);
