import { component, part } from 'lively.morphic/components/core.js';
import { ObjectEditorModel, ImportControllerModel } from './index.js';
import { pt, rect, Color } from 'lively.graphics';
import { GridLayout, TilingLayout, Text, Icon, HorizontalLayout } from 'lively.morphic';
import { Tree } from 'lively.components';
import { ButtonDefault, SystemButton } from 'lively.components/buttons.cp.js';
import { DefaultList } from 'lively.components/list.cp.js';
import { obj } from 'lively.lang';

// ImportController.openInWorld()
const ImportController = component({
  defaultViewModel: ImportControllerModel,
  name: 'import controller',
  extent: pt(209.5, 472),
  fill: Color.rgba(0, 0, 0, 0),
  layout: new GridLayout({
    autoAssign: false,
    columns: [0, {
      width: 200
    }],
    grid: [['imports list'], ['buttons']],
    groups: {
      buttons: {
        align: 'topLeft',
        resize: true
      },
      'imports list': {
        align: 'topLeft',
        resize: true
      }
    },
    rows: [0, {
      height: 442
    }, 1, {
      fixed: 30
    }]
  }),
  submorphs: [part(DefaultList, {
    name: 'imports list',
    borderColor: Color.rgbHex('CCCCCC'),
    itemBorderRadius: 2,
    borderWidth: {
      left: 0, right: 0, bottom: 1, top: 1
    }
  }), {
    name: 'buttons',
    clipMode: 'hidden',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      orderByIndex: true,
      spacing: 3,
      wrapSubmorphs: false
    }),
    extent: pt(199.1, 29.3),
    fill: Color.rgba(0, 0, 0, 0),
    reactsToPointer: false,
    submorphs: [part(SystemButton, {
      name: 'add import button',
      extent: pt(26, 24),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('plus')
      }],
      tooltip: 'add new import'
    }), part(SystemButton, {
      name: 'remove import button',
      extent: pt(26, 24),
      submorphs: [{

        name: 'label',
        textAndAttributes: Icon.textAttribute('minus')
      }],
      tooltip: 'remove selected import(s)'
    }), part(SystemButton, {
      name: 'cleanup button',
      extent: pt(53, 24),
      submorphs: [{
        name: 'label',
        fontSize: 12,
        textAndAttributes: ['cleanup', null]
      }],
      tooltip: 'remove unused imports'
    }), part(SystemButton, {
      name: 'open button',
      extent: pt(38, 24),
      submorphs: [{
        name: 'label',
        fontSize: 12,
        textAndAttributes: ['open', null]
      }],
      tooltip: 'open module of selected import'
    })]
  }]
});

