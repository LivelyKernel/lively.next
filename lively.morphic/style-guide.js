import { arr, properties, Path, promise, obj } from "lively.lang";
import { registerExtension, Resource, resource } from "lively.resources";
import { pt } from "lively.graphics";
import MorphicDB from "./morphicdb/db.js";
import { ObjectPool, normalizeOptions } from "lively.serializer2";
import { deserializeMorph, loadPackagesAndModulesOfSnapshot } from "./serialization.js";
import { subscribeOnce } from "lively.notifications/index.js";

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

export class ComponentPolicy {

  static for(derivedMorph, args) {
    let newPolicy;
    if (args.constructor === ComponentPolicy) newPolicy = args;
    else newPolicy = new this(derivedMorph, args);
    
    if (derivedMorph.master) {
      newPolicy._overriddenProps = derivedMorph.master._overriddenProps;
    }
    return newPolicy;
  }

  constructor(derivedMorph, args) {
    this.derivedMorph = derivedMorph;

    // this is reconstructed by traversing the submorph hierarchy based on the current master on save and keeping all refs
    // where managesMorph(m) returns true
    this._overriddenProps = new WeakMap(); // keep the list of props that are overridden by that morph and not affected by master components
    
    if (args.isMorph || typeof args == 'string') {
      this.auto = args;
      if (typeof args == 'string')
        this.auto.isComponent = true; // just to make sure. Seems a little redundant though.
      // Via direct manipulation this should never be nessecary.
      // In code this can happen, when the user forgets to set this flag.
      return;
    }

    let { click, auto, hover, light = {}, dark = {} } = args;
    if (light) this.light = light;
    if (dark) this.dark = dark;
    if (click) this.click = click;
    if (auto) this.auto = auto;
    if (hover) this.hover = hover;
    this.resolveMasterComponents();
  }

  uses(masterComponent) {
    return [this.auto, this.click, this.hover].includes(masterComponent);
  }

  spec() {
    return obj.select(this, ['auto', 'click', 'hover', 'light', 'dark']);
  }

  equals(other) {
    if (!other) return false;
    for (let master of ['auto', 'click', 'hover']) {
      if (typeof other[master] == 'string') {
        if (this.getResourceUrlFor(this[master]) != other[master] || null) return false;  
      } else if ((this[master] || null) != (other[master] || null)) return false; 
    }
    return true;
  }

  // called on serialization of Component
  getManagedMorphs() {
    let managedMorphs = [];
    this.derivedMorph.withAllSubmorphsDo(m => {
      if (this.managesMorph(m)) {
        let propKeys = Object.keys(this._overriddenProps.get(m)).filter(k => k != '_rev');
        if (propKeys.length > 0)
          managedMorphs.push([m, Object.keys(this._overriddenProps.get(m))]);
      }
    });
    return managedMorphs;
  }

  get __dont_serialize__() {
    const excludedProps = ['_overriddenProps', '_applying', '_appliedMaster', '_hasUnresolvedMaster'];
    if (obj.isEmpty(this.dark)) excludedProps.push('dark');
    if (obj.isEmpty(this.light)) excludedProps.push('light');
    return excludedProps;
  }

  __additionally_serialize__(snapshot, objRef, pool, addFn) {
    if (this.auto) addFn("auto", this.getResourceUrlFor(this.auto));
    if (this.click) addFn("click", this.getResourceUrlFor(this.click));
    if (this.hover) addFn("hover", this.getResourceUrlFor(this.hover));
  }

  __after_deserialize__(snapshot, objRef) {
    this._overriddenProps = new WeakMap();
    delete this.managedMorphs;
    this.resolveMasterComponents();
  }

  async whenApplied() {
    await this._hasUnresolvedMaster;
    await promise.waitFor(1000, () => this._appliedMaster);
    return true;
  }

