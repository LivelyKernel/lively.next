import { pt, Rectangle, rect, Color } from 'lively.graphics';

import { Icon } from 'lively.morphic/text/icons.js';
import { part, component } from 'lively.morphic/components/core.js';
import { ShadowObject } from 'lively.morphic/rendering/morphic-default.js';

import { TilingLayout, Text } from 'lively.morphic';
import { SearchWidgetModel } from './search.js';
import { InputLine } from 'lively.components/inputs.js';
import { ButtonModel } from 'lively.components';

const IconButtonDefault = component({
  defaultViewModel: ButtonModel,
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
    click: IconButtonClicked,
    states: {
      disabled: IconButtonClicked
    }
  }
});

const WidgetButtonClicked = component({ opacity: 0.5 });

const WidgetButton = component({
  defaultViewModel: ButtonModel,
  master: {
    click: WidgetButtonClicked,
    states: {
      disabled: WidgetButtonClicked
    }
  },
  name: 'widget button',
  nativeCursor: 'pointer',
  layout: new TilingLayout({
    align: 'center',
    axisAlign: 'center'
  }),
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
  extent: pt(344, 55),
  epiMorph: true,
  fill: Color.rgba(0, 0, 0, 0.7471867324206476),
  layout: new TilingLayout({
    spacing: 2,
    padding: Rectangle.inset(2, 2, 2, 4),
    hugContentsVertically: true,
    axis: 'column',
    resizePolicies: [
      ['upper row', { height: 'fixed', width: 'fill' }],
      ['lower row', { height: 'fixed', width: 'fill' }]
    ]
  }),
  position: pt(395.3, 571.4),
  renderOnGPU: true,
  submorphs: [
    {
      name: 'upper row',
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'row',
        align: 'center',
        axisAlign: 'center',
        resizePolicies: [
          ['label holder', { height: 'fixed', width: 'fixed' }]
        ]
      }),
      submorphs: [
        {
          type: InputLine,
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
        }, {
          name: 'label holder',
          extent: pt(74, 15),
          layout: new TilingLayout({
            axis: 'row'
          }),
          clipMode: 'hidden',
          fill: Color.transparent,
          submorphs: [{
            type: Text,
            fontColor: Color.lively,
            fontFamily: 'IBM Plex Mono',
            textString: 'no search',
            padding: rect(7, 0, -7, 0),
            name: 'result index label'
          },
          {
            type: Text,
            fontColor: Color.lively.withA(0),
            fontFamily: 'IBM Plex Mono',
            textString: '/1000',
            padding: rect(0, 0, 4, 0),
            name: 'result total label'
          }]
        },
        part(IconButton, {
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
          submorphs: [{
            name: 'label',
            tooltip: ['Match with Regular Expressions.\n', { fontWeight: 'bold' }, 'Either directly type your regular expression,\nor use JS slash syntax if you want to use RegEx flags.'],
            textAndAttributes: Icon.textAttribute('circle-question')
          }]
        }), part(IconButton, {
          name: 'caseModeButton',
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
        axis: 'row',
        align: 'left',
        spacing: 10,
        padding: rect(2, 0, 0, 2)
      }),
      submorphs: [{
        type: InputLine,
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
        width: 55,
        submorphs: [{
          name: 'label',
          textAndAttributes: ['replace', null]
        }]
      }), part(WidgetButton, {
        name: 'replaceAllButton',
        width: 55,
        submorphs: [{
          name: 'label',
          textAndAttributes: ['replace all', null]
        }]
      })
      ]
    }]
});

export { SearchWidget };