// ObjectEditorLight.openInWorld()
// w = part(ObjectEditorLight, { viewModel: { target: this.get('test target') }}).openInWindow()
const ObjectEditorLight = component({
  defaultViewModel: ObjectEditorModel,
  name: 'object editor light',
  extent: pt(693.7, 426.9),
  fill: Color.transparent,
  reactsToPointer: false,
  layout: new GridLayout({
    autoAssign: false,
    columns: [0, {
      fixed: 180
    }, 1, {
      width: 243
    }, 2, {
      fixed: 0
    }],
    grid: [
      ['object commands', 'object commands', 'object commands'],
      ['class tree', 'frozen warning', 'import controller'],
      ['class tree', 'source editor', 'import controller'],
      ['class and method controls', 'source editor controls', 'import controller']
    ],
    groups: {
      'class and method controls': {
        align: 'topLeft',
        resize: true
      },
      'class tree': {
        align: 'topLeft',
        resize: true
      },
      'frozen warning': {
        align: 'topLeft',
        resize: true
      },
      'import controller': {
        align: 'topLeft',
        resize: true
      },
      'object commands': {
        align: 'topLeft',
        resize: true
      },
      'source editor': {
        align: 'topLeft',
        resize: true
      },
      'source editor controls': {
        align: 'topLeft',
        resize: true
      }
    },
    rows: [0, {
      fixed: 28
    }, 1, {
      fixed: 0
    }, 2, {
      height: 125
    }, 3, {
      fixed: 30
    }]
  }),
  submorphs: [{
    name: 'object commands',
    extent: pt(727, 28),
    fill: Color.transparent,
    layout: new TilingLayout({
      orderByIndex: true,
      resizePolicies: [['target controls', {
        height: 'fixed',
        width: 'fill'
      }]],
      wrapSubmorphs: false
    }),
    reactsToPointer: false,
    submorphs: [{
      name: 'target controls',
      clipMode: 'hidden',
      extent: pt(181.3, 30),
      fill: Color.rgba(0, 0, 0, 0),
      // fix: replace layout
      layout: new HorizontalLayout({
        align: 'top',
        autoResize: false,
        direction: 'centered',
        orderByIndex: true,
        padding: {
          height: 0,
          width: 0,
          x: 2,
          y: 2
        },
        reactToSubmorphAnimations: false,
        renderViaCSS: true,
        resizeSubmorphs: false,
        spacing: 2
      }),
      position: pt(271.9, 0),
      reactsToPointer: false,
      submorphs: [
        part(SystemButton, {
          name: 'inspect object button',
          extent: pt(28, 24),
          tooltip: 'open object inspector',
          submorphs: [{
            name: 'label',
            textAndAttributes: Icon.textAttribute('cogs')
          }]
        }),
        part(SystemButton, {
          extent: pt(28, 24),
          name: 'publish button',
          tooltip: 'Freeze this morph',
          submorphs: [{
            name: 'label',
            textAndAttributes: Icon.textAttribute('cloud-upload-alt')
          }]
        }),
        part(SystemButton, {
          name: 'choose target button',
          extent: pt(26, 24),
          tooltip: 'select another target',
          submorphs: [{
            name: 'label',
            textAndAttributes: Icon.textAttribute('crosshairs')
          }]
        })]
    }, {
      name: 'freezer controls',
      clipMode: 'hidden',
      extent: pt(35, 28),
      fill: Color.rgba(0, 0, 0, 0),
      layout: new HorizontalLayout({
        align: 'top',
        autoResize: false,
        direction: 'rightToLeft',
        orderByIndex: true,
        padding: {
          height: 0,
          width: 0,
          x: 2,
          y: 2
        },
        reactToSubmorphAnimations: false,
        renderViaCSS: true,
        resizeSubmorphs: false,
        spacing: 2
      }),
      position: pt(626, 0),
      reactsToPointer: false
    }]
  }, {
    name: 'class and method controls',
    extent: pt(180, 30),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new HorizontalLayout({
      align: 'top',
      autoResize: false,
      direction: 'centered',
      orderByIndex: true,
      padding: {
        height: 0,
        width: 0,
        x: 2,
        y: 2
      },
      reactToSubmorphAnimations: false,
      renderViaCSS: true,
      resizeSubmorphs: false,
      spacing: 2
    }),
    submorphs: [part(SystemButton, {
      name: 'add button',
      extent: pt(26, 24),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('plus')
      }],
      tooltip: 'add a new method'
    }), part(SystemButton, {
      name: 'remove button',
      extent: pt(26, 24),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('minus')
      }],
      tooltip: 'remove a method or class'
    }), part(SystemButton, {
      name: 'fork package button',
      extent: pt(26, 24),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('code-branch')
      }],
      tooltip: 'fork package'
    }), part(SystemButton, {
      name: 'open in browser button',
      extent: pt(26, 24),
      submorphs: [{
        name: 'label',
        textAndAttributes: Icon.textAttribute('external-link-alt')
      }],
      tooltip: 'open selected class in system browser'
    })]
  }, {
    type: Text,
    name: 'source editor',
    borderColor: Color.rgb(204, 204, 204),
    borderWidth: 1,
    clipMode: 'auto',
    extent: pt(547, 442),
    fixedHeight: true,
    fixedWidth: true,
    fontFamily: '"IBM Plex Mono"',
    lineWrapping: 'by-chars',
    padding: rect(4, 2, 0, 0)
  }, {
    type: Tree,
    name: 'class tree',
    clipMode: 'hidden',
    extent: pt(180, 442),
    fontFamily: '"IBM Plex Sans"',
    fontSize: 14,
    borderColor: Color.rgb(204, 204, 204),
    borderWidth: {
      top: 1, bottom: 1, left: 0, right: 0
    },
    treeData: {}
  }, {
    name: 'source editor controls',
    borderColor: {
      bottom: Color.rgb(255, 255, 255),
      left: Color.rgb(204, 204, 204),
      right: Color.rgb(204, 204, 204),
      top: Color.rgb(255, 255, 255)
    },
    borderWidth: {
      bottom: 0,
      left: 1,
      right: 1,
      top: 0
    },
    extent: pt(547, 30),
    fill: Color.rgba(0, 0, 0, 0),
    layout: new GridLayout({
      autoAssign: false,
      columns: [0, {
        width: 110
      }, 1, {
        fixed: 30,
        paddingRight: 1
      }, 2, {
        fixed: 30,
        paddingLeft: 1
      }, 3, {
        width: 110
      }, 4, {
        fixed: 74,
        paddingRight: 4
      }],
      grid: [[null, 'save button', 'run method button', null, 'toggle imports button']],
      groups: {
        'run method button': {
          align: 'topLeft',
          resize: true
        },
        'save button': {
          align: 'topLeft',
          resize: true
        },
        'toggle imports button': {
          align: 'topLeft',
          resize: true
        }
      },
      rows: [0, {
        height: 30,
        paddingBottom: 3,
        paddingTop: 2
      }]
    }),
    submorphs: [
      part(SystemButton, {
        name: 'save button',
        extent: pt(29, 23),
        submorphs: [{
          name: 'label',
          textAndAttributes: Icon.textAttribute('save')
        }],
        tooltip: 'save'
      }), part(SystemButton, {
        name: 'run method button',
        extent: pt(28, 23),
        submorphs: [{
          name: 'label',
          textAndAttributes: Icon.textAttribute('play-circle')
        }],
        tooltip: 'execute selected method'
      }), part(SystemButton, {
        name: 'toggle imports button',
        extent: pt(70, 23),
        submorphs: [{
          name: 'label',
          textAndAttributes: ['imports', null]
        }],
        tooltip: 'toggle showing imports'
      })]
  }, part(ImportController, { name: 'import controller' })]
});

async function open (options = {}) {
  const {
    title,
    target,
    className,
    methodName,
    textPosition,
    scroll,
    classTreeScroll,
    evalEnvironment,
    loadingIndicator
  } = options;

  // w =  target: this.get('test target') }}).openInWindow()
  const ed = part(ObjectEditorLight, { viewModel: obj.dissoc(options, 'title', 'class', 'method', 'target', 'evalEnvironment') });
  const winOpts = { name: 'ObjectEditor window', title: options.title || 'ObjectEditor' };
  const win = (await ed.openInWindow(winOpts)).activate();
  await win.whenRendered();
  if (target) {
    if (loadingIndicator) loadingIndicator.label = 'Connecting to target';
    await ed.browse({
      title,
      target,
      className,
      methodName,
      textPosition,
      scroll,
      classTreeScroll,
      evalEnvironment
    });
  }
  win.doNotAcceptDropsForThisAndSubmorphs(); // lock the morph hierarchy to prevent accidental drops from happening
  return win;
}

export { ObjectEditorLight, ImportController, open };