  getResourceUrlFor(component) {
    if (!component) return null;
    if (component._resourceHandle) return component._resourceHandle.url; // we leave this being for remote masters :)
    if (component.name == undefined) return null;
    // else we assume the component resides within the current world
    return `styleguide://${Path('metadata.commit.name').get($world)}/${component.name}`;
  }

  async resolveMasterComponents() {
    const res = promise.deferred();
    this._hasUnresolvedMaster = res.promise;
    const { light = {}, dark = {}} = this;
    const states = ['auto', 'click', 'hover'];
    const resolvedComponents = [];
    try {
      for (let state of states) {
        if (typeof this[state] == 'string')
          this[state] = await resource(this[state]).read();
        if (typeof light[state] == 'string')
          light[state] = await resource(light[state]).read();
        if (typeof dark[state] == 'string')
          dark[state] = await resource(dark[state]).read();
        resolvedComponents.push(this[state], light[state], dark[state]);
      }
    } catch (e) {
      throw Error("Encountered invalid master component reference: " + e.message);
    }

    arr.compact(resolvedComponents).forEach(component => {
      if (!component.isComponent)
        component.isComponent = true; // just to make sure...
    });

    res.resolve();
    this._hasUnresolvedMaster = false;
  }

  /*
    This method is invoked right before a morph is about to render.
    Component styles are invoked only for rendered morphs (i.e. the ones inside the world).
  
    We check if the master component updated in the mean time and we need to trigger a style application of our submorph hierarchy. 
  */

  applyIfNeeded(needsUpdate = false) {
    if (this._hasUnresolvedMaster) {
      this._originalOpacity = this.derivedMorph.opacity;
      // fixme: this may still be too late if applyIfNeeded is triggered at render time
      // hide the component until it is applied
      this.derivedMorph.withMetaDo({ metaInteraction: true }, () => {
        if (![this.derivedMorph, ...this.derivedMorph.ownerChain()].find(m => m.isComponent))
          this.derivedMorph.opacity = 0;
      });
      // this clogs up the main thread. Instead use a callback from the master.
      return this._hasUnresolvedMaster.then(() => {
        this.applyIfNeeded(needsUpdate);
        this.derivedMorph.withMetaDo({ metaInteraction: true }, () => {
          this.derivedMorph.opacity = this._originalOpacity;
        });
        delete this._originalOpacity;
        delete this._capturedExtents;
      });
    }
    const target = this.derivedMorph;
    const master = this.determineMaster(target);
    if (master && this._appliedMaster != master) needsUpdate = true;
    if (needsUpdate) {
      this.apply(target, master);
      this._appliedMaster = master;
    }
  }

