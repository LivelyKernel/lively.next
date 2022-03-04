import { connect, signal } from 'lively.bindings';
import { Rectangle } from 'lively.graphics';
import { fun, properties, obj, arr } from 'lively.lang';
import { Text } from 'lively.morphic';

// await (new BindingsProfiler().start())

// Bindings profiling Fri May 24 2019 17:43:14 GMT+0200 (Central European Summer Time)
// Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.36
// SimpleConnect:	7
// MethodConnect:	14
// ConverterConnectAttribute:	15
// ConverterConnectMethod:	15
// UpdaterConnectAttribute:	19
// UpdaterConnectMethod:	10
// TextMorphConnect:	6937
// CreateConnection:	26
// SimpleMethodCall:	7

class BindingsProfiler {
  constructor (args) {
    this.connectCount = 20000;
  }

  startAndShow () {
    connect(this, 'result', $world, 'addTextWindow');
    this.start();
  }
  
  async start () {
    let runPrefix = 'run';
    let self = this;
    let methods = properties.all(
      obj.getOwnPropertyDescriptors(this.constructor.prototype),
      (name) => { 
        return name.startsWith(runPrefix);
      });
    let result = 'Bindings profiling ' + new Date() + '\n' + navigator.userAgent;
    let progressBar = await $world.addProgressBar();
    await arr.forEachShowingProgress(methods, progressBar, function (name) {
      let time = self[name]();
      name = name.substring(runPrefix.length, name.length);
      result += '\n' + name + ':\t' + time;
    },
    function (name) { return 'running ' + name; },
    function (name) { progressBar.remove(); self.result = result; });
    debugger;
    signal(this, 'result', self.result);
  }

  connectAndRun (target, targetProp, options) {
    let source = { x: null };
    let sourceProp = 'x';
    connect(source, sourceProp, target, targetProp, options);

    let now = new Date();
    for (let i = 0; i < this.connectCount; i++) source.x = i;
    return new Date() - now;
  }

  runSimpleConnect () { return this.connectAndRun({ y: null }, 'y'); }
  runMethodConnect () { return this.connectAndRun({ m: function (v) { this.x = v; } }, 'm'); }

  runConverterConnectAttribute () {
    return this.connectAndRun({ m: function (v) { this.x = v; } }, 'm',
      { converter: function (v) { return v + 1; } });
  }

  runConverterConnectMethod () {
    return this.connectAndRun({ y: null }, 'y',
      { converter: function (v) { return v + 1; } });
  }

  runUpdaterConnectAttribute () {
    return this.connectAndRun({ y: null }, 'y',
      { updater: function (upd, newV, oldV) { upd.call(this, newV, oldV); } });
  }

  runUpdaterConnectMethod () {
    return this.connectAndRun({ m: function (v1, v2) { this.x = v1++; } }, 'm',
      { updater: function (upd, newV, oldV) { upd.call(this, newV + oldV, oldV); } });
  }

  runTextMorphConnect () {
    let source = new Text({ bounds: new Rectangle(0, 0, 100, 100), textString: '' });
    let sourceProp = 'textString';
    let target = new Text({ bounds: new Rectangle(0, 0, 100, 100), textString: '' });
    let targetProp = 'setTextString';
    connect(source, sourceProp, target, targetProp);

    let now = new Date();
    for (let i = 0; i < (this.connectCount / 10); i++) source.textString = i.toString();
    return new Date() - now;
  }

  runCreateConnection () {
    let now = new Date();
    let source = { x: null }; let target = { y: null };
    for (let i = 0; i < this.connectCount; i++) { connect(source, 'x', target, 'y'); }
    return new Date() - now;
  }

  runSimpleMethodCall () {
    let now = new Date();
    var source = { m: function (v) { source.x = v; target.m(v); } }; var target = { m: function (v) { target.x = v; } };
    for (let i = 0; i < this.connectCount * 10; i++) { source.m(i); }
    return new Date() - now;
  }
}
