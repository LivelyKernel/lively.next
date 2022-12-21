import { LightPrompt, AbstractPromptModel, RedButton, GreenButton } from 'lively.components/prompts.cp.js';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { DropDownList, DefaultList } from 'lively.components/list.cp.js';
import { pt, Color, rect } from 'lively.graphics';
import { TilingLayout, easings, ShadowObject, Icon, ConstraintLayout, Label, Text, component, add, part } from 'lively.morphic';
import { PackageRegistry } from 'lively.modules/index.js';
import EditorPlugin from 'lively.ide/editor-plugin.js';
import { resource } from 'lively.resources';
import { fun } from 'lively.lang/index.js';
import { SystemList } from 'lively.ide/styling/shared.cp.js';
import { DarkButton } from 'lively.components/buttons.cp.js';

class PackageTextCompleter {
  isValidPrefix (prefix) {
    return !!prefix;
  }

  async compute (inputMorph, prefix) {
    let pkgs = PackageRegistry.ofSystem(System).allPackages();

    return pkgs.map(pkg => {
      let { name, version } = pkg;
      return {
        info: `@${version}`,
        completion: name,
        customInsertionFn: (complString, prefix, inputMorph, { start, end }) => {
          inputMorph.replace(inputMorph.lineRange(), name);
        }
      };
    });
  }
}

class DirectoryTextCompleter {
  isValidPrefix (prefix) {
    return !!prefix;
  }

  async compute (inputMorph, prefix) {
    let input = inputMorph.input;
    input = prefix ? input.slice(0, -prefix.length) : input;
    let res = resource(System.baseURL + input);
    let files = [];

    if (await res.exists()) {
      files = await res.dirList();
    }

    return files.map(file => {
      let { url } = file;
      return {
        // info: `@${version}`,
        completion: url.replace(res.url, ''),
        customInsertionFn: (complString, prefix, inputMorph, { start, end }) => {
          inputMorph.replace(inputMorph.lineRange(), url.replace(System.baseURL, '/'));
        }
      };
    });
  }
}

class DirectoryInputPlugin extends EditorPlugin {
  getCompleters () {
    return [new DirectoryTextCompleter()];
  }
}

class PackageInputPlugin extends EditorPlugin {
  getCompleters () {
    return [new PackageTextCompleter()];
  }
}

export default class FreezerPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      directory: {
        derived: true,
        set (url) {
          this.ui.dirInput.input = url.replace(System.baseURL, '/');
        },
        get () {
          return this.ui.dirInput.input;
        }
      },
      epiMorph: { defaultValue: true },
      isModuleBundle: { defaultValue: true },
      excludedPackages: {
        derived: true,
        set (packageNames) {
          this.ui.packageList.items = packageNames;
        },
        get () {
          return this.ui.packageList.items.map(m => m.value);
        }
      },
      expose: {
        get () {
          return [...super.prototype.expose, 'excludedPackages', 'directory', 'isModuleBundle'];
        }
      },
      bindings: {
        get () {
          return [{
            signal: 'onMouseDown', handler: 'onMouseDown'
          }, {
            model: 'add package button', signal: 'fire', handler: 'addExcludedPackage'
          }, {
            model: 'remove package button', signal: 'fire', handler: 'removeExcludedPackage'
          }, {
            model: 'confirm excluded package', signal: 'fire', handler: 'confirmExcludedPackage'
          }, {
            model: 'cancel button', signal: 'fire', handler: 'cancel'
          }, {
            model: 'ok button', signal: 'fire', handler: 'resolve'
          }];
        }
      }
    };
  }

  cancel () {
    this.view.remove();
    this.reject();
  }

  focus () {
    this.ui.compilerSelector.selection = 'Google Closure';
    this.ui.dirInput.focus();
  }

  resolve () {
    const { dirInput, packageList, compilerSelector } = this.ui;
    return super.resolve({
      location: this.directory,
      useTerser: compilerSelector.selection == 'Terser + Babel',
      excludedPackages: this.excludedPackages
    });
  }

  // this.checkDirStatus()

  async checkDirStatus () {
    fun.debounceNamed('checkDirStatus', 500, async () => {
      const { dirWarning, dirInput } = this.ui;
      if (!!this.directory &&
          await resource(System.baseURL).join(this.directory).exists()) {
        dirWarning.textAndAttributes = [
          ...Icon.textAttribute('exclamation-circle'),
          '  Directory will be overwritten.',
          {
            fontFamily: 'IBM Plex Sans',
            fontWeight: '600'
          }
        ];
        dirWarning.fontColor = Color.rgb(231, 76, 60);
        !dirWarning.visible && dirWarning.animate({
          visible: true,
          isLayoutable: true,
          top: dirInput.bottom,
          duration: 200,
          easing: easings.inOutExpo
        });
      } else {
        dirWarning.animate({
          isLayoutable: false,
          visible: false,
          duration: 200,
          easing: easings.inOutExpo
        });
      }
    })();
  }

  addExcludedPackage () {
    this.displayPackageInput(true);
  }

  removeExcludedPackage () {
    const { packageList } = this.ui;
    packageList.removeItem(packageList.selectedItems[0]);
  }

  async confirmExcludedPackage () {
    this.ui.packageList.addItem(this.ui.packageInput.input);
    await this.displayPackageInput(false);
    this.ui.packageInput.input = '';
  }

  verifyPackageName (pkgName) {
    return PackageRegistry
      .ofSystem(System)
      .allPackages()
      .find(pkg => pkg.name == pkgName);
  }

  onMouseUp (evt) {
    const {
      packageInput,
      addPackageButton,
      removePackageButton,
      confirmPackageButton,
      packageList
    } = this.ui;

    this.ui.removePackageButton.deactivated = !this.ui.packageList.selections.length;
  }

  async displayPackageInput (show) {
    const { packageInput, packageList, confirmPackageButton } = this.ui;
    const duration = 200;

    if (show) {
      packageInput.animate({
        visible: true, top: packageList.bottom + 10, duration
      });
      await confirmPackageButton.animate({
        visible: true, top: packageList.bottom + 15, duration
      });
    } else {
      confirmPackageButton.animate({
        visible: false, bottom: packageList.bottom - 5, duration
      });
      await packageInput.animate({
        visible: false, bottom: packageList.bottom, duration
      });
    }
  }
}