  apply(derivedMorph, master) {
    // traverse the masters submorph hierarchy
    if (this._applying) return;
    this._applying = true;
    try {
      derivedMorph.dontRecordChangesWhile(() => {
        this.prepareSubmorphsToBeManaged(derivedMorph, master);
        master.withAllSubmorphsDoExcluding(masterSubmorph => {
          const isRoot = masterSubmorph == master;
          let morphToBeStyled = isRoot ? derivedMorph : derivedMorph.getSubmorphNamed(masterSubmorph.name); // get all named?
          if (!morphToBeStyled) return; // morph to be styled is not present. can this happen? Not when working via direct manipulation tools. But can happen when you work in code purely. In those cases we resort to silent ignore.
          if (masterSubmorph.master && !isRoot) { // can not happen to the root since we ruled that out before
            // only do this when the master has changed
            morphToBeStyled.master = masterSubmorph.master.spec(); // assign to the same master
            morphToBeStyled._requestMasterStyling = true;
            // but enforce extent and position since that is not done by the master itself
            if (!this._overriddenProps.get(morphToBeStyled).position)
              morphToBeStyled.position = masterSubmorph.position;
            if (!this._overriddenProps.get(morphToBeStyled).extent)
              morphToBeStyled.extent = masterSubmorph.extent;
            return; // style application is handled by that master
          }
          
          for (let propName of masterSubmorph.styleProperties) {
            if (this._overriddenProps.get(morphToBeStyled)[propName]) continue;
            // secial handling for ... layout (copy())
            if (propName == 'layout') {
              if (morphToBeStyled.layout && masterSubmorph.layout && 
                  morphToBeStyled.layout.name() == masterSubmorph.layout.name() &&
                  morphToBeStyled.layout.equals(masterSubmorph.layout))
                continue;
              morphToBeStyled.layout = masterSubmorph.layout ? masterSubmorph.layout.copy() : undefined;
              continue;
            }
            if (masterSubmorph == master) {
              if (propName == 'extent' &&
                  !morphToBeStyled.extent.equals(pt(10,10))
                  && (
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

            if (["border", "borderTop", "borderBottom", "borderRight", "borderLeft"].includes(propName)) continue; // handled by sub props;
            
            if (!obj.equals(morphToBeStyled[propName], masterSubmorph[propName]))
              morphToBeStyled[propName] = masterSubmorph[propName];
  
            // we may be late for the game when setting these props
            // se we need to make sure, we restore the morphs "intended extent"
            // for this purpose we enfore the masterSubmorph extent
            if (['fixedHeight', 'fixedWidth'].includes(propName) &&
                morphToBeStyled._parametrizedProps &&
                morphToBeStyled._parametrizedProps.extent) {
              morphToBeStyled.extent = morphToBeStyled._parametrizedProps.extent
            }
          }
          if (morphToBeStyled._parametrizedProps)
            delete morphToBeStyled._parametrizedProps;
          this.reconcileSubmorphs(morphToBeStyled, masterSubmorph);
        }, masterSubmorph => master != masterSubmorph && masterSubmorph.master);
      });
    } finally {
      this._applying = false;
      delete derivedMorph._parametrizedProps; // needs to be done for all managed submorphs
    }
  }

  clearOverriddenPropertiesFor(derivedMorph, propsToClear) {
    const spec = this._overriddenProps.get(derivedMorph); 
    this._overriddenProps.set(derivedMorph, obj.dissoc(spec, propsToClear));
  }

  prepareSubmorphsToBeManaged(derivedMorph, master) {
    // assign these based on the current master
    master.withAllSubmorphsDoExcluding(masterSubmorph => {
      let morphToBeStyled = masterSubmorph == master ? derivedMorph : derivedMorph.getSubmorphNamed(masterSubmorph.name);
      if (!morphToBeStyled) return;
      this.prepareMorphToBeManaged(morphToBeStyled);
    }, masterSubmorph => masterSubmorph != master && masterSubmorph.master);
  }

  /* 
    now we have applied everything except for submorphs.
    do we want these to be applied too? That would be useful if we alter the structure of a master component
    later in the game and want that to be reflected in all its derived morphs.
    By what policy are we going to reconcile this change? Via the submorphs names: 
  */
  reconcileSubmorphs(morphToBeStyled, masterSubmorph) {
    return; // only do stuff here if configured to do so
    let [allManaged, allOthers] = arr.partition(morphToBeStyled.submorphs, m => this.managesMorph(m));
    let toBeAdded = masterSubmorph.submorphs
                                  .filter(({ name }) => ![...allManaged, ...allOthers].find(m => m.name == name))
                                  .map(m => m.copy());
    toBeAdded.forEach(m => this.prepareMorphToBeManaged(m))
    let toBeRemoved = allManaged.filter(({ name }) => !masterSubmorph.submorphs.find(m => m.name == name))
    
    morphToBeStyled.submorphs  = [...arr.withoutAll(allManaged, toBeRemoved), ...toBeAdded, ...allOthers];
  }

  managesMorph(m) {
    return this._overriddenProps.has(m); // confusing, but works
  }

  propsToSerializeForMorph(m, candidateProps) {
    if (!this.managesMorph(m)) return candidateProps;
    let excludedProps = [];
    for (let propName of m.styleProperties) {
      if (this._overriddenProps.get(m)[propName]) continue;
      if (propName == "position" && m == this.derivedMorph) continue;
      if (propName == "extent" && m == this.derivedMorph) continue;
      excludedProps.push(propName);
    }
    return arr.withoutAll(candidateProps, excludedProps);
  }

  prepareMorphToBeManaged(derivedSubmorph) {
    if (!this._overriddenProps.has(derivedSubmorph)) {
      const spec = {};
      for (let prop in derivedSubmorph._parametrizedProps) {
        if (prop == '__takenFromSnapshot__') continue;
        spec[prop] = true;
      }
      this._overriddenProps.set(derivedSubmorph, spec);
    }
  }

  determineMaster(target) {

    const mode = target.env.world.colorScheme; // "dark" | "light"
    const isHovered = target.env.eventDispatcher.isMorphHovered(target); // bool
    const isClicked = target.env.eventDispatcher.isMorphClicked(target); // bool
    
    let master = this.getMasterForState(this, { isHovered, isClicked });
    
    if (this.light && mode == "light") {
      master = this.getMasterForState(this.light, { isHovered, isClicked }) || master;
    }
    if (this.dark && mode == "dark") {
      master = this.getMasterForState(this.light, { isHovered, isClicked }) || master;
    }

    return master;
  }

  getMasterForState({ auto, hover, click }, { isHovered, isClicked }) {
    let master = auto;
    if (isHovered) {
      if (hover) master = hover;
      else {
        // drill down in the master chain if a different hover can be found
        let superMaster = master && master.master;
        while (superMaster) {
          if (superMaster.hover) {
            master = superMaster.hover;
            break;
          }
          superMaster = superMaster.auto;
        }
      }
    }
    if (isClicked) {
      if (click) master = click;
      else {
        // drill down in the master chain if a different click can be found
        let superMaster = master && master.master;
        while (superMaster) {
          if (superMaster.click) {
            master = superMaster.click;
            break;
          }
          superMaster = superMaster.auto;
        }
      }  
    }
    return master;
  }

  // invoked whenever a morph within the managed submorph hierarchy changes
  // we check if the morph is managed and update the overridden props
  onMorphChange(morph, change) {
    //if (this._applying || this._hasUnresolvedMaster || !this._appliedMaster) return;
    if (this._applying) return;
    if (Path('meta.metaInteraction').get(change)) return;
    if (['_rev', 'name', 'master'].includes(change.prop)) return;
    if (change.prop == 'opacity') delete this._originalOpacity;
    if (morph.styleProperties.includes(change.prop)) {
      if (this.managesMorph(morph)) {
        if (morph.master && morph.master != this) {
          if (!['extent', 'position'].includes(change.prop)) return;
        }
        this._overriddenProps.get(morph)[change.prop] = true;
        return;
      }

      if (morph._parametrizedProps) morph._parametrizedProps[change.prop] = change.value;
      else morph._parametrizedProps = {[change.prop]: change.value};
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
var objectPools = objectPools || {};
var resolvedMasters = resolvedMasters || {};

var modulesToLoad = modulesToLoad || {};

var li;
var localNamePromise;
var masterComponentFetches = masterComponentFetches || {};

class StyleGuideResource extends Resource {

  get canDealWithJSON() { return false; }

  get componentName() {
    const match = this.url.match(styleGuideURLRe);
    var [_, worldName, name] = match;
    return name;
  }

  get worldName() {
    const match = this.url.match(styleGuideURLRe);
    var [_, worldName, name] = match;
    return worldName;
  }

  async dirList(depth, opts) {
    // provide dir last by filtering the components inside the world via the slash based naming scheme
    if (this.worldName == $world.metadata.commit.name) {
      return $world.withAllSubmorphsSelect(m => m.isComponent)
    }

    let remoteMasters = resolvedMasters[this.worldName];
    if (remoteMasters) return Object.values(remoteMasters);
    
    return [];
  }

  localWorldName() {
    let localName;
    
    if (localName = Path('metadata.commit.name').get($world)) {
      return localName;
    }
    
    if (localNamePromise)
      return localNamePromise;

    let resolve;
    ({ resolve, promise: localNamePromise } = promise.deferred());

    if (resource(document.location.href).query().name == '__newWorld__') {
      resolve('__newWorld__');
      return localNamePromise;
    }
    
    subscribeOnce('world/loaded', () => {
      resolve(Path('metadata.commit.name').get($world));
    }, System);

    return localNamePromise;
  }

  fetchFromMasterDir(masterDir, name) {
    const res = masterDir.join(this.worldName).join(name + '.json');
    if (masterComponentFetches[res.url]) return masterComponentFetches[res.url];
    masterComponentFetches[res.url] = (async () => deserializeMorph(await res.readJson()))();
    return masterComponentFetches[res.url];
  }

  async read() {
    let name = this.componentName;
    let component = Path([this.worldName, this.componentName]).get(resolvedMasters);
    if (component) return component;

    if (lively.FreezerRuntime) {
      let rootDir = resource(window.location);
      if (rootDir.isFile()) rootDir = rootDir.parent();
      const masterDir = rootDir.join('masters/');
      component = await this.fetchFromMasterDir(masterDir, name)
    }

    if (!lively.FreezerRuntime) {
      // announce we are about to fetch this snapshot;
      let resolveSnapshot;
      if (!fetchedSnapshots[this.worldName]) {
        console.log('scheduling fetch of', this.worldName);
        ({ resolve: resolveSnapshot, promise: fetchedSnapshots[this.worldName] } = promise.deferred());
      }
      
      if (await this.localWorldName() == this.worldName) {
        component = typeof $world !== "undefined" && $world.getSubmorphNamed(name);
        if (!component)
          throw Error(`Master component "${name}" can not be found in "${this.worldName}"`);
        return component;
      }

      let snapshot;
      if (resolveSnapshot) {
        let db = MorphicDB.default;
        if ((await db.exists('world', this.worldName)).exists)
          snapshot = await db.fetchSnapshot("world", this.worldName);
        else {
          // try to get the JSON (fallback)
          let jsonRes = resource(System.baseURL).join('lively.morphic/styleguides').join(this.worldName + '.json');
          if (await jsonRes.exists()) snapshot = await jsonRes.readJson();
          else resolveSnapshot(null); // total fail
        }
        await loadPackagesAndModulesOfSnapshot(snapshot);
        resolveSnapshot(snapshot);
      } else snapshot = await fetchedSnapshots[this.worldName];
      
      let pool = new ObjectPool(normalizeOptions({}));
  
      let [idToDeserialize] = Object.entries(snapshot.snapshot).find(([k, v]) => {
        return Path('props.isComponent.value').get(v) && Path('props.name.value').get(v) == name
      }) || [];
  
      if (!idToDeserialize) throw Error(`Master component "${name}" can not be found in "${this.worldName}"`);
  
      component = pool.resolveFromSnapshotAndId({...snapshot, id: idToDeserialize });
      
    }

    if (resolvedMasters[this.worldName]) resolvedMasters[this.worldName][name] = component;
    else resolvedMasters[this.worldName] = { [name]: component };
    
    component._resourceHandle = this;

    await Promise.all(component
      .withAllSubmorphsSelect(m => m.master)
      .map(m => m.master.applyIfNeeded(true)))
    
    return Promise.resolve(component);
  }

  async write(source) {
    throw Error('Master Components can not be written to!');
  }

  async exists() {
    // checks if the morph exists
    const component = typeof $world !== "undefined" && $world.getSubmorphNamed(this.morphName);
    return component && component.isComponent;
  }

  async remove() {
    // revokes the component
    const component = typeof $world !== "undefined" && $world.getSubmorphNamed(this.morphName);
    if (component) component.isComponent = false;
    return true;
  }
  
}

export const resourceExtension = {
  name: "styleguide",
  matches: (url) => url.match(styleGuideURLRe),
  resourceClass: StyleGuideResource
}

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