import { ViewModel, part, component } from 'lively.morphic/components/core.js';
import { Label, TilingLayout } from 'lively.morphic';
import { connect, signal } from 'lively.bindings';
import { Color } from 'lively.graphics';
import { pt } from 'lively.graphics/geometry-2d.js';

/**
 * Allows to switch between different items by clicking on them. See `ModeSelectorModel.example()`.
 * A change in the selected item is signalled with the `selectionChanged` signal providing the newly selected item.
 *
 * The items need to be provided as an array. Tooltips can be provided as well, their order and count must match the provided items.
 *
 * A number `init` can be provided, which specifies the index of the item that should be selected upon creation of the `ModeSelector`.
 * If `init` is not provided, the first element of `items` will be selected by default. This initial selection does not trigger the above mentioned signal.
 */
class ModeSelectorModel extends ViewModel {
  static get properties () {
    return {
      items: { },
      tooltips: {},
      init: {},
      tooltips: {},
      selectedItem: {}
    };
  }
  
  static example () {
    const example = part(ModeSelector, {
      viewModel: {
        items: ['demo1', 'demo2'],
        tooltips: ['toggle demo 1', 'toggle demo 2'],
        init: 1
      }
    }).openInWorld();
    connect(example.viewModel, 'selectionChanged', $world, 'setStatusMessage');
  }

  viewDidLoad () {
    this.createLabels();
    this.selectedItem = this.items[this.init ? this.init : 0];
    this.ui.labels.find((label) => label.name === this.selectedItem + 'Label').viewModel.toggleSelection(false);
  }

  createLabels () {
    this.view.submorphs = this.items.map((item, i) => {
      const label = part(ModeSelectorLabel, {
        textString: item,
        name: item + 'Label',
        tooltip: this.tooltips && this.tooltips[i] ? this.tooltips[i] : ''
      });
      connect(label, 'onMouseDown', this, 'update', {
        updater: function ($upd) {
          $upd(item);
        },
        varMapping: { item }
      });
      return label;
    });
  }

  update (item) {
    this.ui.labels.find((label) => label.name === this.selectedItem + 'Label').viewModel.toggleSelection();
    this.selectedItem = item;
    this.ui.labels.find((label) => label.name === item + 'Label').viewModel.toggleSelection();
    signal(this, 'selectionChanged', this.selectedItem);
  }
}

class ModeSelectorLabelModel extends ViewModel {
  static get properties () {
    return {
      selected: { defaultValue: false }
    };
  }

  toggleSelection (animate = true) {
    let newFill, newFontColor;
    if (!this.selected) {
      this.selected = true;
      newFill = Color.black.withA(0.4),
      newFontColor = Color.white;
    } else {
      this.selected = false;
      newFill = Color.transparent;
      newFontColor = Color.black;
    }
    if (animate) {
      this.view.animate({
        fill: newFill,
        fontColor: newFontColor,
        duration: 200
      });
    } else {
      this.view.fill = newFill;
      this.view.fontColor = newFontColor;
    }
  }
}

const ModeSelectorLabel = component({
  type: Label,
  defaultViewModel: ModeSelectorLabelModel,
  name: 'mode selector label',
  fontWeight: 'bold',
  padding: 5,
  borderRadius: 3,
  textString: 'a mode selector label'
});

const ModeSelector = component({
  defaultViewModel: ModeSelectorModel,
  name: 'mode selector',
  extent: pt(234.7, 36.7),
  height: 30,
  fill: Color.transparent,
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center',
    orderByIndex: true,
    spacing: 5,
    wrapSubmorphs: false
  }),
  submorphs: [
    part(ModeSelectorLabel, { name: 'mode1', textString: 'demo' }),
    part(ModeSelectorLabel, { name: 'mode2', textString: 'demo2' })
  ]
});

export { ModeSelector, ModeSelectorModel };
