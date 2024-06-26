import { ToggleModel, LightToggle, Toggle } from 'lively.components/toggle.cp.js';
import { component } from 'lively.morphic/components/core.js';
import { fun } from 'lively.lang';

class OfflineToggleModel extends ToggleModel {
  async viewDidLoad () {
    if (lively.isInOfflineMode || (localStorage.getItem('LIVELY_OFFLINE_MODE') == true)) this.active = true;
    else this.active = false;

    // FIXME: this is unfortunate and should be prevented somehow
    await document.fonts.ready;
    delete this.ui.label._cachedBounds;
    this.ui.label.fit();
  }

  toggle () {
    super.toggle();
    localStorage.setItem('LIVELY_OFFLINE_MODE', this.active ? 1 : 0);
    if (this.active) {
      fun.guardNamed('offline-enter-prompt', () => {
        return $world.inform('You are entering offline mode.\n Interactions with GitHub repositories are not available. You will not be able to update or upload projects.');
      })();
    }
  }
}

export const OfflineToggleDark = component(Toggle, {
  name: 'offline mode toggle',
  defaultViewModel: OfflineToggleModel,
  viewModel: {
    iconActive: 'mi-wifi_off',
    iconInactive: 'mi-wifi',
    labelActive: 'offline mode',
    labelInactive: 'online mode',
    tooltip: 'Toggle Offline Mode'
  }
});

export const OfflineToggleLight = component(OfflineToggleDark, {
  master: LightToggle
});
