import { connect } from "lively.bindings";
import { Rectangle } from "lively.graphics";
import { fun, properties, obj, arr } from "lively.lang";
import { Text } from "lively.morphic";

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

  constructor(args) {
    this.connectCount = 20000;
  }

  startAndShow() {
    connect(this, 'result', lively.morphic.World.current(), 'addTextWindow');
    this.start()
  }
  
  async start() {
    var runPrefix = 'run';
    var self = this;
    var methods = properties.all(
      obj.getOwnPropertyDescriptors(this.constructor.prototype),
      (name) => { 
        return name.startsWith(runPrefix)
      });
    var result = 'Bindings profiling ' + new Date() + '\n' + navigator.userAgent;
    var progressBar = await $world.addProgressBar();
    arr.forEachShowingProgress(methods, progressBar, function(name) {
      var time = self[name]();
      name = name.substring(runPrefix.length, name.length);
      result += '\n' + name + ':\t' + time;
    },
    function(name) { return 'running ' + name },
    function(name) { progressBar.remove(); self.result = result });
    return this
  }

  connectAndRun(target, targetProp, options) {
    var source = {x: null};
    var sourceProp = 'x';
    connect(source, sourceProp, target, targetProp, options);

    var now = new Date();
    for (var i = 0; i < this.connectCount; i++) source.x = i
    return new Date() - now;
  }

  runSimpleConnect() { return this.connectAndRun({y: null}, 'y') }
  runMethodConnect() { return this.connectAndRun({m: function(v) { this.x = v }}, 'm') }

  runConverterConnectAttribute() {
    return this.connectAndRun({m: function(v) { this.x = v }}, 'm',
      {converter: function(v) { return v + 1 }});
  }

  runConverterConnectMethod() {
    return this.connectAndRun({y: null}, 'y',
      {converter: function(v) { return v + 1 }});
  }

  runUpdaterConnectAttribute() {
    return this.connectAndRun({y: null}, 'y',
      {updater: function(upd, newV, oldV) { upd.call(this, newV, oldV) }});
  }

  runUpdaterConnectMethod() {
    return this.connectAndRun({m: function(v1, v2) { this.x = v1++ }}, 'm',
      {updater: function(upd, newV, oldV) { upd.call(this, newV + oldV, oldV) }});
  }

  runTextMorphConnect() {
    var source = new Text({ bounds: new Rectangle(0,0, 100, 100), textString: ''});
    var sourceProp = 'textString';
    var target = new Text({ bounds: new Rectangle(0,0, 100, 100), textString: ''});
    var targetProp = 'setTextString'
    connect(source, sourceProp, target, targetProp);

    var now = new Date();
    for (var i = 0; i < (this.connectCount / 10); i++) source.textString = i.toString()
    return new Date() - now;
  }

  runCreateConnection() {
    var now = new Date()
    var source = {x: null}, target = {y: null};
    for (var i = 0; i < this.connectCount; i++)
      connect(source, 'x', target, 'y');
    return new Date() - now
  }
  runSimpleMethodCall() {
    var now = new Date()
    var source = {m: function(v) { source.x = v; target.m(v) }}, target = {m: function(v) { target.x = v }};
    for (var i = 0; i < this.connectCount*10; i++)
      source.m(i);
    return new Date() - now
  }

}