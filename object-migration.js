import { Color, rect, pt } from "lively.graphics";
import { morph, Icon } from "lively.morphic";
import { removeUnreachableObjects } from "lively.serializer2/snapshot-navigation.js";
import { obj } from "lively.lang";
import { connect } from "lively.bindings";

export var migrations = [

  {
    date: "2017-04-08",
    name: "Text and Label textAndAttributes format change",
    description: `
Changing the format from
  [[string1, attr1_1, attr1_2], [string2, attr2_1, attr2_2], ...]
to
  [string1, attr1, string2, attr2, ...].
    `,
    snapshotConverter: idAndSnapshot => {
      let {snapshot} = idAndSnapshot;
      for (let key in snapshot) {
        let serialized = snapshot[key],
            textAndAttributes = serialized.props && serialized.props.textAndAttributes;
        if (!textAndAttributes) continue;
        let {value} = textAndAttributes;
        if (!Array.isArray(value)) {
          console.warn(`object migrator found textAndAttributes field but it is not an Array!`);
          continue;
        }
        if (!value.length || typeof value[0] === "string") continue; // OK
        // flatten values
        value = [].concat.apply([], value);
        for (let i = 0; i < value.length; i += 2) {
          let text = value[i], attr = value[i+1];
          if (attr && Array.isArray(attr)) // merge multi-attributes
            value[i+1] = Object.assign({}, ...attr);
        }
        serialized.props.textAndAttributes = {...textAndAttributes, value};
      }
      return idAndSnapshot;
    }
  },


  {
    date: "2017-04-29",
    name: "Window button fix",
    description: `
A recent change in the structure of windows, that now adds a "button wrapper"
morph breaks old windows without it.
`,
    objectConverter: (idAndSnapshot, pool) => {
      let {snapshot, id} = idAndSnapshot,
          rootMorph = pool.refForId(id).realObj;
      if (rootMorph && rootMorph.isMorph)
        rootMorph.withAllSubmorphsDo(win => {
          if (!win.isWindow) return;

          if (!win.submorphs.some(m => m.name === "button wrapper")
           || !win.get("button wrapper").submorphs.some(m => m.name === "window menu button")) {
            win.fixControls();
          }

        });
      return idAndSnapshot;
    }
  },

  {
    date: "2017-05-03",
    name: "Style Sheet Status Fix",
    description: `
State management of the style sheets has changes substantially, moving all of the style sheets that are being applied to the world.
`,
    snapshotConverter: idAndSnapshot => {
      let {id: rootId, snapshot} = idAndSnapshot;
      for (let id in snapshot) {
        let { props } = snapshot[id];
        if (!props || !props.styleSheets) continue;
        if (!props.styleSheets.value) props.styleSheets.value = [];
        props.styleSheets.value = props.styleSheets.value && props.styleSheets.value.filter(ea => {
          let styleSheet = snapshot[ea.id],
              rules = styleSheet.props.rules,
              rulesObj = snapshot[rules.value.id];
          return !styleSheet.props.styledMorphs && !('lively.serializer-class-info' in rulesObj);
        });
      }
      removeUnreachableObjects([rootId], snapshot);
      return idAndSnapshot;
    }
  },

  {
    date: "2017-05-22",
    name: "Removal of ChromeTheme and GithubTheme",
    description: `
For now only a simple default theme...
`,
    snapshotConverter: idAndSnapshot => {
      let {snapshot} = idAndSnapshot;
      for (let key in snapshot) {
        let serialized = snapshot[key],
            klass = serialized["lively.serializer-class-info"];
        if (!klass) continue;
        if (klass.className === "ChromeTheme" || klass.className === "GithubTheme") {
          klass.className = "DefaultTheme";
          klass.module.pathInPackage = "ide/themes/default.js";
        } else if (klass.className === "JavaScriptTokenizer") {
          delete serialized["lively.serializer-class-info"]
        }
      }
      return idAndSnapshot;
    }
  },

  {
    date: "2017-06-20",
    name: "Unwrapped Style Sheet Props",
    description: `Style Sheets now store foldable props in their nested format.`,
    objectConverter: (idAndSnapshot, pool) => {
      let {id, snapshot} = idAndSnapshot;
      let rootMorph = pool.refForId(id).realObj;
      if (rootMorph && rootMorph.isMorph)
        rootMorph.withAllSubmorphsDo(m => {
          if (m.styleSheets && m.styleSheets.length > 0) {
            m.styleSheets.forEach(ss => {
              for (let rule in obj.dissoc(ss.rules, ['_rev']))
                ss.rules[rule] = ss.unwrapFoldedProps(ss.rules[rule]);
            })
          }
        });
      return idAndSnapshot;
    }
  },

  {
    date: "2017-07-13",
    name: "Renamed style-rules.js to style-sheets.js",
    snapshotConverter: idAndSnapshot => {
      let {snapshot} = idAndSnapshot;
      for (let key in snapshot) {
        let serialized = snapshot[key], klass = serialized["lively.serializer-class-info"];
        if (!klass) continue;
        if (klass.className === "StyleSheet") {
          klass.module.pathInPackage = "style-sheets.js";
        }
      }
      return idAndSnapshot;
    }
  },

  {
    date: "2017-07-26",
    name: "components, ide, and halo extraction",
    snapshotConverter: idAndSnapshot => {
      let {snapshot, packages} = idAndSnapshot,
          modules = (packages && packages["local://lively-object-modules/"]) || {},
          nameToPackages = [
            ['lively.morphic/halo', 'lively.halos'],
            ['lively.morphic/components/markers.js', 'lively.halos'],
            ['lively.morphic/components/icons.js', 'lively.morphic'],
            ['lively.morphic/components/loading-indicator.js', 'lively.components', imports => `\{${imports}\}`],
            //['lively.morphic/text/input-line.js', 'lively.components', imports => `\{${imports}\}`],
            ['lively.morphic/components', 'lively.components'],
            ['lively.components/markers.js', 'lively.halos']
            // ['lively.morphic/ide', 'lively.ide'],
          ];
      for (let mod in modules) {
        var moduleSource = modules[mod]["index.js"];
        for (let [prefix, replacement, importTfm] of nameToPackages) {
          if (importTfm) {
             let importMatcher = new RegExp( '(import\\s)(.*)(\\sfrom \\"' + prefix + ")", 'g'),
                 match = importMatcher.exec(moduleSource);
             if (match) {
               moduleSource = moduleSource.replace(
                  importMatcher,
                 'import ' + importTfm(match[2]) + 'from \"' + replacement
               );
             }
          } else {
             let re = new RegExp(prefix, 'g');
             moduleSource = moduleSource.replace(re, replacement);
          }
        }
        modules[mod]["index.js"] = moduleSource;
      }
      for (let key in snapshot) {
        let serialized = snapshot[key], klass = serialized["lively.serializer-class-info"];
        if (!klass || !klass.module) continue;
        let p = klass.module.package.name + "/" + klass.module.pathInPackage;
        for (let [prefix, replacement] of nameToPackages) {
          if (p.includes(prefix)) {
            klass.module.package.name = replacement;
            klass.module.package.version = '0.1.0';
            klass.module.pathInPackage = p.substring(p.indexOf(prefix) + prefix.length + 1) || "index.js";
            break;
          }
        }
      }
      return idAndSnapshot;
    }
  }

];
