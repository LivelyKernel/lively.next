import { pt, rect, Color } from 'lively.graphics';
import { GridLayout } from 'lively.morphic/layout.js';
import { Icon } from 'lively.morphic/text/icons.js';
import { part, component } from 'lively.morphic/components/core.js';
import { ShadowObject } from 'lively.morphic/rendering/morphic-default.js';
import { SearchWidgetModel } from './search.js';

const IconButtonDefault = component({
  type: 'button',
  name: 'icon button/default',
  borderWidth: 0,
  extent: pt(28, 24),
  fill: Color.rgba(0, 0, 0, 0),
  opacity: 0.9,
  renderOnGPU: true,
  submorphs: [{
    type: 'label',
    name: 'label',
    fontColor: Color.rgb(255, 255, 255),
    fontSize: 18,
    position: pt(5, 2.5),
    lineHeight: 1,
    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('check-circle')
  }]
});

const IconButtonClicked = component(IconButtonDefault, {
  name: 'icon button/clicked',
  opacity: .5
});

const IconButton = component(IconButtonDefault, {
  name: 'icon button',
  master: {
    auto: IconButtonDefault,
    click: IconButtonClicked
  }
});

const WidgetButton = component({
  type: 'button',
  name: 'widget button',
  borderColor: Color.rgb(255, 255, 255),
  borderWidth: 2,
  borderRadius: 5,
  extent: pt(57, 20),
  fill: Color.rgba(0, 0, 0, 0),
  submorphs: [{
    type: 'label',
    name: 'label',
    fontColor: Color.rgb(255, 255, 255),
    fontSize: 10,
    position: pt(5, 3.5),
    reactsToPointer: false,
    textAndAttributes: ['replace all', null]
  }]
});
// part(SearchWidget).openInWorld();
const SearchWidget = component({
  name: 'search widget',
  defaultViewModel: SearchWidgetModel,
  borderColor: Color.rgb(204, 204, 204),
  borderRadius: 6,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.4863477979397931) }),
  extent: pt(323.3, 56),
  fill: Color.rgba(0, 0, 0, 0.7471867324206476),
  layout: new GridLayout({
    autoAssign: false,
    columns: [0, { // inputs
      paddingLeft: 5,
      paddingRight: 5,
      width: 60
    }, 1, {
      fixed: 25
    }, 2, {
      fixed: 25
    }, 3, {
      fixed: 5
    }, 4, {
      fixed: 25
    }, 5, {
      fixed: 25
    }, 6, {
      fixed: 5
    }, 7, {
      fixed: 25
    }, 8, {
      fixed: 25
    }, 9, {
      fixed: 10,
      paddingRight: 4
    }],
    grid: [
      ['searchInput', 'caseModeButton', 'regexModeButton', null, 'nextButton', 'prevButton', null, 'acceptButton', 'cancelButton', null],
      ['replaceInput', 'replaceButton', 'replaceButton', 'replaceButton', 'replaceButton', 'replaceAllButton', 'replaceAllButton', 'replaceAllButton', 'replaceAllButton', 'replaceAllButton']],
    groups: {
      acceptButton: {
        align: 'topLeft',
        resize: false
      },
      cancelButton: {
        align: 'topLeft',
        resize: false
      },
      nextButton: {
        align: 'topLeft',
        resize: false
      },
      prevButton: {
        align: 'topLeft',
        resize: false
      },
      replaceAllButton: {
        align: 'topRight',
        resize: false
      },
      replaceButton: {
        align: 'topLeft',
        resize: false
      },
      replaceInput: {
        align: 'topLeft',
        resize: true
      },
      searchInput: {
        align: 'topLeft',
        resize: true
      }
    },
    rows: [0, {
      fixed: 28,
      paddingBottom: -2,
      paddingTop: 5
    }, 1, {
      fixed: 28,
      paddingBottom: 2.5,
      paddingTop: 2.5
    }]
  }),
  position: pt(395.3, 571.4),
  renderOnGPU: true,
  submorphs: [part(IconButton, {
    name: 'acceptButton'
  }), part(IconButton, {
    name: 'cancelButton',
    submorphs: [{
      name: 'label',
      textAndAttributes: Icon.textAttribute('times-circle')
    }]
  }), part(IconButton, {
    name: 'nextButton',
    submorphs: [{
      name: 'label',
      textAndAttributes: Icon.textAttribute('arrow-alt-circle-down')
    }]
  }), part(IconButton, {
    name: 'prevButton',
    submorphs: [{
      name: 'label',
      textAndAttributes: Icon.textAttribute('arrow-alt-circle-up')
    }]
  }), {
    type: 'input',
    name: 'searchInput',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 2,
    borderWidth: 1,
    extent: pt(173, 20),
    fill: Color.rgba(204, 204, 204, 0.2),
    cursorColor: Color.white,
    fontColor: Color.rgb(255, 255, 255),
    fontFamily: '"IBM Plex Mono"',
    historyId: 'lively.morphic-text search',
    padding: rect(2, 2, 0, 0),
    placeholder: 'search input',
    submorphs: [{
      type: 'label',
      name: 'placeholder',
      fontColor: Color.rgb(204, 204, 204),
      fontFamily: 'IBM Plex Mono',
      nativeCursor: '',
      padding: rect(2, 2, 0, 0),
      reactsToPointer: false,
      textAndAttributes: ['search input', null]
    }]
  }, {
    type: 'input',
    name: 'replaceInput',
    borderColor: Color.rgb(204, 204, 204),
    borderRadius: 2,
    borderWidth: 1,
    extent: pt(173, 20),
    fill: Color.rgba(204, 204, 204, 0.2),
    fontColor: Color.rgb(255, 255, 255),
    cursorColor: Color.white,
    fontFamily: '"IBM Plex Mono"',
    historyId: 'lively.morphic-text replace',
    padding: rect(2, 2, 0, 0),
    placeholder: 'replace input',
    submorphs: [{
      type: 'label',
      name: 'placeholder',
      fontColor: Color.rgb(204, 204, 204),
      fontFamily: 'IBM Plex Mono',
      nativeCursor: '',
      padding: rect(2, 2, 0, 0),
      reactsToPointer: false,
      textAndAttributes: ['replace input', null]
    }]
  }, part(WidgetButton, {
    name: 'replaceButton',
    width: 81,
    submorphs: [{
      name: 'label',
      textAndAttributes: ['replace', null]
    }]
  }), part(WidgetButton, {
    name: 'replaceAllButton',
    width: 81,
    submorphs: [{
      name: 'label',
      textAndAttributes: ['replace all', null]
    }]
  }), part(IconButton, {
    name: 'regexModeButton',
    opacity: 0.5,
    submorphs: [{
      name: 'label',
      tooltip: ['Match with Regular Expressions.\n', { fontWeight: 'bold' }, 'Either directly type your regular expression,\nor use JS slash syntax if you want to use RegEx flags.'],
      textAndAttributes: Icon.textAttribute('circle-question')
    }]
  }), part(IconButton, {
    name: 'caseModeButton',
    opacity: 0.5,
    submorphs: [{
      name: 'label',
      tooltip: 'Match Case Sensitive',
      textAndAttributes: Icon.textAttribute('circle-h')
    }]
  })]
});

export { SearchWidget };
