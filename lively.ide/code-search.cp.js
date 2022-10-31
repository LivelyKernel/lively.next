import { Icon, TilingLayout, component, part } from 'lively.morphic';
import { pt, Color, rect } from 'lively.graphics';
import { InputLineDefault } from 'lively.components/inputs.cp.js';
import { DropDownList, DefaultList } from 'lively.components/list.cp.js';
import { SystemList } from './styling/shared.cp.js';
import { CodeSearcher } from './code-search.js';
import { ButtonDefault } from 'lively.components/buttons.cp.js';
import { Label } from 'lively.morphic/text/label.js';

const ModeButtonInactive = component(ButtonDefault, {
  extent: pt(27, 27),
  borderStyle: 'none',
  fill: Color.transparent
});

const ModeButtonInactiveHover = component(ModeButtonInactive, {
  fill: Color.gray
});

const ModeButtonActiveClick = ModeButtonInactiveHover;

const ModeButtonInactiveClick = component(ModeButtonInactive, {
  fill: Color.darkGray
});

const ModeButtonActiveHover = ModeButtonInactiveClick;

const ModeButtonActive = component(ModeButtonInactive, {
  fill: Color.darkGray,
  submorphs: [{
    name: 'label',
    fontColor: Color.white
  }]
});

const ModeButtonDisabled = component(ModeButtonInactive, {
  visible: false,
  reactsToPointer: false
});

const CodeSearch = component({
  type: CodeSearcher,
  name: 'code search',
  acceptsDrops: false,
  extent: pt(538, 421.5),
  layout: new TilingLayout({
    axis: 'column',
    orderByIndex: true,
    resizePolicies: [['controls holder', {
      height: 'fixed',
      width: 'fill'
    }], ['list', {
      height: 'fill',
      width: 'fill'
    }]],
    spacing: 5,
    wrapSubmorphs: false,
    renderViaCSS: false
  }),
  selectedAction: 'default',
  submorphs: [
    {
      name: 'controls holder',
      height: 43.0921875,
      layout: new TilingLayout({
        axisAlign: 'right',
        orderByIndex: true,
        padding: rect(5, 0, -5, 0),
        resizePolicies: [['input', {
          height: 'fixed',
          width: 'fill'
        }], ['holder', {
          height: 'fixed'
        }]],
        spacing: 2,
        wrapSubmorphs: false
      }),
      borderColor: Color.rgb(23, 160, 251),
      fill: Color.transparent,
      position: pt(17.3, 247.4),
      submorphs: [part(ModeButtonInactive, {
        master: { click: ModeButtonInactiveClick, hover: ModeButtonInactiveHover },
        name: 'reload',
        position: pt(-415.8, -407.5),
        submorphs: [{
          name: 'label',
          fontColor: Color.rgb(60, 60, 60),
          textAndAttributes: Icon.textAttribute('rotate-right')
        }],
        tooltip: 'Refresh Search Results'
      }), part(InputLineDefault, {
        name: 'input',
        borderRadius: 6,
        borderWidth: 1,
        extent: pt(243, 27),
        fontFamily: 'Monaco,monospace',
        fontSize: 14,
        haloShadow: {
          blur: 6,
          color: {
            a: 1,
            b: 0.8588,
            g: 0.5961,
            r: 0.2039
          },
          distance: 0,
          rotation: 45
        },
        historyId: 'lively.morphic-code searcher',
        padding: rect(5, 5, 0, 0),
        placeholder: 'Search Source Files',
        submorphs: [{
          name: 'placeholder',
          extent: pt(134, 29),
          fontSize: 14,
          padding: rect(5, 5, 0, 0),
          lineHeight: 1,
          textAndAttributes: ['Search Source Files', null]
        }]
      }), {
        name: 'holder',
        extent: pt(89.7, 27),
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'right',
          axisAlign: 'center',
          hugContentsHorizontally: true,
          orderByIndex: true,
          padding: rect(0, 0, 5, 0),
          spacing: 2,
          wrapSubmorphs: false
        }),
        position: pt(0, 33),
        submorphs: [part(ModeButtonInactive, {
          master: { click: ModeButtonInactiveClick, hover: ModeButtonInactiveHover },
          tooltip: 'Search Case Sensitive',
          name: 'caseMode',
          extent: pt(27, 22),
          submorphs: [{
            type: Label,
            name: 'label',
            textAndAttributes: Icon.textAttribute('circle-h')
          }]
        }), part(ModeButtonInactive, {
          master: { click: ModeButtonInactiveClick, hover: ModeButtonInactiveHover },
          tooltip: 'Search based on regular expressions.\n\
Regular expression should be given without quotes or literal mode slashes.',
          name: 'regexMode',
          extent: pt(27, 22),
          submorphs: [{
            type: Label,
            name: 'label',
            textAndAttributes: Icon.textAttribute('circle-question')
          }]
        }), part(DropDownList, {
          name: 'search chooser',
          master: { auto: ModeButtonActive, click: ModeButtonInactiveClick },
          viewModel: {
            openListInWorld: true,
            listMaster: SystemList,
            items: [
              'in loaded modules',
              'in loaded and unloaded modules'
            ]
          },
          borderColor: Color.gray,
          borderStyle: 'none',
          extent: pt(63, 22),
          fill: Color.darkGray,
          layout: new TilingLayout({
            align: 'center',
            axisAlign: 'center',
            hugContentsHorizontally: true,
            orderByIndex: true,
            padding: rect(10, 0, 0, 0),
            wrapSubmorphs: false
          }),
          submorphs: [{
            name: 'label',
            fontColor: Color.white
          }]
        })]
      }]
    },
    part(DefaultList, {
      name: 'list',
      extent: pt(538.7, 279.6),
      fontFamily: 'Monaco, monospace',
      itemPadding: rect(4, 2, 0, 0),
      padding: rect(2, 0, 0, 0),
      position: pt(0, 27)
    })
  ]
})
 ;

export { CodeSearch, ModeButtonActive, ModeButtonInactive, ModeButtonActiveClick, ModeButtonInactiveClick, ModeButtonActiveHover, ModeButtonInactiveHover, ModeButtonDisabled };
