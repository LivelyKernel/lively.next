import { pt, rect, Color } from 'lively.graphics';

import { Icon } from 'lively.morphic/text/icons.js';
import { part, component } from 'lively.morphic/components/core.js';
import { ShadowObject } from 'lively.morphic/rendering/morphic-default.js';

import { TilingLayout } from 'lively.morphic';
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

const SearchWidget = component({
  name: 'search widget',
  defaultViewModel: SearchWidgetModel,
  borderColor: Color.rgb(204, 204, 204),
  borderRadius: 6,
  dropShadow: new ShadowObject({ color: Color.rgba(0, 0, 0, 0.4863477979397931) }),
  extent: pt(300, 55),
  fill: Color.rgba(0, 0, 0, 0.7471867324206476),
  layout: new TilingLayout({ }),
  position: pt(395.3, 571.4),
  renderOnGPU: true,
  submorphs: [
    {
      name: 'upper row',
      fill: Color.transparent,
      layout: new TilingLayout({
        spacing: 5,
        padding: rect(10, 6, -10, -6),
        axis: 'column'
      }),
      submorphs: [
        {
          type: 'input',
          name: 'searchInput',
          borderColor: Color.rgb(204, 204, 204),
          borderRadius: 2,
          borderWidth: 1,
          extent: pt(150, 20),
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
        }, part(IconButton, {
          name: 'nextButton',
          submorphs: [{
            name: 'label',
            textAndAttributes: Icon.textAttribute('arrow-alt-circle-down')
          }]
        }),
        part(IconButton, {
          name: 'prevButton',
          submorphs: [{
            name: 'label',
            textAndAttributes: Icon.textAttribute('arrow-alt-circle-up')
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
        })
      ]
    },
    {
      name: 'lower row',
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'column',
        spacing: 5,
        padding: rect(10, 0, -10, 0)
      }),
      submorphs: [{
        type: 'input',
        name: 'replaceInput',
        borderColor: Color.rgb(204, 204, 204),
        borderRadius: 2,
        borderWidth: 1,
        extent: pt(150, 20),
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
        width: 60,
        submorphs: [{
          name: 'label',
          textAndAttributes: ['replace', null]
        }]
      }), part(WidgetButton, {
        name: 'replaceAllButton',
        width: 60,
        submorphs: [{
          name: 'label',
          textAndAttributes: ['replace all', null]
        }]
      })
      ]
    }]
});

export { SearchWidget };
