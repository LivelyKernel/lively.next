import { part, component } from 'lively.morphic/components/core.js';
import { Color } from 'lively.graphics';
import { ModeSelector } from 'lively.components/widgets/mode-selector.cp.js';
import { TilingLayout } from 'lively.morphic';
import { CommentBrowserModel } from '../comment-browser.js';

const CommentBrowser = component({
  defaultViewModel: CommentBrowserModel,
  name: 'Comment Browser',
  layout: new TilingLayout({
    axis: 'column',
    axisAlign: 'center',
    orderByIndex: true,
    resizePolicies: [
      ['container', { height: 'fill', width: 'fill' }],
      ['mode selector', { height: 'fixed', width: 'fill' }]
    ]
  }),
  width: 280,
  height: 800,
  fill: Color.transparent,
  submorphs: [
    part(ModeSelector, {
      viewModel: {
        items: ['Unresolved Comments', 'Resolved Comments'],
        tooltips: ['Show unresolved comments', 'Show resolved comments']
      }
    }),
    {
      name: 'container',
      layout: new TilingLayout({
        axis: 'column',
        axisAlign: 'center',
        orderByIndex: true
      })
    }
  ]
});

export { CommentBrowser };
