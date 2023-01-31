import { component, Icon, Ellipse, Text, easings, part, TilingLayout, HTMLMorph, ViewModel } from 'lively.morphic';
import { Color, rect, pt } from 'lively.graphics';
import { InputLineDark } from 'lively.components/inputs.cp.js';

class WindowPreviewModel extends ViewModel {
  static get properties () {
    return {
      windowSwitcher: { },
      window: { },
      title: { },
      expose: {
        get () {
          return ['html'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onHoverIn', handler: 'onHoverIn' },
            { signal: 'onHoverOut', handler: 'onHoverOut' },
            { signal: 'onMouseDown', handler: 'onMouseDown' },
            { target: 'close button', signal: 'onMouseDown', handler: 'closeWindow' }
          ];
        }
      }
    };
  }

  closeWindow (evt) {
    this.view.remove();
    this.windowSwitcher.windowsData = this.windowSwitcher.windowsData.filter(wD => wD.window !== this.window);
    this.window.close(false);
    this.windowSwitcher.closeIfNoWindowsAreDisplayed();
  }

  set html (val) {
    this.ui.htmlMorph.html = val;
  }

  get html () {
    return this.ui.htmlMorph.html;
  }

  onMouseDown (evt) {
    if (evt.targetMorph === this.ui.closeButton) return;
    this.windowSwitcher.close();
    this.window.activate(true);
  }

  onHoverIn () {
    this.view.animate({
      dropShadow: { blur: 15, color: Color.rgba(0, 0, 0, 0.68), distance: 2, spread: 10, fast: false },
      duration: 200,
      easing: easings.inOut
    });
    this.ui.htmlMorph.animate({
      scale: 1.2,
      duration: 200,
      easing: easings.inOut
    });
    this.windowSwitcher.ui.hoveredWindowTitle.visible = true;
    this.windowSwitcher.ui.hoveredWindowTitle.textString = this.title;
    this.windowSwitcher.layoutTitlePreview();
  }

  onHoverOut () {
    this.view.animate({
      dropShadow: { blur: 15, color: Color.transparent, distance: 0, spread: 0, fast: false },
      duration: 200,
      easing: easings.inOut
    });
    this.ui.htmlMorph.animate({
      scale: 1,
      duration: 200,
      easing: easings.inOut
    });
    this.windowSwitcher.ui.hoveredWindowTitle.visible = false;
  }
}

// part(WindowPreview).openInHand();
const WindowPreview = component({
  name: 'window preview',
  defaultViewModel: WindowPreviewModel,
  extent: pt(130, 130),
  fill: Color.transparent,
  halosEnabled: false,
  submorphs: [{
    type: HTMLMorph,
    halosEnabled: false,
    name: 'html morph',
    extent: pt(100, 100),
    fill: Color.transparent
  },
  {
    name: 'close button',
    type: Ellipse,
    position: pt(-15, -15),
    extent: pt(20, 20),
    fill: Color.black.withA(0.6),
    halosEnabled: false,
    submorphs: [{
      type: 'text',
      reactsToPointer: false,
      name: 'label',
      fontColor: Color.white,
      fill: Color.transparent,
      fontSize: 15,
      halosEnabled: false,
      padding: rect(5, 2, -2.5, 1),
      textAndAttributes: Icon.textAttribute('times')
    }
    ]
  }]
});

class WindowSwitcherModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { target: 'search field', signal: 'inputChanged', handler: 'filterWindows' },
            { target: 'clear button', signal: 'onMouseDown', handler: 'clearSearch' },
            { signal: 'onMouseDown', handler: 'onMouseDown' }
          ];
        }
      },
      expose: {
        get () {
          return ['arrangeWindows', 'keybindings', 'commands', 'close', 'layoutTitlePreview', 'windowsData'];
        }
      }
    };
  }

  onMouseDown (evt) {
    if (evt.targetMorph === this.view) this.close();
  }

  closeIfNoWindowsAreDisplayed () {
    if (this.windowsData.length === 0) this.close();
  }

  filterWindows () {
    const input = this.ui.searchField.textString;

    if (!input) {
      this.ui.clearButton.visible = false;
      this.windowsData.forEach(winData => {
        if (!winData.preview.world()) this.ui.previewHolder.addMorph(winData.preview);
      });
      return;
    }
    this.ui.clearButton.visible = true;
    this.windowsData.forEach(winData => {
      if (!winData.title.toLowerCase().includes(input.toLowerCase())) winData.preview.remove();
      else this.ui.previewHolder.addMorph(winData.preview);
    });
  }

  clearSearch () {
    this.ui.searchField.textString = '';
  }

  arrangeWindows () {
    const windows = $world.submorphs.filter(({ isWindow }) => isWindow);
    this.windowsData = windows.map(win => {
      return {
        render: win.minimized ? win._previewHTML : win.generatePreviewHTML(),
        title: win.title,
        window: win
      };
    });

    this.windowsData.forEach(winData => {
      winData.preview = part(WindowPreview, { viewModel: { windowSwitcher: this, window: winData.window, title: winData.title } });
      winData.preview.html = winData.render;
    }
    );
    this.windowsData.forEach(winData => this.ui.previewHolder.addMorph(winData.preview));
  }

  viewDidLoad () {
    this.reopenSceneGraph = $world.activeSideBars.includes('scene graph');
    this.reopenPropertiesPanel = $world.activeSideBars.includes('properties panel');
    if (this.reopenSceneGraph) $world.sceneGraphFlap.executeAction();
    if (this.reopenPropertiesPanel) $world.propertiesPanelFlap.executeAction();
    this.view.position = pt(0, 0),
    this.view.extent = pt($world.width, $world.height);
    this.layoutPreviewHolder();
    this.layoutSearchBar();
    $world.blur = 20;
    this.ui.searchField.focus();
    this.arrangeWindows();
  }

  layoutTitlePreview () {
    const title = this.ui.hoveredWindowTitle;
    title.center = this.view.center;
    title.top = 150;
  }

  layoutSearchBar () {
    const searchBar = this.ui.searchField;
    searchBar.center = this.view.center;
    searchBar.position.y = 60;
    const clearButton = this.ui.clearButton;
    clearButton.top = searchBar.position.y + (65 / 2 - 35 / 2);
    clearButton.left = searchBar.right - 35 - 35 / 2;
  }

  layoutPreviewHolder () {
    const previewHolder = this.ui.previewHolder;
    const extent = this.view.extent;
    previewHolder.extent = pt(extent.x - 80, extent.y - 230);
    previewHolder.position = pt(40, 200);
  }

  close () {
    if (this.reopenSceneGraph) $world.sceneGraphFlap.executeAction();
    if (this.reopenPropertiesPanel) $world.propertiesPanelFlap.executeAction();
    this.view.remove();
    $world.blur = 0;
  }

  get keybindings () {
    return [{ keys: 'Escape', command: 'close' }];
  }

  get commands () {
    return [
      {
        name: 'close',
        exec: () => this.close()
      }
    ];
  }
}

export const WindowSwitcher = component({
  name: 'window switcher',
  hasFixedPosition: true,
  defaultViewModel: WindowSwitcherModel,
  halosEnabled: false,
  fill: Color.rgb(30, 30, 30).withA(0.2),
  position: pt(0, 0),
  extent: pt(1600, 900),
  submorphs: [
    part(InputLineDark, {
      name: 'search field',
      placeholder: 'Search Windows...',
      fontSize: 46,
      borderRadius: 15,
      extent: pt(650, 65),
      position: pt(650, 230)
    }),
    {
      name: 'clear button',
      type: Ellipse,
      extent: pt(35, 35),
      visible: false,
      fill: Color.rgb(30, 30, 30).withA(0.6),
      halosEnabled: false,
      submorphs: [{
        type: 'text',
        reactsToPointer: false,
        name: 'label',
        fontColor: Color.white,
        fill: Color.transparent,
        fontSize: 30,
        halosEnabled: false,
        autoWidth: true,
        padding: rect(8, 2, -8, -6),
        textAndAttributes: Icon.textAttribute('times')
      }
      ]
    },
    {
      name: 'preview holder',
      extent: pt(1000, 500),
      position: pt(30, 40),
      borderRadius: 3,
      fill: Color.transparent,
      reactsToPointer: false,
      layout: new TilingLayout({
        wrapSubmorphs: true
      }),
      clipMode: 'auto',
      halosEnabled: false
    },
    {
      name: 'hovered window title',
      type: Text,
      padding: 5,
      borderRadius: 3,
      visible: false,
      fill: Color.rgba(0, 0, 0, 0.68),
      fontColor: Color.white,
      fontSize: 20,
      autoWidth: true
    }
  ]
});
