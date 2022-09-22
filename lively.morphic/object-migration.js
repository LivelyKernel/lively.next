import { removeUnreachableObjects } from 'lively.serializer2';
import { obj, Path } from 'lively.lang';
import { connect, disconnectAll } from 'lively.bindings';

export function isReference (value) { return value && value.__ref__; }

export const migrations = [

  {
    date: '2017-04-08',
    name: 'Text and Label textAndAttributes format change',
    description: `
Changing the format from
  [[string1, attr1_1, attr1_2], [string2, attr2_1, attr2_2], ...]
to
  [string1, attr1, string2, attr2, ...].
    `,
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      for (const key in snapshot) {
        const serialized = snapshot[key];
        const textAndAttributes = serialized.props && serialized.props.textAndAttributes;
        if (!textAndAttributes) continue;
        let { value } = textAndAttributes;
        if (!Array.isArray(value)) {
          console.warn('object migrator found textAndAttributes field but it is not an Array!');
          continue;
        }
        if (!value.length || typeof value[0] === 'string') continue; // OK
        // flatten values
        value = [].concat.apply([], value);
        for (let i = 0; i < value.length; i += 2) {
          const attr = value[i + 1];
          if (attr && Array.isArray(attr)) { // merge multi-attributes
            value[i + 1] = Object.assign({}, ...attr);
          }
        }
        serialized.props.textAndAttributes = { ...textAndAttributes, value };
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2017-04-29',
    name: 'Window button fix',
    description: `
A recent change in the structure of windows, that now adds a "button wrapper"
morph breaks old windows without it.
`,
    objectConverter: (idAndSnapshot, pool) => {
      const { id } = idAndSnapshot;
      const rootMorph = pool.refForId(id).realObj;
      if (rootMorph && rootMorph.isMorph) {
        rootMorph.withAllSubmorphsDo(win => {
          if (!win.isWindow) return;

          if (!win.submorphs.some(m => m.name === 'button wrapper') ||
           !win.get('button wrapper').submorphs.some(m => m.name === 'window menu button')) {
            // win.fixControls();
          }
          win.minimizedBounds = null;
          disconnectAll(win.get('minimize'));
          connect(win.get('minimize'), 'onMouseDown', win, 'minimized', {
            updater: function ($upd) {
              $upd(!this.targetObj.minimized);
            }
          });
        });
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2017-05-03',
    name: 'Style Sheet Status Fix',
    description: `
State management of the style sheets has changes substantially, moving all of the style sheets that are being applied to the world.
`,
    snapshotConverter: idAndSnapshot => {
      const { id: rootId, snapshot } = idAndSnapshot;
      for (const id in snapshot) {
        const { props } = snapshot[id];
        if (!props || !props.styleSheets) continue;
        if (!props.styleSheets.value) props.styleSheets.value = [];
        props.styleSheets.value = props.styleSheets.value && props.styleSheets.value.filter(ea => {
          const styleSheet = snapshot[ea.id];
          const rules = styleSheet.props.rules;
          const rulesObj = snapshot[rules.value.id];
          return !styleSheet.props.styledMorphs && !('lively.serializer-class-info' in rulesObj);
        });
      }
      removeUnreachableObjects([rootId], snapshot);
      return idAndSnapshot;
    }
  },

  {
    date: '2017-05-22',
    name: 'Removal of ChromeTheme and GithubTheme',
    description: `
For now only a simple default theme...
`,
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      for (const key in snapshot) {
        const serialized = snapshot[key];
        const klass = serialized['lively.serializer-class-info'];
        if (!klass) continue;
        if (klass.className === 'ChromeTheme' || klass.className === 'GithubTheme') {
          klass.className = 'DefaultTheme';
          klass.module.pathInPackage = 'ide/themes/default.js';
        } else if (klass.className === 'JavaScriptTokenizer') {
          delete serialized['lively.serializer-class-info'];
        }
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2017-06-20',
    name: 'Unwrapped Style Sheet Props',
    description: 'Style Sheets now store foldable props in their nested format.',
    objectConverter: (idAndSnapshot, pool) => {
      const { id } = idAndSnapshot;
      const rootMorph = pool.refForId(id).realObj;
      if (rootMorph && rootMorph.isMorph) {
        rootMorph.withAllSubmorphsDo(m => {
          if (m.styleSheets && m.styleSheets.length > 0) {
            m.styleSheets.forEach(ss => {
              for (const rule in obj.dissoc(ss.rules, ['_rev'])) { ss.rules[rule] = ss.unwrapFoldedProps(ss.rules[rule]); }
            });
          }
        });
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2017-07-13',
    name: 'Renamed style-rules.js to style-sheets.js',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      for (const key in snapshot) {
        const serialized = snapshot[key]; const klass = serialized['lively.serializer-class-info'];
        if (!klass) continue;
        if (klass.className === 'StyleSheet') {
          klass.module.pathInPackage = 'style-sheets.js';
        }
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2017-07-26',
    name: 'components, ide, and halo extraction',
    snapshotConverter: idAndSnapshot => {
      const { snapshot, packages } = idAndSnapshot;
      const modules = (packages && packages['local://lively-object-modules/']) || {};
      const nameToPackages = [
        ['lively.morphic/halo', 'lively.halos'],
        ['lively.morphic/components/markers.js', 'lively.halos'],
        ['lively.morphic/components/icons.js', 'lively.morphic'],
        ['lively.morphic/components/loading-indicator.js', 'lively.components', imports => `{${imports}}`],
        // ['lively.morphic/components', 'lively.components'],
        ['lively.components/markers.js', 'lively.halos'],
        ['lively.morphic/ide', 'lively.ide'],
        ['lively.morphic/text/ui.js', 'lively.ide', null, 'text/ui.js']
      ];
      for (const mod in modules) {
        let moduleSource = modules[mod]['index.js'];
        for (const [prefix, replacement, importTfm] of nameToPackages) {
          if (importTfm) {
            const importMatcher = new RegExp('(import\\s)(.*)(\\sfrom \\"' + prefix + ')', 'g');
            const match = importMatcher.exec(moduleSource);
            if (match) {
              moduleSource = moduleSource.replace(
                importMatcher,
                'import ' + importTfm(match[2]) + 'from \"' + replacement
              );
            }
          } else {
            const re = new RegExp(prefix, 'g');
            moduleSource = moduleSource.replace(re, replacement);
          }
        }
        modules[mod]['index.js'] = moduleSource;
      }
      for (const key in snapshot) {
        const serialized = snapshot[key]; const klass = serialized['lively.serializer-class-info'];
        if (!klass || !klass.module) continue;
        const p = klass.module.package.name + '/' + klass.module.pathInPackage;
        for (const [prefix, replacement, pathInPackage] of nameToPackages) {
          if (p.includes(prefix)) {
            klass.module.package.name = replacement;
            klass.module.package.version = '0.1.0';
            klass.module.pathInPackage = pathInPackage || p.substring(p.indexOf(prefix) + prefix.length + 1) || 'index.js';
            break;
          }
        }
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2017-10-16',
    name: 'change scroll implementation of list items',
    objectConverter: (idAndSnapshot, pool) => {
      for (const ref of pool.objectRefs()) {
        const { realObj } = ref;
        if (!realObj.isList || typeof realObj.initializeSubmorphs !== 'function') { continue; }
        realObj.initializeSubmorphs();
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2017-10-30',
    name: 'change implementation of tree',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      // remove the nodeItemContainer from the tree submorphs, such that
      // they do not get initialized at all.
      // reconstruction of the tree rendering should happen automatically
      for (const key in snapshot) {
        const serialized = snapshot[key]; const klass = serialized['lively.serializer-class-info'];
        if (!klass || !klass.module) continue;
        if (klass.className === 'Tree' && serialized.props.submorphs) { serialized.props.submorphs.value = []; }
        if (klass.className === 'TreeNode') delete snapshot[key];
        if (klass.className === 'InspectorTreeData') {
          delete snapshot[key];
        }
        if (['PropertyNode', 'InspectionNode', 'MorphNode', 'FoldedNode'].includes(klass.className)) {
          klass.module.pathInPackage = 'js/inspector/context.js';
        }
        if (serialized.props.name === 'nodeItemContainer') delete snapshot[key];
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2019-02-17',
    name: 'change storage of commit metadata',
    snapshotConverter: idAndSnapshot => {
      const { id: rootId, snapshot } = idAndSnapshot;
      Object.values(snapshot).map(m => {
        if (m.props && m.props.metadata && isReference(m.props.metadata.value)) {
          const metaObj = snapshot[m.props.metadata.value.id];
          if (metaObj.props.commit && isReference(metaObj.props.commit.value)) {
            const { type, name, _id } = snapshot[metaObj.props.commit.value.id].props;
            if (type && name && _id) { metaObj.props.commit.value = `__lv_expr__:({type: "${type.value}", name: "${name.value}", _id: "${_id.value}"})`; }
          }
        }
      });
      removeUnreachableObjects([rootId], snapshot);
      return idAndSnapshot;
    }
  },

  {
    date: '2019-07-25',
    name: 'world superclass extraction',
    snapshotConverter: idAndSnapshot => {
      const { packages } = idAndSnapshot;
      let indexjs;
      const pathToIndex = Path(['local://lively-object-modules/', 'EmptyWorld', 'index.js']);
      if (indexjs = pathToIndex.get(packages)) {
        indexjs = indexjs.replace('import { World, morph } from "lively.morphic";', 'import { morph } from "lively.morphic";\nimport { LivelyWorld as World } from "lively.ide/world.js"').replace('import { World } from "lively.morphic";', 'import { LivelyWorld as World } from "lively.ide/world.js"');
        pathToIndex.set(packages, indexjs);
      }
      return idAndSnapshot;
    }
  },

  {
    date: '2019-08-05',
    name: 'remove Camphor from system',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      Object.values(snapshot).map(m => {
        if (m.props.fontFamily && m.props.fontFamily.value === 'Camphor') {
          m.props.fontFamily.value = 'Nunito';
        }
      });
      return idAndSnapshot;
    }
  },

  {
    date: '2020-10-09',
    name: 'remove style guide',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      Object.values(snapshot).map(m => {
        if (m.props.master && typeof m.props.master.value === 'string') {
          m.props.master.value = m.props.master.value.split('styleguide://style guide').join('styleguide://System');
        }
        if (m.props.master?.value?.id) {
          const entry = snapshot[m.props.master.value.id];
          if (!entry.props.auto || typeof entry.props.auto.value !== 'string') return;
          entry.props.auto.value = entry.props.auto.value.split('styleguide://style guide').join('styleguide://System');
        }
      });
      return idAndSnapshot;
    }
  },

  {
    date: '2022-01-10',
    name: 'change semantic of borderRadius property to allow definiton on per-corner basis',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      Object.values(snapshot).map(m => {
        // do not migrate if borderRadius is already migrated
        if (m.props.borderRadius && typeof m.props.borderRadius.value === 'object' && !m.props.borderRadius.value.hasOwnProperty('topLeft')) {
          const borderRadius = m.props.borderRadius.value;
          let newRadius;
          if (borderRadius.left === borderRadius.right === borderRadius.bottom === borderRadius.top) newRadius = borderRadius.left;
          else newRadius = Math.max(borderRadius.left, borderRadius.right, borderRadius.bottom, borderRadius.top);
          m.props.borderRadius.value = {
            topLeft: newRadius,
            topRight: newRadius,
            bottomRight: newRadius,
            bottomLeft: newRadius
          };
        }
      });
      return idAndSnapshot;
    }
  },

  {
    date: '2022-01-14',
    name: 'migrate comments browser to new components architecture and rebuild rather than save the instances',
    snapshotConverter: idAndSnapshot => {
      const { id: rootId, snapshot } = idAndSnapshot;
      const referencesToRemove = [];
      const connections = [];
      Object.keys(snapshot).map(k => {
        const currentObj = snapshot[k];
        if (currentObj.props.commentBrowser) delete snapshot[k].props.commentBrowser;
        if (currentObj['lively.serializer-class-info']) {
          if (currentObj['lively.serializer-class-info'].className === 'CommentBrowser') referencesToRemove.push(k);
          if (currentObj['lively.serializer-class-info'].className === 'AttributeConnection') connections.push(k);
        }
      });
      connections.forEach((c) => {
        if (snapshot[c].props.targetObj.value.id in referencesToRemove) delete snapshot[c];
      });
      referencesToRemove.forEach(k => delete snapshot[k]);

      removeUnreachableObjects([rootId], snapshot);

      return idAndSnapshot;
    }
  },
  {
    date: '2022-01-11',
    name: 'remove prompts.js',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      for (const key in snapshot) {
        const serialized = snapshot[key];
        const klass = serialized['lively.serializer-class-info'];
        if (klass?.module?.pathInPackage.endsWith('prompts.js')) {
          delete serialized['lively.serializer-class-info'];
        }
      }
      return idAndSnapshot;
    }
  },
  {
    date: '2022-01-18',
    name: 'remove old Browser',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      for (const key in snapshot) {
        const serialized = snapshot[key];
        const klass = serialized['lively.serializer-class-info'];
        if (klass?.module?.pathInPackage.endsWith('browser/index.js') && klass.name === 'Browser') {
          delete snapshot[key];
        }
      }
      return idAndSnapshot;
    }
  },
  {
    date: '2022-09-05',
    name: 'remove Nunito from system',
    snapshotConverter: idAndSnapshot => {
      const { snapshot } = idAndSnapshot;
      Object.values(snapshot).map(m => {
        if (m.props.fontFamily && m.props.fontFamily.value === 'Nunito') {
          m.props.fontFamily.value = 'IBM Plex Mono';
        }
      });
      return idAndSnapshot;
    }
  },
];
