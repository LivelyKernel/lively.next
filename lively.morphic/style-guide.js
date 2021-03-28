import { arr, properties, Path, promise, obj } from 'lively.lang';
import { registerExtension, Resource, resource } from 'lively.resources';
import { pt } from 'lively.graphics';
import MorphicDB from './morphicdb/db.js';
import { ObjectPool, allPlugins, normalizeOptions } from 'lively.serializer2';
import { deserializeMorph, loadPackagesAndModulesOfSnapshot } from './serialization.js';
import { subscribeOnce } from 'lively.notifications/index.js';
import { once } from 'lively.bindings';
import * as ast from 'lively.ast';

/*

  Direct Manipulation Interface for Master Components

  // halo
  // allow to create derived morphs / plain copies via halo copy
  // warn/prevent user from renaming managed morphs
  // make it harder to override props (e.g. double click to confirm?)

  // styling side bar
  // allow to detach morph from master
  // allow morph to be attached to new master
  // allow to clear overridden props (completely or selectively)

  // top bar
  // allows morphs to be turned into components, turned back into plain morphs (auto detach from all derived morphs)
  // allows to browse components locally or exported from different worlds (categorized via "/" naming scheme taken from figma)

*/

function ensureAbsoluteComponentRefs (
  {
    snapshotAndPackages,
    localComponents = findLocalComponents(snapshot),
    localWorldName = Path('metadata.commit.name').get($world)
  }) {
  const { snapshot, packages } = snapshotAndPackages;
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

export function findLocalComponents (snapshot) {
  return Object
    .values(snapshot)
    .filter(m => Path('props.isComponent.value').get(m) == true)
    .map(m => m.props.name.value);
}

export class StyleguidePlugin {
  afterSerialization (pool, snapshot, rootId) {
    // determine all components that are part of this snapshot and could be resolved locally
    // all the other ones are left as absolute paths
    const masterURLRemapping = {};
    const localComponentUrl = `styleguide://${getProjectName($world)}`;
    findLocalComponents(snapshot).forEach(componentName =>
      masterURLRemapping[`${localComponentUrl}/${componentName}`] = `styleguide://$world/${componentName}`
    );
    Object.values(snapshot).forEach(({ props: { master } }) => {
      if (master && master.value) {
        for (const url in masterURLRemapping) {
          if (master.value.includes(url)) { master.value = master.value.split(url).join(masterURLRemapping[url]); }
        }
        master.value = master.value.split(localComponentUrl).join('styleguide://$world');
      }
    });
  }
}

export async function prefetchCoreStyleguides (li) {
  li.label = 'loading System Elements';
  li.progress = 0;
  li.status = 'core elements...';
  await resource('styleguide://System/buttons/light').read(),
  li.progress = 1 / 5;
  li.status = 'top bar...';
  await resource('styleguide://SystemIDE/lively top bar master').read(),
  li.progress = 2 / 5;
  li.status = 'scene graph...';
  await resource('styleguide://SystemIDE/styling side bar master').read(),
  li.progress = 3 / 5;
  li.status = 'styling palette...';
  await resource('styleguide://SystemIDE/scene graph side bar master').read();
  li.progress = 4 / 5;
  li.status = 'world loader...';
  await resource('styleguide://partial freezing/project browser').read();
  li.progress = 5 / 5;
  await promise.delay(500);
}

function getProjectName (world) {
  return Path('metadata.commit.name').get(world) || world.name;
}

export class ComponentPolicy {
  static for (derivedMorph, args) {
    let newPolicy;

    if (args.constructor === ComponentPolicy) newPolicy = args;
    else newPolicy = new this(derivedMorph, args);

    if (derivedMorph.master) {
      newPolicy._overriddenProps = derivedMorph.master._overriddenProps;
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
      if (args.isMorph) { this.auto.isComponent = true; } // just to make sure. Seems a little redundant though.
      // Via direct manipulation this should never be nessecary.
      // In code this can happen, when the user forgets to set this flag.
      if (typeof args === 'string') this.resolveMasterComponents();
      return;
    }

    const { click, auto, hover, light = {}, dark = {} } = args;
    if (light) this.light = light;
    if (dark) this.dark = dark;
    if (click) this.click = click;
    if (auto) this.auto = auto;
    if (hover) this.hover = hover;
    this.resolveMasterComponents();
  }

  uses (masterComponent) {
    return [this.auto, this.click, this.hover].includes(masterComponent);
  }

  spec () {
    return obj.select(this, ['auto', 'click', 'hover', 'light', 'dark']);
  }

  equals (other) {
    if (!other) return false;
    if (typeof other === 'string') {
      if (!lively.FreezerRuntime) { other = other.replace('styleguide://$world', `styleguide://${getProjectName($world)}`); }
      return this.getResourceUrlFor(this.auto) == other;
    }
    for (const master of ['auto', 'click', 'hover']) {
      if (typeof other[master] === 'string') {
        if (this.getResourceUrlFor(this[master]) != other[master] || null) return false;
      } else if ((this[master] || null) != (other[master] || null)) return false;
    }
    return true;
  }

  // called on serialization of Component
  getManagedMorphs () {
    const managedMorphs = [];
    this.derivedMorph.withAllSubmorphsDo(m => {
      if (this.managesMorph(m)) {
        const propKeys = Object.keys(this._overriddenProps.get(m)).filter(k => k != '_rev');
        if (propKeys.length > 0) { managedMorphs.push([m, Object.keys(this._overriddenProps.get(m))]); }
      }
    });
    return managedMorphs;
  }

  get __dont_serialize__ () {
    const excludedProps = ['_overriddenProps', '_applying', '_appliedMaster', '_hasUnresolvedMaster'];
    if (obj.isEmpty(this.dark)) excludedProps.push('dark');
    if (obj.isEmpty(this.light)) excludedProps.push('light');
    return excludedProps;
  }

  __serialize__ () {
    const spec = {};

    // sometimes we serialize without being fully components having been resolved yet.
    // in those cases we just directly use the urls
    const getResourceUrl = (c) => obj.isString(c) ? c : this.getResourceUrlFor(c);

    if (this.auto) spec.auto = getResourceUrl(this.auto);
    if (this.click) spec.click = getResourceUrl(this.click);
    if (this.hover) spec.hover = getResourceUrl(this.hover);

    return {
      __expr__: `(${JSON.stringify(spec)})`
    };
  }

  __after_deserialize__ (snapshot, objRef) {
    this._overriddenProps = new WeakMap();
    delete this.managedMorphs;
    this.resolveMasterComponents();
  }

  async whenApplied () {
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
    if (component.name == undefined) return null;
    // else we assume the component resides within the current world
    return `styleguide://${getProjectName($world)}/${component.name}`;
  }

  getWorldUrlFor (component) {
    const worldOfMaster = resource(typeof component === 'string ' ? component : this.getResourceUrlFor(component)).worldName;
    if (worldOfMaster == getProjectName($world)) {
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
    // return promise.waitFor(config.duration * 2, () => !this._animationConfig);
  }

  applyIfNeeded (needsUpdate = false, animationConfig = false) {
    if (animationConfig) this._animationConfig = animationConfig;
    const target = this.derivedMorph;
    if (!target.env.world) {
      // wait for env to be installed
      once(target.env, 'world', () => {
        this.applyIfNeeded(needsUpdate, animationConfig);
      });
      return;
    }
    if (!target.env.eventDispatcher) {
      // wait for env to be installed fully
      once(target.env, 'eventDispatcher', () => {
        this.applyIfNeeded(needsUpdate, animationConfig);
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
      // this clogs up the main thread. Instead use a callback from the master.
      return this._hasUnresolvedMaster.then(() => {
        this.applyIfNeeded(needsUpdate);
        target.withMetaDo({ metaInteraction: true }, () => {
          target.opacity = this._originalOpacity;
        });
        delete this._originalOpacity;
        delete this._capturedExtents;
      });
    }
    const master = this.determineMaster(target);
    if (master && this._appliedMaster != master) needsUpdate = true;
    if (master && needsUpdate) {
      this.apply(target, master);
      this._appliedMaster = master;
    }
  }

  getStyleProperties (masterComponent) {
    const { properties, order } = masterComponent.propertiesAndPropertySettings();
    const styleProps = [];
    for (const prop of order) {
      if (properties[prop].isStyleProp) {
        styleProps.push(prop);
      }
    }
    return styleProps;
  }

  apply (derivedMorph, master, animationConfig = this._animationConfig) {
    // traverse the masters submorph hierarchy
    if (this._applying) return;
    this._applying = true;
    try {
      const apply = () => derivedMorph.withMetaDo({ metaInteraction: true }, () => {
        const nameToStylableMorph = this.prepareSubmorphsToBeManaged(derivedMorph, master);
        master.withAllSubmorphsDoExcluding(masterSubmorph => {
          const isRoot = masterSubmorph == master;
          let morphToBeStyled = isRoot ? derivedMorph : nameToStylableMorph[masterSubmorph.name]; // get all named?
          if (!morphToBeStyled) return; // morph to be styled is not present. can this happen? Not when working via direct manipulation tools. But can happen when you work in code purely. In those cases we resort to silent ignore.
          if (obj.isArray(morphToBeStyled)) morphToBeStyled = morphToBeStyled.pop();
          if (masterSubmorph.master && !isRoot) { // can not happen to the root since we ruled that out before
            // only do this when the master has changed

            if (!masterSubmorph.master.equals(morphToBeStyled.master) &&
                !this._overriddenProps.get(morphToBeStyled).master) {
              morphToBeStyled.master = masterSubmorph.master.spec(); // assign to the same master
              morphToBeStyled.requestMasterStyling();
            }
          }
          if (morphToBeStyled.master && !isRoot) {
            const overriddenProps = morphToBeStyled.master._overriddenProps.get(morphToBeStyled) || {};

            // but enforce extent and position since that is not done by the master itself
            if (!overriddenProps.position) {
              morphToBeStyled.position = masterSubmorph.position;
            }
            if (!overriddenProps.extent) {
              morphToBeStyled.extent = masterSubmorph.extent;
            }
            return; // style application is handled by that master
          }

          for (const propName of this.getStyleProperties(masterSubmorph)) {
            if (this._overriddenProps.get(morphToBeStyled)[propName]) continue;
            // secial handling for ... layout (copy())
            if (propName == 'layout') {
              if (morphToBeStyled.layout && masterSubmorph.layout &&
                  morphToBeStyled.layout.name() == masterSubmorph.layout.name() &&
                  morphToBeStyled.layout.equals(masterSubmorph.layout)) { continue; }
              morphToBeStyled.layout = masterSubmorph.layout ? masterSubmorph.layout.copy() : undefined;
              continue;
            }
            if (masterSubmorph == master) {
              if (propName == 'extent' &&
                  !morphToBeStyled.extent.equals(pt(10, 10)) &&
                  (
                    !morphToBeStyled.owner ||
                     morphToBeStyled.owner.isWorld ||
                     morphToBeStyled.ownerChain().find(m => m.master && m.master.managesMorph(morphToBeStyled)))
                  // not already styled by other master
              ) continue;
              if (propName == 'position') continue;
            }

            // if (propName == 'origin') {
            //   morphToBeStyled.adjustOrigin(masterSubmorph.origin);
            //   continue;
            // }
            // fixme: other special cases??
            if (morphToBeStyled.isLabel && propName == 'extent') continue;

            if (['border', 'borderTop', 'borderBottom', 'borderRight', 'borderLeft'].includes(propName)) continue; // handled by sub props;

            if (!obj.equals(morphToBeStyled[propName], masterSubmorph[propName])) { morphToBeStyled[propName] = masterSubmorph[propName]; }

            // we may be late for the game when setting these props
            // se we need to make sure, we restore the morphs "intended extent"
            // for this purpose we enfore the masterSubmorph extent
            if (['fixedHeight', 'fixedWidth'].includes(propName) &&
                morphToBeStyled._parametrizedProps &&
                morphToBeStyled._parametrizedProps.extent) {
              morphToBeStyled.extent = morphToBeStyled._parametrizedProps.extent;
            }
          }
          if (morphToBeStyled._parametrizedProps) { delete morphToBeStyled._parametrizedProps; }
          // this.reconcileSubmorphs(morphToBeStyled, masterSubmorph);
        }, masterSubmorph => master != masterSubmorph && masterSubmorph.master);
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
    const spec = this._overriddenProps.get(derivedMorph);
    this._overriddenProps.set(derivedMorph, obj.dissoc(spec, propsToClear));
  }

  prepareSubmorphsToBeManaged (derivedMorph, master) {
    const nameToStylableMorph = {};
    derivedMorph.withAllSubmorphsDoExcluding(m => {
      if (nameToStylableMorph[m.name]) {
        if (!obj.isArray(nameToStylableMorph[m.name])) {
          nameToStylableMorph[m.name] = [nameToStylableMorph[m.name], m];
        } else nameToStylableMorph[m.name].push(m);
      }
      nameToStylableMorph[m.name] = m;
    }, m => m != derivedMorph && m.master);
    // assign these based on the current master
    master.withAllSubmorphsDoExcluding(masterSubmorph => {
      let morphToBeStyled = masterSubmorph == master ? derivedMorph : nameToStylableMorph[masterSubmorph.name];
      if (!morphToBeStyled) return;
      if (obj.isArray(morphToBeStyled)) morphToBeStyled = morphToBeStyled.pop();
      this.prepareMorphToBeManaged(morphToBeStyled);
    }, masterSubmorph => masterSubmorph != master && masterSubmorph.master);

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

  async reconcileSubmorphs () {
    /*
      reconciliation strategy: resolution of identity via name. try to preserve existing (local morphs) with names as much as possible. If their name is nowhere to be found in the restructured master, discard them.
      new (not yet existing) morphs are inserted into the hierarchy at their precise relative position, and provided with their appropriate submorphs
      this is a soft approach, since we only add morphs to the hierarchy that did not exist before, and remove morphs that are not needed any more
    */
    await this.whenReady();

    const managedMorphs = this.managedMorphs;
    let insertedMorphs = [];
    const master = this._appliedMaster || this.auto;

    managedMorphs[master.name] = this.derivedMorph; // hack

    if (!master) return; // no applied master, nothing to reconcile...

    master.withAllSubmorphsDo(masterSubmorph => {
      if (master && masterSubmorph == master) {
        // surely no change here...
        insertedMorphs.push(masterSubmorph, this.derivedMorph);
        return;
      }
      let morphToInsert;
      // morph already exists in our hierarchy
      if (morphToInsert = managedMorphs[masterSubmorph.name]) {
        // ensure morph has correct owner
        if (morphToInsert.owner.name == masterSubmorph.owner.name) {
          // if so, we are done
          insertedMorphs.push(morphToInsert); // already inserted...
          return;
        }
        // if not we need to insert this already existing morph at the correct position
        // if the new parent already exists, neat! We just append it to that one
        let ownerToBeAddedTo;
        if (ownerToBeAddedTo = managedMorphs[masterSubmorph.owner.name]) {
          const insertionIndex = masterSubmorph.owner.submorphs.indexOf(masterSubmorph);
          insertedMorphs.push(ownerToBeAddedTo.addMorphAt(morphToInsert, insertionIndex));

          return;
        }
        // this cant happen really...
        throw new Error('Missing a owner that had to be added previously....');
      } else {
        // insert morph into correct position
        morphToInsert = managedMorphs[masterSubmorph.name] = masterSubmorph.copy();
        const ownerToBeAddedTo = managedMorphs[masterSubmorph.owner.name]; // this must have been resolved
        const insertionIndex = masterSubmorph.owner.submorphs.indexOf(masterSubmorph);
        if (!morphToInsert.master) morphToInsert.submorphs = []; // handle submorphs separately
        insertedMorphs.push(ownerToBeAddedTo.addMorphAt(morphToInsert, insertionIndex));
      }
    });

    insertedMorphs = arr.compact(insertedMorphs);

    // finally we remove all the morphs that have not been inserted any more
    Object.values(obj.dissoc(managedMorphs, insertedMorphs.map(m => m.name))).forEach(removedMorph => {
      console.log(managedMorphs, insertedMorphs.map(m => m.name));
      removedMorph.remove();
    });

    // const [allManaged, allOthers] = arr.partition(morphToBeStyled.submorphs, m => this.managesMorph(m));
    // const toBeAdded = masterSubmorph.submorphs
    //   .filter(({ name }) => ![...allManaged, ...allOthers].find(m => m.name == name))
    //   .map(m => m.copy());
    // toBeAdded.forEach(m => this.prepareMorphToBeManaged(m));
    // const toBeRemoved = allManaged.filter(({ name }) => !masterSubmorph.submorphs.find(m => m.name == name));
    //
    // morphToBeStyled.submorphs = [...arr.withoutAll(allManaged, toBeRemoved), ...toBeAdded, ...allOthers];
  }

  managesMorph (m) {
    return this._overriddenProps.has(m); // confusing, but works
  }

  propsToSerializeForMorph (m, candidateProps) {
    if (!this.managesMorph(m)) return candidateProps;
    const excludedProps = [];
    for (const propName of this.getStyleProperties(m)) {
      if (this._overriddenProps.get(m)[propName]) continue;
      if (propName == 'position' && m == this.derivedMorph) continue;
      if (propName == 'extent' && m == this.derivedMorph) continue;
      excludedProps.push(propName);
    }
    return arr.withoutAll(candidateProps, excludedProps);
  }

  prepareMorphToBeManaged (derivedSubmorph) {
    if (!this._overriddenProps.has(derivedSubmorph)) {
      const spec = {};
      for (const prop in derivedSubmorph._parametrizedProps) {
        if (prop == '__takenFromSnapshot__') continue;
        spec[prop] = true;
      }
      this._overriddenProps.set(derivedSubmorph, spec);
    }
  }

  determineMaster (target) {
    const mode = target.env.world.colorScheme; // "dark" | "light"
    const isHovered = target.env.eventDispatcher.isMorphHovered(target); // bool
    const isClicked = target.env.eventDispatcher.isMorphClicked(target); // bool

    let master = this.getMasterForState(this, { isHovered, isClicked });

    if (this.light && mode == 'light') {
      master = this.getMasterForState(this.light, { isHovered, isClicked }) || master;
    }
    if (this.dark && mode == 'dark') {
      master = this.getMasterForState(this.light, { isHovered, isClicked }) || master;
    }

    return master;
  }

  getMasterForState ({ auto, hover, click }, { isHovered, isClicked }) {
    let master = auto;
    if (isHovered) {
      if (hover) master = hover;
      else {
        // drill down in the master chain if a different hover can be found
        let superMaster = master && master.master;
        const seen = [];
        while (superMaster) {
          if (superMaster.hover) {
            // take into account the overridden props of the masters in between
            master = superMaster.hover;
            break;
          }
          superMaster = Path('auto.master').get(superMaster);
          if (seen.includes(superMaster)) break;
          seen.push(superMaster);
        }
      }
    }
    if (isClicked) {
      master = auto; // start from beginning
      if (click) master = click;
      else {
        // drill down in the master chain if a different click can be found
        let superMaster = master && master.master;
        while (superMaster) {
          if (superMaster.click) {
            // take into account the overridden props of the masters in between
            master = superMaster.click;
            break;
          }
          superMaster = Path('auto.master').get(superMaster);
        }
      }
    }
    return master;
  }

  // invoked whenever a morph within the managed submorph hierarchy changes
  // we check if the morph is managed and update the overridden props
  onMorphChange (morph, change) {
    // if (this._applying || this._hasUnresolvedMaster || !this._appliedMaster) return;
    if (this._applying) return;
    if (Path('meta.metaInteraction').get(change)) return;
    if (['_rev', 'name'].includes(change.prop)) return;
    if (change.prop == 'opacity') delete this._originalOpacity;
    if (change.prop == 'master' && this.managesMorph(morph)) {
      this._overriddenProps.get(morph).master = true;
    }
    if (morph.styleProperties.includes(change.prop)) {
      if (this.managesMorph(morph)) {
        if (morph.master && morph.master != this) {
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

// r = resource('styleguide://style guide/')

const styleGuideURLRe = /^styleguide:\/\/([^\/]+)\/(.*)$/;

var fetchedSnapshots = fetchedSnapshots || {};
var resolvedMasters = resolvedMasters || {};

var modulesToLoad = modulesToLoad || {};

let li;
let localNamePromise;
var masterComponentFetches = masterComponentFetches || {};
var worldToUrl = worldToUrl || {};

export { resolvedMasters };

export function clearSnapshot (name) {
  delete fetchedSnapshots[name];
}

class StyleGuideResource extends Resource {
  get canDealWithJSON () { return false; }

  get componentName () {
    const match = this.url.match(styleGuideURLRe);
    const [_, worldName, name] = match;
    return name;
  }

  get worldName () {
    const match = this.url.match(styleGuideURLRe);
    let [_, worldName, name] = match;
    if (!lively.FreezerRuntime && worldName == '$world') worldName = this.localWorldName();
    return worldName;
  }

  async dirList (depth, opts) {
    // provide dir last by filtering the components inside the world via the slash based naming scheme
    if (this.worldName == getProjectName($world)) {
      return $world.withAllSubmorphsSelect(m => m.isComponent);
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

    if (resource(document.location.href).query().name == '__newWorld__') {
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
    let component = Path([this.worldName, this.componentName]).get(resolvedMasters);
    if (component) return component;

    if (lively.FreezerRuntime) {
      let rootDir = resource(System.baseURL);
      if (rootDir.isFile()) rootDir = rootDir.parent();
      const masterDir = rootDir.join('masters/');
      component = await this.fetchFromMasterDir(masterDir, name);
    }

    if (!lively.FreezerRuntime) {
      // announce we are about to fetch this snapshot;
      let resolveSnapshot;
      if (!fetchedSnapshots[this.worldName]) {
        console.log('scheduling fetch of', this.worldName);
        ({ resolve: resolveSnapshot, promise: fetchedSnapshots[this.worldName] } = promise.deferred());
      }

      if (await this.localWorldName() == this.worldName) {
        component = typeof $world !== 'undefined' && ($world.getSubmorphNamed(name) || $world.localComponents.find(c => c.name == name));
        if (!component) { throw Error(`Master component "${name}" can not be found in "${this.worldName}"`); }
        return component;
      }

      let snapshot;
      if (resolveSnapshot) {
        const db = MorphicDB.default;
        if ((await db.fetchCommit('world', this.worldName))) {
          snapshot = await db.fetchSnapshot('world', this.worldName);
          worldToUrl[this.worldName] = resource(System.baseURL).join('worlds/load').withQuery({
            name: this.worldName
          }).url;
        } else {
          // try to get the JSON (fallback)
          const jsonRes = resource(System.baseURL).join('lively.morphic/styleguides').join(this.worldName + '.json');
          if (await jsonRes.exists()) {
            snapshot = await jsonRes.readJson();
            worldToUrl[this.worldName] = resource(System.baseURL).join('worlds/load').withQuery({
              file: 'lively.morphic/styleguides/' + this.worldName + '.json'
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
      } else snapshot = await fetchedSnapshots[this.worldName];

      const pool = new ObjectPool(normalizeOptions({
        plugins: [new StyleguidePlugin(), ...allPlugins]
      }));

      const [idToDeserialize] = Object.entries(snapshot.snapshot).find(([k, v]) => {
        return Path('props.isComponent.value').get(v) && Path('props.name.value').get(v) == name;
      }) || [];

      if (!idToDeserialize) throw Error(`Master component "${name}" can not be found in "${this.worldName}"`);

      // load modules for that part of the snap, if it is required

      component = pool.resolveFromSnapshotAndId({ ...snapshot, id: idToDeserialize });
    }

    if (resolvedMasters[this.worldName]) resolvedMasters[this.worldName][name] = component;
    else resolvedMasters[this.worldName] = { [name]: component };

    component._resourceHandle = this;

    if (component._pool.mastersInSubHierarchy) {
      // fixme: apply these in hierarchical order
      for (const master of component._pool.mastersInSubHierarchy) {
        await master.applyIfNeeded(true);
        if (!master.derivedMorph.ownerChain().includes(component)) {
          master.derivedMorph.requestMasterStyling();
        }
      }
      delete component._pool;
    }

    return Promise.resolve(component);
  }

  async write (source) {
    throw Error('Master Components can not be written to!');
  }

  async exists () {
    // checks if the morph exists
    const component = typeof $world !== 'undefined' && $world.getSubmorphNamed(this.morphName);
    return component && component.isComponent;
  }

  async remove () {
    // revokes the component
    const component = typeof $world !== 'undefined' && $world.getSubmorphNamed(this.morphName);
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

class StyleGuide {
  // write to file
  // read from file

  // file can be stored in a local package / object package
  // file can be stored on a file on the server

  // can return a set of masters
  // servers as a namespace for masters

  /* namespacing of masters

    windowButtons/maximize/hover
    windowButtons/maximize/default

    windowButtons/minimize/hover
    ....

    + style ref convenience methods
    + help from the side palette master control interface

  */
}
