import { Label, TilingLayout, ViewModel, part, component } from 'lively.morphic';
import { connect, signal } from 'lively.bindings';
import { Color } from 'lively.graphics';
import { pt } from 'lively.graphics/geometry-2d.js';

const ModeSelectorLabel = component({
  type: Label,
  nativeCursor: 'pointer',
  name: 'mode selector label',
  fontWeight: 'bold',
  fill: Color.transparent,
  fontColor: Color.black,
  padding: 5,
  borderRadius: 3,
  textString: 'a mode selector label'
});

const ModeSelectorLabelDark = component(ModeSelectorLabel, {
  fill: Color.transparent,
  fontColor: Color.white
});

const ModeSelectorLabelSelected = component(ModeSelectorLabel, {
  fill: Color.black.withA(0.4),
  fontColor: Color.white
});

const ModeSelectorLabelSelectedDark = component(ModeSelectorLabel, {
  fill: Color.white.withA(0.8),
  fontColor: Color.black
});

/**
 * Allows to switch between different items by clicking on them. The selected Item can also be changed by calling the exposed `select` function.
 * A change in the selected item is signalled with the `selectionChanged` signal providing the newly selected item.
 *
 * The items need to be provided as an array of objects. The keys `name` and `text` need to be present. Optionally, a `tooltip` property is accepted.
 *
 * If no other `selectedItem` is provided, the first element of `items` will be selected by default. This initial selection does not trigger the above mentioned signal.
 * In the selected item or the item to be selected is specified by the name of the item as a string. This is also what the `selectionChanged` signal will provide.
 * The `ModeSelector` can be deactivated, graying out its UI elements and not accepting mouse inputs any longer.
 */
class ModeSelectorModel extends ViewModel {
  /* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  EXAMPLE:
  const example = part(ModeSelector, { // eslint-disable-line no-use-before-define
     viewModel: {
       items: [
         { text: 'demo1', name: 'demo one', tooltip: 'demo one' },
         { text: 'demo2', name: 'demo two', tooltip: 'demo two' },
         { text: 'demo3', name: 'demo three', tooltip: 'demo three' },
         { text: 'demo4', name: 'demo four', tooltip: 'demo four' }
       ]
     }
   }).openInWorld();
   connect(example, 'selectionChanged', $world, 'setStatusMessage');
  -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=- */
  static get properties () {
    return {
      expose: {
        get () {
          return ['select', 'items', 'enabled', 'selectedItem'];
        }
      },
      items: { },
      selectedItem: {},
      enabled: {
        defaultValue: true
      },
      selectedLabelMaster: {
        defaultValue: ModeSelectorLabelSelected // eslint-disable-line no-use-before-define
      },
      unselectedLabelMaster: {
        defaultValue: ModeSelectorLabel // eslint-disable-line no-use-before-define
      }
    };
  }

  viewDidLoad () {
    this.createLabels();
    this.select(this.selectedItem || this.items[0].name);
    if (!this.enabled) this.disable();
  }

  onRefresh (prop) {
    if (prop === 'enabled') {
      if (this.enabled) this.enable();
      else this.disable();
    }
    if (prop === 'selectedItem') {
      this.select(this.selectedItem);
    }
  }

  enable () {
    this.ui.labels.forEach(l => l.nativeCursor = 'pointer');
    this.view.opacity = 1;
  }

  disable () {
    this.ui.labels.forEach(l => l.nativeCursor = 'not-allowed');
    this.view.opacity = 0.5;
  }

  createLabels () {
    this.view.submorphs = this.items.map((item) => {
      const label = part(this.selectedLabelMaster, { // eslint-disable-line no-use-before-define
        textString: item.text,
        name: item.name,
        tooltip: item.tooltip
      });
      connect(label, 'onMouseDown', this, 'select', {
        updater: `function ($upd) {
          if (!viewModel.enabled) return;
          $upd(label.name, true, true);
        }`,
        varMapping: { label, viewModel: this }
      });
      return label;
    });
  }

  async select (itemName, withAnimation = false, withSignal = false) {
    // Selected Item Changed by Clicking on the View
    if (withAnimation) {
      this.ui.labels.forEach(l => {
        if (l.name !== itemName) {
          l.withAnimationDo(() => {
            l.master = { auto: this.unselectedLabelMaster };// eslint-disable-line no-use-before-define
          }, { duration: 200 });
        }
      });
      const labelToSelect = this.ui.labels.find((label) => label.name === itemName);
      await labelToSelect.withAnimationDo(() => {
        labelToSelect.master = { auto: this.selectedLabelMaster }; // eslint-disable-line no-use-before-define
      }, { duration: 200 });
    } else {
      // Selected Item changed programmatically
      this.ui.labels.forEach(l => {
        if (l.name !== itemName) {
          l.master = { auto: this.unselectedLabelMaster }; // eslint-disable-line no-use-before-define
        }
      });
      this.ui.labels.find((label) => label.name === itemName).master = { auto: this.selectedLabelMaster }; // eslint-disable-line no-use-before-define
    }

    this.selectedItem = itemName;
    if (withSignal) signal(this.view, 'selectionChanged', this.selectedItem);
  }
}

const ModeSelector = component({
  defaultViewModel: ModeSelectorModel,
  name: 'mode selector',
  extent: pt(234.7, 36.7),
  nativeCursor: 'pointer',
  height: 30,
  fill: Color.transparent,
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    spacing: 5
  }),
  submorphs: [
    part(ModeSelectorLabel, { name: 'mode1', textString: 'demo' }),
    part(ModeSelectorLabel, { name: 'mode2', textString: 'demo2' })
  ]
});

const ModeSelectorDark = component(ModeSelector, {
  viewModelClass: ModeSelectorModel,
  viewModel: {
    selectedLabelMaster: ModeSelectorLabelSelectedDark,
    unselectedLabelMaster: ModeSelectorLabelDark
  }
});

export { ModeSelector, ModeSelectorDark };
