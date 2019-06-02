"format esm";


// Object.subclass('tests.BindingTests.BindingsProfiler', {
// 
//   connectCount: 20000,
// 
//   startAndShow: function() {
//     connect(this, 'result', lively.morphic.World.current(), 'addTextWindow');
//     this.start()
//   },
// 
//   start: function() {
//     var runPrefix = 'run';
//     var self = this;
//     var methods = Functions.all(this).select(function(name) { return name.startsWith(runPrefix) });
//     var result = 'Bindings profiling ' + new Date() + '\n' + navigator.userAgent;
//     var progressBar = lively.morphic.World.current().addProgressBar();
//     methods.forEachShowingProgress(progressBar, function(name) {
//       var time = self[name]();
//       name = name.substring(runPrefix.length, name.length);
//       result += '\n' + name + ':\t' + time;
//     },
//     function(name) { return 'running ' + name },
//     function(name) { progressBar.remove(); self.result = result });
//     return this
//   },
// 
//   connectAndRun: function(target, targetProp, options) {
//     var source = {x: null};
//     var sourceProp = 'x';
//     connect(source, sourceProp, target, targetProp, options);
// 
//     var now = new Date();
//     for (var i = 0; i < this.connectCount; i++) source.x = i
//     return new Date() - now;
//   },
// 
//   runSimpleConnect: function() { return this.connectAndRun({y: null}, 'y') },
//   runMethodConnect: function() { return this.connectAndRun({m: function(v) { this.x = v }}, 'm') },
// 
//   runConverterConnectAttribute: function() {
//     return this.connectAndRun({m: function(v) { this.x = v }}, 'm',
//       {converter: function(v) { return v + 1 }});
//   },
// 
//   runConverterConnectMethod: function() {
//     return this.connectAndRun({y: null}, 'y',
//       {converter: function(v) { return v + 1 }});
//   },
// 
//   runUpdaterConnectAttribute: function() {
//     return this.connectAndRun({y: null}, 'y',
//       {updater: function(upd, newV, oldV) { upd.call(this, newV, oldV) }});
//   },
// 
//   runUpdaterConnectMethod: function() {
//     return this.connectAndRun({m: function(v1, v2) { this.x = v1++ }}, 'm',
//       {updater: function(upd, newV, oldV) { upd.call(this, newV + oldV, oldV) }});
//   },
// 
//   runTextMorphConnect: function() {
//     var source = new lively.morphic.Text(new Rectangle(0,0, 100, 100), '');
//     var sourceProp = 'textString';
//     var target = new lively.morphic.Text(new Rectangle(0,0, 100, 100), '');
//     var targetProp = 'setTextString'
//     connect(source, sourceProp, target, targetProp);
// 
//     var now = new Date();
//     for (var i = 0; i < (this.connectCount / 10); i++) source.textString = i.toString()
//     return new Date() - now;
//   },
// 
//   runCreateConnection: function() {
//     var now = new Date()
//     var source = {x: null}, target = {y: null};
//     for (var i = 0; i < this.connectCount; i++)
//       connect(source, 'x', target, 'y');
//     return new Date() - now
//   },
//   runSimpleMethodCall: function() {
//     var now = new Date()
//     var source = {m: function(v) { source.x = v; target.m(v) }}, target = {m: function(v) { target.x = v }};
//     for (var i = 0; i < this.connectCount*10; i++)
//       source.m(i);
//     return new Date() - now
//   },
// 
// });
