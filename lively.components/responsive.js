import { Morph, Icon } from 'lively.morphic';
import { obj, arr } from 'lively.lang/index.js';

export default class ResponsiveLayoutMorph extends Morph {
  static get properties () {
    return {
      verticalBreakPoints: {
        initialize () {
          this.verticalBreakPoints = [this.height / 2];
        }
      },
      horizontalBreakPoints: {
        initialize () {
          this.horizontalBreakPoints = [this.width / 2];
        }
      },
      watchedProperties: {
        after: ['breakPointPropertyMapping'],
        set (propertyNames) {
          this.setProperty('watchedProperties', propertyNames);
          this.capturePropertiesForBreakPoint(this.getCurrentBreakPoints());
        }
      },
      configurationHalo: {},
      breakPointPropertyMapping: {
        after: ['submorphs'],
        set (mappingSpec) {
          let map = new WeakMap();
          map.__serialize__ = (pool, serializedObjMap, path) =>
            this.breakPointPropertyMappingAsSpec(pool, serializedObjMap, path);
          this.setProperty('breakPointPropertyMapping', map);
          // convert the spec to a weak map based mapping
          for (let [m, spec] of mappingSpec) {
            map.set(m, spec);
          }
        }
      },
      debug: {
        // toggle the halo that allows to modify breakpoints and the set of watched properties
        after: ['configurationHalo'],
        type: 'Boolean',
        set (active) {
          this.setProperty('debug', active);
          this.toggleHalo(active);
        }
      }
    };
  }

  onOwnerChanged (newOwner) {
    if (newOwner && !newOwner.isHand) this.toggleHalo(this.debug);
  }

  remove () {
    super.remove();
    this.configurationHalo.remove();
  }

  menuItems () {
    let checked = Icon.textAttribute('check-square-o');
    let unchecked = Icon.textAttribute('square-o');
    Object.assign(unchecked[1], { paddingRight: '5px', float: 'none', display: 'inline' });
    Object.assign(checked[1], { paddingRight: '5px', float: 'none', display: 'inline' });

    return [
      [
        [...this.debug ? checked : unchecked, 'Responsive Controls ', { float: 'none' }],
        () => {
          this.debug = !this.debug;
        }
      ],
      { isDivider: true },
      ...super.menuItems()];
  }

  // this.copy()

  breakPointPropertyMappingAsSpec (pool, serializedObjMap, path) {
    let spec = [];
    this.withAllSubmorphsDo(m => {
      spec.push(m);
      spec.push(this.breakPointPropertyMapping.get(m) || [[{}, {}], [{}, {}]]);
    });
    return pool.ref(this).snapshotProperty(this.id, arr.toTuples(spec, 2), path, serializedObjMap, pool);
  }

  onChange (change) {
    super.onChange(change);
    if (change.prop === 'extent') {
      this.update();
    }
    if (change.prop === 'position') {
      this.configurationHalo.relayout();
    }
  }

  update () {
    let [h, v] = this.getCurrentBreakPoints();
    if (!this.lastBreakPoints) this.lastBreakPoints = [h, v];
    let [oldH, oldV] = this.lastBreakPoints;
    if (oldH != h || oldV != v) {
      this.capturePropertiesForBreakPoint(this.lastBreakPoints);
      this.updateSubmorphHierarchy([h, v]);
      this.lastBreakPoints = [h, v];
    }
    this.configurationHalo.relayout();
  }

  updateSubmorphHierarchy (breakPoint) {
    this.withAllSubmorphsDo(m => {
      let breakPointsToProps = this.breakPointPropertyMapping.get(m);
      Object.assign(m, breakPointsToProps[breakPoint]);
    });
  }

  getCurrentBreakPoints () {
    let h = arr.findIndex([...this.horizontalBreakPoints, this.width], (b) => this.width <= b);
    let v = arr.findIndex([...this.verticalBreakPoints, this.height], (b) => this.height <= b);
    return [h, v];
  }

  capturePropertiesForBreakPoint (breakPoint) {
    this.withAllSubmorphsDo(m => {
      let breakPointsToProps = this.breakPointPropertyMapping.get(m) || {};
      // fixme: maybe we need to be more careful when capturing properties? what about layouts?
      breakPointsToProps[breakPoint] = obj.select(m, this.watchedProperties);
      this.breakPointPropertyMapping.set(m, breakPointsToProps);
    });
  }

  toggleHalo (active) {
    let halo = this.configurationHalo;
    if (active) {
      halo.openInWorld();
      halo.relayout();
    } else {
      halo.remove();
    }
  }
}