const FreezerPrompt = component(LightPrompt, {
  defaultViewModel: FreezerPromptModel,
  name: 'freezer prompt',
  extent: pt(481, 440.8),
  clipMode: 'hidden',
  layout: new TilingLayout({
    axis: 'column',
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(16, 16, 0, 0),
    resizePolicies: [['prompt title', {
      height: 'fixed',
      width: 'fill'
    }], ['dir input', {
      height: 'fixed',
      width: 'fill'
    }], ['compiler explanation', {
      height: 'fixed',
      width: 'fill'
    }], ['exclusion explanation', {
      height: 'fixed',
      width: 'fill'
    }], ['layout wrapper', {
      height: 'fixed',
      width: 'fill'
    }], ['button wrapper', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 16,
    wrapSubmorphs: false
  }),
  position: pt(960.8, 161.4),
  submorphs: [{
    name: 'prompt title',
    textAndAttributes: ['Freeze Part', null]
  }, add({
    type: Label,
    name: 'dir label',
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgb(45, 45, 45),
    fontSize: 16,
    fontWeight: 'Medium',
    nativeCursor: 'pointer',
    textAndAttributes: ['Directory to write files to:', null]
  }), add(part(InputLineDefault, {
    name: 'dir input',
    placeholder: 'Directory',
    submorphs: [{
      name: 'placeholder',
      extent: pt(103, 34.3),
      textAndAttributes: ['Directory', null]
    }]
  })), add({
    type: Text,
    name: 'dir warning',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 3,
    extent: pt(451.3, 17.2),
    fill: Color.rgba(255, 255, 255, 0),
    fixedWidth: true,
    fontColor: Color.rgb(231, 76, 60),
    fontFamily: 'IBM Plex Sans',
    isLayoutable: false,
    lineWrapping: true,
    nativeCursor: 'default',
    readOnly: true,
    textAlign: 'left',
    visible: false
  }), add({
    type: Text,
    name: 'compiler explanation',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 3,
    extent: pt(449, 109),
    fill: Color.rgba(255, 255, 255, 0),
    fixedWidth: true,
    fontColor: Color.rgb(102, 102, 102),
    fontFamily: 'IBM Plex Sans',
    lineWrapping: true,
    nativeCursor: 'default',
    readOnly: true,
    textAlign: 'left',
    textAndAttributes: [
      'Compression:', { textAlign: 'left', fontSize: 16, fontColor: Color.rgb(45, 45, 45) }, ' ', { textAlign: 'left', fontSize: 16 }, ' ', { textAlign: 'left' }, part(DropDownList, {
        name: 'compiler selector',
        extent: pt(127.3, 25.9),
        position: pt(104.4, 0),
        viewModel: {
          selection: 'Google Closure',
          items: ['Google Closure', 'Terser + Babel'],
          listAlign: 'selection',
          listMaster: SystemList,
          openListInWorld: true
        }
      }), { textAlign: 'left' }, '   \n', { fontSize: 5 }, '\nSelect the compiler to be used to compress the resulting bundle. Generally speaking Google Closure will yield smaller bundles but may break some parts of your bundle due to aggressive optimization. Terser + Babel is less aggressive but may fail with very large bundles > 10MB.', null]
  }), add({
    type: Label,
    name: 'excluded package label',
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: Color.rgb(45, 45, 45),
    fontSize: 16,
    fontWeight: 'Medium',
    nativeCursor: 'pointer',
    textAndAttributes: ['Packages to exclude from bundle:', null]
  }), add({
    type: 'text',
    name: 'exclusion explanation',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 3,
    extent: pt(449, 67),
    fill: Color.rgba(255, 255, 255, 0),
    fixedWidth: true,
    fontColor: Color.rgb(102, 102, 102),
    fontFamily: '"IBM Plex Sans",Sans-Serif',
    lineWrapping: true,
    textAndAttributes: ['Excluding packages from the bundle of the frozen part can reduce the total payload and its loading time ', null, 'dramatically', { fontWeight: 'bold' }, '. This however needs to be done with care. Make sure that none of your functionality depends of these excluded packages. If you do not know what you are doing it is best to leave this list as is.', { textAlign: 'left' }],
    nativeCursor: 'default',
    textAlign: 'center'
  }),

  add({
    name: 'layout wrapper',
    extent: pt(450, 155),
    fill: Color.rgba(46, 75, 223, 0),
    layout: new ConstraintLayout({
      lastExtent: pt(450, 155),
      submorphSettings: [['package list', {
        x: 'resize',
        y: 'resize'
      }], ['add package button', {
        x: 'move',
        y: 'move'
      }], ['remove package button', {
        x: 'move',
        y: 'move'
      }], ['package input', {
        x: 'resize',
        y: 'fixed'
      }]]
    }),
    submorphs: [part(InputLineDefault, {
      name: 'package input',
      borderColor: Color.rgb(204, 204, 204),
      borderRadius: 4,
      extent: pt(445, 32),
      highlightWhenFocused: true,
      padding: rect(10, 3, 0, 0),
      placeholder: 'Excluded package name',
      position: pt(0, 120),
      visible: false,
      submorphs: [{
        name: 'placeholder',
        extent: pt(237, 32),
        textAndAttributes: ['Excluded package name', null]
      }]
    }), part(DarkButton, {
      name: 'confirm excluded package',
      extent: pt(25, 21.9),
      viewModel: { label: Icon.textAttribute('check') },
      position: pt(0, 126.1),
      tooltip: 'add a new method',
      visible: false
    }), part(DefaultList, {
      name: 'package list',
      borderRadius: 4,
      dropShadow: new ShadowObject({ distance: 3, rotation: 75, color: Color.rgba(0, 0, 0, 0.2) }),
      extent: pt(442.4, 148.6),
      fontFamily: 'IBM Plex Sans',
      fontSize: 20,
      itemHeight: 29,
      manualItemHeight: true,
      position: pt(2.8, 4.5)
    }), part(DarkButton, {
      name: 'add package button',
      extent: pt(25, 25),
      position: pt(383.1, 125.2),
      tooltip: 'add a new method',
      submorphs: [
        { name: 'label', value: Icon.textAttribute('plus') }
      ]
    }), part(DarkButton, {
      name: 'remove package button',
      extent: pt(25, 25),
      position: pt(414, 125),
      tooltip: 'remove a method or class',
      submorphs: [
        { name: 'label', value: Icon.textAttribute('minus') }
      ]
    })]
  }), add({
    name: 'button wrapper',
    extent: pt(449, 48.9),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new TilingLayout({
      align: 'center',
      axis: 'row',
      axisAlign: 'center',
      orderByIndex: true,
      padding: {
        height: 0,
        width: 0,
        x: 20,
        y: 20
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      spacing: 20
    }),
    submorphs: [part(GreenButton, {
      name: 'ok button',
      extent: pt(90, 39),
      label: 'OK'
    }), part(RedButton, {
      name: 'cancel button',
      extent: pt(94, 39),
      label: 'CANCEL'
    })]
  })]
});

export { FreezerPrompt };
