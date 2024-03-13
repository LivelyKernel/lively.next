import { component, easings, stringToEasing, Morph, part, Path, Ellipse, Icon, Label, TilingLayout } from 'lively.morphic';
import { pt, rect, Color } from 'lively.graphics';
import { num, fun, promise } from 'lively.lang';
import { Text } from 'lively.morphic/text/morph.js';
import { ViewModel } from 'lively.morphic/components/core.js';

class ProgressIndicatorModel extends ViewModel {
  get expose () {
    return ['showInfiniteProgress', 'finishPackage'];
  }

  viewDidLoad () {
    super.viewDidLoad();
    this.ui.progressStatus.textString = ' ';
    this.ui.progressFill.width = 0;
  }

  showInfiniteProgress () {
    this.ui.progressStatus.textString = 'Loading lively.next';
    this.ui.progressFill.width = 0;
    this.ui.progressFill.animate({
      duration: 15000,
      width: this.ui.progressBarWrapper.width - 15,
      easing: easings.outExpo
    });
  }

  finishPackage ({
    packageName, loaded
  }) {
    const packagesToLoad = ['lively.lang', 'lively.ast', 'lively.source-transform', 'lively.classes', 'lively.vm', 'lively.modules', 'lively.storage', 'lively.morphic', 'world'];
    if (!loaded) return;
    this.ui.progressStatus.textString = 'Loading ' + packageName;
    const maxWidth = this.ui.progressBarWrapper.width;
    const goalWidth = (packagesToLoad.indexOf(packageName) + 1) / packagesToLoad.length * maxWidth;
    // this.ui.progressFill.animate({
    //   width: goalWidth, duration: 500
    // });
    this.ui.progressFill.width = goalWidth;
  }
}

export const ProgressIndicator = component({
  defaultViewModel: ProgressIndicatorModel,
  fill: Color.rgba(0, 0, 0, 0),
  extent: pt(429.4, 110.5),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    spacing: 20,
    wrapSubmorphs: true
  }),
  submorphs: [{
    type: Text,
    name: 'progress status',
    fontWeight: '600',
    fontSize: 20,
    dynamicCursorColoring: true,
    fill: Color.rgba(0, 0, 0, 0),
    position: pt(-11, 28),
    textAndAttributes: ['Status label', null]

  }, {
    name: 'progress bar wrapper',
    clipMode: 'hidden',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      justifySubmorphs: 'spaced',
      padding: rect(2, 0, 0, 0),
      spacing: 20
    }),
    borderRadius: 50,
    opacity: 0.6,
    extent: pt(400, 10),
    fill: Color.rgb(0, 0, 0),
    position: pt(37.4, 26.6),
    submorphs: [{
      name: 'progress fill',
      borderRadius: {
        bottomLeft: 10,
        bottomRight: 0,
        topLeft: 10,
        topRight: 0
      },
      extent: pt(209, 6),
      fill: Color.rgb(255, 254, 254),
      position: pt(-130, 30)
    }]
  }]
});
