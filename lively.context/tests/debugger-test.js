/* global describe, it */
import { expect } from 'mocha-es6';
import { Path } from 'lively.lang';
import { walk } from 'lively.ast';
import { serialize, deserialize } from 'lively.serializer2';
import { run, enableDebugSupport, disableDebugSupport, debugReplacements } from '../lib/stackReification.js';

/** A function from its source; a statement list (ending with `;`) becomes the body of `function task()`. */
const fn = source => globalThis.Function('return (' + (source.endsWith(';') ? `function task() { ${source} }` : source) + ')')();
const restore = value => deserialize(JSON.parse(JSON.stringify(serialize(value))));
const forOfLoop = ast => { let loop; walk.simple(ast, {ForOfStatement: node => { loop = loop || node; }}); return loop; };
/** A step that saves edited source as the receiver method `name` (default: the function name). */
const save = (source, name) => (c, env) => {
  env.this[name || fn(source).name] = Object.assign(fn(source), name ? {displayName: name} : {});
};

function check (c, expected, env) {
  for (const [key, value] of Object.entries(expected)) {
    const frame = c.currentFrame;
    if (key === 'is') expect(c).deep.equals(value);
    else if (key === 'frames') expect(c.frames()).length(value);
    else if (key === 'pc') expect(typeof value === 'number' ? frame.getPC().loc.start.line : frame.getPC().type).equals(value);
    else if (key === 'lookup') for (const name in value) expect(frame.lookup(name), name).deep.equals(value[name]);
    else if (key === 'this') expect(frame.getThis()).equals(env.this);
    else if (key === 'fn') expect(frame.func.name()).equals(value);
    else if (key === 'receiver' || key === 'env') {
      for (const name in value) expect((key === 'env' ? env : env.this)[name], name).deep.equals(value[name]);
    }
    else if (key === 'exception' && typeof value === 'function') expect(c.exception).instanceOf(value);
    else expect(c[key], key).deep.equals(value);
  }
}

/**
 * Starts `task` (a function or its source) with `run`, binding `env` (or `env()`) and passing `env.args`; a `null` receiver
 * property named like the function receives it. Each step acts on the current value `c`: 'name' or ['name', ...args] replaces
 * `c` with `c.name(...args)` (or the property), awaited with an 'await ' prefix, and actions require a continuation; 'await'
 * awaits `c`; 'restore' saves and loads `c` as JSON; a function `(c, env)` checks or edits; an object checks `is` (deep equal),
 * `frames`, `pc` (node type or line), `lookup`, `this` (frame receiver is `env.this`), `fn` (frame function name), properties of
 * `receiver` (`env.this`) and `env`, `exception` (class or value) or other properties of `c`.
 */
async function play (env, task, ...steps) {
  env = typeof env === 'function' ? env() : env;
  const {args = []} = env, func = typeof task === 'string' ? fn(task) : task, key = func.displayName || func.name;
  delete env.args;
  if (env.this?.[key] === null) env.this[key] = func;
  let c = run(func, null, args, env);
  for (const step of steps) {
    if (typeof step === 'function') step(c, env);
    else if (!Array.isArray(step) && typeof step === 'object') check(c, step, env);
    else {
      const [action, ...params] = [].concat(step), name = action.replace(/^await ?/, ''), method = typeof c[name] === 'function';
      if (method) expect(c.isContinuation, name).equals(true);
      const value = name === 'restore' ? restore(c) : !name ? c : method ? c[name](...params) : c[name];
      c = action.startsWith('await') ? await value : value;
    }
  }
}

const counter = () => ({this: {count: 0, step: '1', pause: true, updateCount () {}}});
const increment = 'function increment() { var amount = this.step; if (this.pause) debugger; this.count += Number(amount);' +
  ' this.updateCount(); return this.count; }';
const yieldTask = 'function* values() { debugger; yield 2; return 4; } const iterator = values(); const first = iterator.next();' +
  ' return first.value + iterator.next().value;';
const quantities = 'function* values() { for (const quantity of [2, 3]) { let amount = quantity; debugger; yield amount; } }';
const asyncQuantities = 'async ' + quantities.replace('debugger;', 'await Promise.resolve(); debugger;');
const doubled = source => save(source.replace('yield amount;', 'yield amount * 2;'));
const closable = () => ({closed: false, [Symbol.asyncIterator] () { return this; }, next: () => Promise.resolve({value: 2, done: false}),
  async return () { await Promise.resolve(); this.closed = true; return {done: true}; }});
const closing = () => ({source: {closes: 0, [Symbol.iterator] () {
  return {next: () => ({value: 1, done: false}), return: () => { this.closes++; return {}; }};
}}});
const factorClosure = Function('factor', 'return function compute() { factor += 1; debugger; return factor; }')(1);
const record = (name, module) => `const ${name} = ${module}.recordDebugClosure(() => value, {value: _debugCell}, 0, 1, __lvOriginalCode,` +
  ` "${name}");`;

const scenarios = [
  ['calls native function proxies without probing their private metadata', {callable: new Proxy(value => value + 1, {
    get (target, key, receiver) {
      if (['livelyDebuggingEnabled', 'isInterpretableFunction'].includes(key)) throw new Error('Private metadata rejected');
      return Reflect.get(target, key, receiver);
    }
  })}, 'debugger; return callable(3);', 'resume', {is: 4}],
  ['rewrites method closure bindings after removing native compiler annotations', {},
    'const _debugCell = {get value() { return value; }}; let value = 2; ' +
    record('read', '__lvVarRecorder.System.get("@lively-env").moduleEnv("example.js")') +
    record('current', '__lvVarRecorder.__currentLivelyModule') + ' debugger; value = 4; return read() + current();',
  {exception: undefined}, c => expect(c.currentFrame.lookup('read')() + c.currentFrame.lookup('current')()).equals(4), 'resume', {is: 8}],
  ['reports a missing callee without replacing the error with debugger internals', {this: {}}, 'debugger; return this.convert(2);',
    'resume', {isContinuation: true, exception: TypeError},
    c => { expect(c.exception.message).not.contains('toString'); c.currentFrame.getThis().convert = value => value * 3; },
    'resume', {is: 6}],
  ['resumes for of without replaying iterator advancement and retains each iteration binding', {log: []}, 'let reads = [];' +
    ' for (const value of [1, 2, 3]) { log.push(value); reads.push(() => value); if (value === 2) debugger; }' +
    ' return reads.map(read => read());',
  {isContinuation: true, exception: undefined, lookup: {value: 2}, env: {log: [1, 2]}}, 'resume', {is: [1, 2, 3], env: {log: [1, 2, 3]}}],
  ['closes an iterator on a caught exception thrown in its loop or by a callee', closing(),
    'try { for (const value of source) { throw new Error("stop"); } } catch (error) {} try { for (const value of source) {' +
    ' function fail() { throw new Error("stop"); } fail(); } } catch (error) {} return source.closes;', {returnValue: 2}],
  ['keeps an iterator open while suspended and closes it on break and on a caught exception', closing(), 'for (const value of source) {' +
    ' debugger; break; } try { for (const value of source) { debugger; throw new Error("stop"); } } catch (error) {} return source.closes;',
  {env: {source: {closes: 0}}}, 'resume', {env: {source: {closes: 1}}}, 'resume', {is: 2}],
  ['steps through object spread while retaining computed keys and copied values', () => {
    const env = {reads: 0, source: {get amount () { env.reads++; return 2; }}};
    return env;
  }, 'debugger; const result = {before: 1, ...source, ["after"]: 3}; return result;',
  'stepOver', 'resume', {is: {before: 1, amount: 2, after: 3}, env: {reads: 1}}],
  ['runs to an await statement without starting its operation', () => {
    const env = {calls: 0, later: () => { env.calls++; return Promise.resolve(3); }};
    return env;
  },
    'async function task() {\n debugger;\n let first = await later();\n let second = await later();\n return first + second;\n}',
    ['await runToLine', 4], {pc: 4, env: {calls: 1}}, 'await resume', {is: 6, env: {calls: 2}}],
  ['repairs an uncaught missing method and retries without repeating completed effects', {this: {visits: 0}},
    'this.visits++; return this.missing(2);', {exception: TypeError}, (c, env) => { env.this.missing = value => value * 3; },
    'resume', {is: 6, receiver: {visits: 1}}],
  ['keeps the active child when proceeding while inspecting a caller', {receiver: {visits: 0}},
    'function child() { receiver.visits++; debugger; return 3; } return child() + 2;', {frames: 2}, 'resume',
    {is: 5, env: {receiver: {visits: 1}}}],
  ['returns an override value from a child to its suspended caller', {}, 'function child() { debugger; throw new Error("skip"); }' +
    ' return child() + 2;', ['returnFrom', 7], 'resume', {is: 9}],
  ['preserves block shadowing and shared closure bindings after stepping', {}, 'let amount = 1; let read; { let amount = 2;' +
    ' read = function() { return amount; }; debugger; amount = 4; } return [amount, read()];', {lookup: {amount: 2}},
  c => { c.currentFrame.getScope().findScope('amount').scope.set('amount', 3); expect(c.currentFrame.lookup('read')()).equals(3); },
  'stepOver', 'resume', {is: [1, 4]}],
  ['enforces const writes while allowing object mutation', {}, 'const item = { count: 1 }; debugger; return item.count;', c => {
    const scope = c.currentFrame.getScope().findScope('item').scope;
    expect(() => scope.set('item', {})).to.throw(TypeError);
    scope.get('item').count = 5;
  }, 'resume', {is: 5}],
  ['initializes a lexical declaration after suspension and preserves the temporal dead zone', {},
    'debugger; let amount = 2; return amount;',
    c => expect(() => c.currentFrame.lookup('amount')).to.throw(ReferenceError), 'resume', {is: 2}],
  ['restarts a block frame using original arguments and its outer environment', {args: [3]},
    'function task(arg) { let outer = arg; { let inner = 2; debugger; } return outer; }', 'restartFrame', 'resume', {lookup: {inner: 2}},
    'resume', {is: 3}],
  ['steps out of a child and stops before executing its caller', {this: {count: 0}}, 'function child() { debugger; return 3; }' +
    ' let value = child(); this.count += value; return this.count;', 'stepOut', {receiver: {count: 0}}, 'resume', {is: 3}],
  ['steps into an ordinary receiver method and retains the caller result',
    {this: {child: fn('function child(value) { let doubled = value * 2; return doubled; }')}}, 'debugger; return this.child(3) + 1;',
    'stepOver', 'stepInto', {exception: undefined, frames: 2, this: true}, 'resume', {is: 7}],
  ['applies a reformatted edit with a new local to unexecuted code without replaying earlier side effects', {this: {count: 0, task: null}},
    'this.count++; let amount = 2; debugger; this.count += amount; return this.count;',
    save('function task() {\n this.count++;\n let amount = 2;\n debugger;\n let factor = 3;\n' +
      ' this.count += amount * factor;\n return this.count;\n}'),
    'applySavedMethod', 'resume', {is: 7, receiver: {count: 7}}],
  ['rejects changing executed code while preserving the original suspended frame', {this: {count: 0, task: null}},
    'this.count++; debugger; return this.count;', save('function task() { this.count += 2; debugger; return this.count; }'),
    c => expect(() => c.applySavedMethod()).to.throw(/Restart Frame/), 'resume', {is: 1}],
  ['runs to a source line without executing that line', {this: {count: 0}},
    'function task() {\n debugger;\n this.count++;\n this.count += 2;\n return this.count;\n}', ['runToLine', 4],
    {pc: 4, receiver: {count: 1}}, 'resume', {is: 3}],
  ['keeps per-iteration let bindings shared with the correct escaping closure', {}, 'let reads = []; for (let i = 0; i < 3; i++) {' +
    ' reads.push(function() { return i; }); if (i === 1) debugger; } return reads.map(function(read) { return read(); });',
  {lookup: {i: 1}}, 'resume', {is: [0, 1, 2]}],
  ['suspends before and after await while the surrounding timer keeps running', () => {
    const env = {ticks: 0, later: () => new Promise(resolve => setTimeout(() => { env.ticks++; resolve(3); }, 5))};
    return env;
  }, 'async function task() { debugger; let amount = await later(); debugger; return amount + 2; }',
  'await resume', {isContinuation: true, env: {ticks: 1}, lookup: {amount: 3}}, 'await resume', {is: 5}],
  ['opens a recoverable exception when an awaited promise rejects', () => {
    const failure = new Error('offline');
    return {failure, later: () => Promise.reject(failure)};
  }, 'async function task() { const value = await later(); return value; }',
  'await', (c, env) => expect(c.exception).equals(env.failure), ['returnFrom', 7], {is: 7}],
  ['keeps catch and finally dormant during await and debugger suspension',
    {this: {caught: 0, cleanups: 0}, later: () => Promise.resolve(3)}, 'async function task() { try { await later(); debugger; }' +
    ' catch (error) { this.caught++; } finally { this.cleanups++; } return this.cleanups; }',
    'await', {receiver: {caught: 0, cleanups: 0}}, 'await resume', {is: 1, receiver: {cleanups: 1}}],
  ['returns from the final child statement when stepping over it', {}, 'function child() { debugger; return 3; } return child() + 2;',
    'stepOver', 'stepOver', {frames: 1}, 'resume', {is: 5}],
  ['restarts a frame stopped in catch without retaining its old function locals', {args: [3]},
    'function task(value) { let local = value; try { throw new Error("test"); } catch(error) { debugger; } return local; }',
    'restartFrame', 'resume', {lookup: {local: 3}}, 'resume', {is: 3}],
  ['honors a nested rewritten debugger when proceeding from its caller', {},
    'function child() { debugger; return 3; } debugger; return child() + 2;', 'resume', {frames: 2}, 'resume', {is: 5}],
  ['honors a saved receiver method debugger while stepping over its call', {this: {child: fn('function child() { debugger; return 3; }')}},
    'debugger; return this.child() + 2;', 'stepOver', 'stepOver', {frames: 2}, 'resume', {is: 5}],
  ['keeps lexical self and arguments in an arrow block despite call rebinding', {this: {count: 4}, args: [3]}, 'function task(value) {' +
    ' const block = extra => { debugger; return this.count + arguments[0] + extra; }; return block.call({count: 99}, 2); }',
  {this: true}, c => expect(c.currentFrame.lookup('arguments')[0]).equals(3), 'resume', {is: 9}],
  ['steps into an expression arrow created after the original suspension', {this: {count: 4}},
    'debugger; const block = extra => this.count + extra; return block.call({count: 99}, 2);',
    'stepOver', 'stepOver', 'stepInto', {this: true}, 'resume', {is: 6}],
  ['uses the debug Array.some replacement with undefined values and sparse holes', {},
    'return [[undefined].some(function() { return true; }), Array(1).some(function() { throw new Error("hole"); })];',
    {returnValue: [true, false]}],
  ['runs an arrow entry point with explicitly supplied lexical receiver and arguments', {this: {count: 4}, arguments: [3], args: [2]},
    'value => { let local = value; debugger; return this.count + local + arguments[0]; }', {this: true}, 'resume', {is: 9}],
  ['applies saved source to an ordinary method reached through Step Into',
    {this: {visits: 0, child: fn('function child() { this.visits++; let amount = 2; debugger; return amount; }')}},
    'debugger; return this.child();', 'stepOver', 'stepInto', 'stepOver', 'stepOver',
    save('function child() {\n this.visits++;\n let amount = 2;\n debugger;\n return amount * 3;\n}'),
    'applySavedMethod', 'resume', {is: 6, receiver: {visits: 1}}],
  // Debugger actions on rewritten frames
  ['steps past a conditional debugger without completing the function', counter(), increment,
    'stepOver', {pc: 'ExpressionStatement', receiver: {count: 0}}, 'resume', {is: 1}],
  ['keeps the captured else branch when its condition changes while suspended', {this: {condition: false, count: 0}},
    'if (this.condition) this.count = 99; else { debugger; this.count += 1; } return this.count;',
    (c, env) => { env.this.condition = true; }, 'stepOver', {receiver: {count: 0}}, 'resume', {is: 1}],
  ['keeps a branch entered by the interpreter after restarting a frame', counter(), increment, 'restartFrame', 'resume',
    (c, env) => { env.this.pause = false; }, 'stepOver', {receiver: {count: 0}}, 'resume', {is: 1}],
  ['keeps evaluation errors during stepping in a recoverable continuation', {}, 'debugger; unavailableDebuggerBinding();',
    'stepOver', 'stepOver', {isContinuation: true, exception: ReferenceError}],
  ['restarts and resumes a rewritten frame without losing its pc or receiver', counter(), increment,
    'restartFrame', {pc: 'VariableDeclaration', this: true}, 'resume', 'resume', {is: 1}],
  ['restarts a method containing the let declaration produced by the Object Editor', {this: {step: '1', count: 0}, Number},
    'let amount = Number(this.step); debugger; this.count += amount; return this.count;',
    'restartFrame', {pc: 'VariableDeclaration'}, 'resume', 'resume', {is: 1}],
  ['restarts the saved replacement method on the same receiver with original arguments', {this: {count: 0, increment: null}, args: [2]},
    Object.assign(fn('function old_increment(delta) { let amount = delta; debugger; this.count += amount; return this.count; }'),
      {displayName: 'increment'}),
    save('function new_increment(delta) { let amount = delta * 3; debugger; this.count += amount; return this.count; }', 'increment'),
    'restartFrame', c => expect(c.currentFrame.func.getSource()).includes('delta * 3'), {this: true},
    'resume', {lookup: {amount: 6}}, 'resume', {is: 6, receiver: {count: 6}}],
  // Generators and async iteration
  ['resumes a debugger inside a generator into its caller without replaying effects', {effects: []}, 'function* values() {' +
    ' effects.push(1); debugger; yield 2; effects.push(3); return 4; } const iterator = values(); const first = iterator.next();' +
    ' return [first, iterator.next()];', {exception: undefined, fn: 'values'},
  'resume', {is: [{value: 2, done: false}, {value: 4, done: true}], env: {effects: [1, 3]}}],
  ['steps across a yield and out into the iterator caller', {}, yieldTask,
    'stepOver', {pc: 'ExpressionStatement'}, 'stepOut', {fn: 'task'}, 'resume', {is: 6}],
  ['steps over a yield into the iterator caller', {}, yieldTask, 'stepOver', 'stepOver', {fn: 'task'}, 'resume', {is: 6}],
  ['returns an override result to next', {}, 'function* values() { debugger; yield 2; } return values().next();',
    ['returnFrom', 7], 'resume', {is: {value: 7, done: true}}],
  ['resumes for await without replaying next and retains iteration closures', {source: {reads: 0, closes: 0,
    [Symbol.asyncIterator] () { return this; }, return () { this.closes++; return Promise.resolve({done: true}); },
    next () { this.reads++; return Promise.resolve(this.reads <= 3 ? {value: this.reads, done: false} : {done: true}); }}},
  'async function task() { const reads = []; for await (const value of source) { reads.push(() => value); if (value === 2) debugger; }' +
  ' return reads.map(read => read()); }', 'await', {exception: undefined},
  (c, {source}) => expect([source.reads, source.closes]).deep.equals([2, 0]),
  'await resume', {is: [1, 2, 3]}, (c, {source}) => expect([source.reads, source.closes]).deep.equals([4, 0])],
  ['awaits synchronous iterable values and catches a rejected async iterator result',
    {source: {[Symbol.asyncIterator] () { return this; }, next () { return Promise.reject(new Error('iteration failed')); }}},
    'async function task() { let total = 0; for await (const value of [Promise.resolve(1), Promise.resolve(2)]) total += value;' +
    ' try { for await (const value of source) {} } catch (error) { return [total, error.message]; } }',
    'await', {returnValue: [3, 'iteration failed']}],
  ['closes async iterators on break and before delivering a body error to catch', {source: closable(), other: closable()},
    'async function task() { for await (const value of source) { break; } const closed = source.closed; try {' +
    ' for await (const value of other) { throw new Error("stop"); } } catch (error) { return [closed, error.message, other.closed]; } }',
    'await', {returnValue: [true, 'stop', true]}],
  ['uses async generators with await and for await through debugger stops', {effects: []},
    'async function task() { async function* values() { effects.push(1); yield await Promise.resolve(2); debugger; yield 3; }' +
    ' let total = 0; for await (const value of values()) total += value; return total; }',
    'await', {exception: undefined, fn: 'values'}, 'await resume', {is: 5, env: {effects: [1]}}],
  ['restores a debugger inside a generator and resumes its caller', {}, yieldTask, 'restore', 'resume', {is: 6}],
  ['debugs a generator consumed by a synchronous for of loop', {}, 'function* values() { yield 1; debugger; yield 2; } let total = 0;' +
    ' for (const value of values()) total += value; return total;', {exception: undefined}, 'resume', {is: 3}],
  ['keeps iterator state when applying a future generator edit', {this: {values: fn(quantities)}},
    'let total = 0; for (const value of this.values()) total += value; return total;',
    doubled(quantities), 'applySavedMethod', 'resume', {lookup: {quantity: 3}}, 'resume', {is: 10}],
  ['awaits each yielded value after applying an async generator edit', {this: {values: fn(asyncQuantities)}},
    'async function task() { let total = 0; for await (const value of this.values()) total += value; return total; }', 'await',
    doubled(asyncQuantities), 'applySavedMethod', 'await resume', {lookup: {quantity: 3}}, 'await resume', {is: 10}],
  // Language constructs before and after a suspension
  ['captures default and destructured parameters and resumes destructured declarations', {args: [undefined, 4, 5]},
    'function compute({amount = 2} = {}, ...items) { const {value = amount, ...remaining} = {other: 3}; debugger;' +
    ' const [first, ...rest] = items; return value + remaining.other + first + rest[0]; }',
    {exception: undefined, lookup: {amount: 2, value: 2, items: [4, 5]}}, 'resume', {is: 14}],
  ['binds destructured defaults when the interpreter calls a function after suspension',
    {compute: fn('function compute({amount = 2} = {}, ...items) { return amount + items[0]; }')},
    'debugger; return compute(undefined, 4);', 'resume', {is: 6}],
  ['evaluates parameter defaults once during capture', {marker: {visits: 0}},
    'function compute(amount = ++marker.visits) { debugger; return amount; }', {env: {marker: {visits: 1}}},
    'resume', {is: 1, env: {marker: {visits: 1}}}],
  ['preserves the parameter TDZ in interpreted calls', {invalid: fn('function invalid(first = second, second = 2) { return first; }')},
    'debugger; return invalid();', 'resume', {exception: ReferenceError}],
  ['retains destructured bindings in ordinary and iterator loop scopes', {}, 'let total = 0; debugger;' +
    ' for (let [value] = [1]; value < 3; value++) total += value; for (const {value} of [{value: 3}]) { debugger; total += value; }' +
    ' return total;', 'resume', {lookup: {value: 3}}, 'resume', {is: 6}],
  ['retains per-iteration lexical for-in bindings through suspension and closure capture', {}, 'const readers = [];' +
    ' for (const key in {first: 1, second: 2}) { readers.push(() => key); debugger; } return readers.map(read => read()).join(",");',
  {exception: undefined, lookup: {key: 'first'}}, 'resume', {exception: undefined, lookup: {key: 'second'}},
  'resume', {is: 'first,second'}],
  ['preserves template literals before and after suspension', {},
    'const before = `before ${2 + 1}`; debugger; return `${before}: after ${4}`;',
    {lookup: {before: 'before 3'}}, 'resume', {is: 'before 3: after 4'}],
  ['constructs only the callees of new expressions, also when they nest, after suspension',
    {Outer: fn('function Outer(value) { this.value = value; }'), Inner: fn('function Inner() {}')},
    'debugger; const nested = new Outer(new Inner()), converted = new Outer(String(1));' +
    ' return [nested instanceof Outer, nested.value instanceof Inner, converted instanceof Outer, typeof converted.value];',
    'resume', {is: [true, true, true, 'string']}],
  ['constructs native classes with new.target and keeps an object returned by a constructor after suspension',
    {Point: fn('class Point { constructor(x) { this.x = x; this.target = new.target; } }'),
      Target: fn('function Target() { this.target = new.target; }'), Make: fn('function Make() { this.ignored = true; return {made: true}; }')},
    'debugger; const point = new Point(2); return [point.x, point.target === Point, new Target().target === Target, new Make()];',
    'resume', {is: [2, true, true, {made: true}]}],
  ['steps into the construction of a native class by running its constructor natively',
    {Point: fn('class Point { constructor(x) { this.x = x; } }')}, 'debugger; const point = new Point(2); return point.x;',
    'stepInto', 'stepInto', {exception: undefined}, 'resume', {is: 2}],
  ['preserves spread calls and constructors before and after suspension', {}, 'const values = []; values.push(...[1, 2]); debugger;' +
    ' const set = new Set([...values, ...[3]]); return Math.max(...set) + values.length;',
  {exception: undefined, lookup: {values: [1, 2]}}, 'resume', {is: 5}],
  ['retains expanded one-shot arguments when a callee suspends', {items: new Set([2, 3]).values()},
    'function add(first, second) { debugger; return first + second; } return add(...items);',
    {exception: undefined}, 'resume', {is: 5}, (c, {items}) => expect(items.next().done).equals(true)],
  ['short circuits optional chains, preserves receivers and resumes calls inside chains', {effects: {visits: 0}},
    'function pause() { effects.visits++; debugger; return {amount: 4}; } const receiver = {amount: 2, read() { return this.amount; }};' +
    ' const before = receiver?.read?.() ?? 0; const absent = null?.[effects.visits++]?.(++effects.visits) ?? 3;' +
    ' const amount = ({pause})?.pause()?.amount; debugger; return before + absent + amount + (null?.missing.x ?? 0);',
  {exception: undefined, env: {effects: {visits: 1}}}, 'resume', {exception: undefined, isContinuation: true, lookup: {amount: 4}},
  'resume', {is: 9, env: {effects: {visits: 1}}}],
  ['retains supplied closure bindings and receiver through suspend and resume', {this: {step: '1'}, marker: {count: 0}, factor: 2},
    'var amount = this.step; debugger; marker.count += amount * factor; return marker.count;', {this: true, lookup: {factor: 2}},
    (c, env) => { expect(c.currentFrame.lookup('marker')).equals(env.marker); c.currentFrame.getScope().set('amount', 1); },
    'resume', {is: 2, env: {marker: {count: 2}}}],
  ['records changes to supplied primitive bindings before suspension', {factor: 1}, factorClosure,
    {lookup: {factor: 2}}, 'resume', {is: 2, env: {factor: 2}}, () => expect(factorClosure()).equals(2)],
  // Saved continuations
  ['restores an array iteration without repeating reads or completed iterations', {this: {log: []}},
    'for (let value of [1, 2, 3]) { this.log.push(value); if (value === 2) debugger; } return this.log;',
    'restore', 'resume', {is: [1, 2, 3]}],
  ['restores both frames and a pending caller result without repeating the child', {},
    'let value = 2; function child() { value++; debugger; return value; } return child() + 1;', 'restore', {frames: 2}, 'resume', {is: 4}]
];

/** Generators start through `run`; a request [method, argument, value, done] expects that result (awaited for async generators),
 *  [method, argument, Error] a throw with its message; an object checks bindings; 'restore' saves and loads the generator. */
const generators = [
  ['creates generators lazily and sends values back into yield', {effects: []},
    'function* values() { effects.push("start"); const sent = yield 2; return sent + 3; }', {effects: []},
    ['next', 99, 2, false], ['next', 4, 7, true], ['next', undefined, undefined, true], {effects: ['start']}],
  ['handles throw and return, including yielding during finally', {},
    'function* values() { try { yield 1; } catch (error) { yield error.message; } finally { yield "cleanup"; } return 9; }',
    ['next', undefined, 1, false], ['throw', new Error('repair'), 'repair', false], ['return', 7, 'cleanup', false],
    ['next', undefined, 7, true], ['throw', new Error('closed'), new Error('closed')]],
  ['delegates yield star and preserves its completion value', {},
    'function* values() { function* child() { const value = yield 2; return value + 1; } return yield* child(); }',
    ['next', undefined, 2, false], ['next', 4, 5, true]],
  ['retains intermediate expression values and loop bindings across yields', {effects: []},
    'function* values() { for (let i = 0; i < 2; i++) { const value = effects.push(i) + (yield i); yield value; } }',
    ['next', undefined, 0, false], ['next', 10, 11, false], ['next', undefined, 1, false], ['next', 10, 12, false],
    ['next', undefined, undefined, true], {effects: [0, 1]}],
  ['queues async generator requests and awaits yielded values', {},
    'async function* values() { yield Promise.resolve(2); yield await Promise.resolve(3); return 4; }',
    async iterator => expect(await Promise.all([iterator.next(), iterator.next(), iterator.next()]))
      .deep.equals([{value: 2, done: false}, {value: 3, done: false}, {value: 4, done: true}])],
  ['forwards delegated throw and return operations to the child generator', {}, 'function* values() { function* child() {' +
    ' try { yield 1; } catch (error) { yield error.message; } finally { yield 3; } } return yield* child(); }',
  ['next', undefined, 1, false], ['throw', new Error('caught'), 'caught', false], ['return', 7, 3, false], ['next', undefined, 7, true]],
  ['closes on uncaught errors', {}, 'function* values() { yield 1; throw new Error("closed"); }', ['next', undefined, 1, false],
    ['next', undefined, new Error('closed')], ['next', undefined, undefined, true]],
  ['returns from delegates without a return method', {}, 'function* values() { yield* [1, 2]; }', ['next', undefined, 1, false],
    ['return', 7, 7, true]],
  ['awaits delegated async yields and catches rejected yielded promises', {}, 'async function* values() {' +
    ' try { yield Promise.reject(new Error("failed")); } catch (error) { yield error.message; } return yield* [Promise.resolve(2), 3]; }',
  ['next', undefined, 'failed', false], ['next', undefined, 2, false], ['next', undefined, 3, false], ['next', undefined, undefined, true]],
  ['restores a yielded generator and resumes its retained frame', {},
    'function* values() { let value = 2; yield value; value += 3; return value; }',
    ['next', undefined, 2, false], 'restore', ['next', undefined, 5, true]],
  ['restores a pending return after a yield in finally', {}, 'function* values() { try { yield 1; } finally { yield 2; } }',
    ['next', undefined, 1, false], ['return', 7, 2, false], 'restore', ['next', undefined, 7, true]]
];

describe('suspended computations', function () {
  for (const [title, ...scenario] of scenarios) it(title, () => play(...scenario));

  for (const [title, env, source, ...requests] of generators) {
    it(title, async () => {
      let iterator = run(fn(source), null, [], env).returnValue;
      for (const request of requests) {
        if (request === 'restore') iterator = restore(iterator);
        else if (typeof request === 'function') await request(iterator);
        else if (!Array.isArray(request)) for (const name in request) expect(env[name]).deep.equals(request[name]);
        else if (request[2] instanceof Error) expect(() => iterator[request[0]](request[1])).to.throw(request[2].message);
        else {
          const result = iterator[request[0]](request[1]);
          expect(source.startsWith('async') ? await result : result).deep.equals({value: request[2], done: request[3]});
        }
      }
    });
  }

  it('enables debug support without the Path global and without calling its interceptable accessors', () => {
    const {get, set} = Path.prototype, lang = globalThis.lively.lang, path = lang.Path, forEach = Array.prototype.forEach;
    Path.prototype.get = Path.prototype.set = () => { throw new Error('Debugger bookkeeping must not call intercepted helpers'); };
    try {
      enableDebugSupport();
      expect(Array.prototype.forEach).not.equals(forEach);
      disableDebugSupport();
      expect(Array.prototype.forEach).equals(forEach);
      delete lang.Path;
      enableDebugSupport();
      expect(typeof lang.Path).equals('function', 'Enabling the debugger supplies the Path global');
    } finally { disableDebugSupport(); Object.assign(Path.prototype, {get, set}); lang.Path = path; }
  });

  it('reuses array helpers and restores prototype methods installed between captures', () => {
    const original = Array.prototype.forEach, installed = function (callback) { return original.call(this, callback); };
    const capture = () => { enableDebugSupport(); const rewritten = Array.prototype.forEach; disableDebugSupport(); return rewritten; };
    const rewritten = capture();
    try {
      Array.prototype.forEach = installed;
      expect([capture(), Array.prototype.forEach]).ordered.members([rewritten, installed]);
    } finally { disableDebugSupport(); Array.prototype.forEach = original; }
  });

  it('compiles an Array replacement that reaches its helpers through the recorder name of a bundle chunk', () => {
    const spec = debugReplacements.Array.forEach, source = spec.dbg;
    // A freezer bundle names the recorder __varRecorder__, with a $1 suffix for the second module of a chunk.
    spec.dbg = fn(String(source).replaceAll('__lvVarRecorder.', '__varRecorder__$1.'));
    expect(String(spec.dbg)).contains('__varRecorder__$1.arrayObject(this)');
    delete spec.astRegistry;
    enableDebugSupport();
    try {
      const values = [];
      [1, 2].forEach(value => values.push(value));
      expect([values, Array.prototype.forEach]).deep.equals([[1, 2], spec.rewritten]);
    } finally { disableDebugSupport(); spec.dbg = source; delete spec.astRegistry; }
  });

  it('remaps for-of iterator keys and continues with the third element after a saved edit', () => {
    const source = 'function* values() { for (const item of [1, 2, 3]) { debugger; yield item; } }', receiver = {values: fn(source)};
    const task = fn('let total = 0; for (const value of this.values()) total += value; return total;');
    const stopped = run(task, null, [], {this: receiver}).resume();
    expect(stopped.currentFrame.lookup('item')).equals(2, 'Stop in the second iteration');
    const frame = stopped.currentFrame, oldLoop = forOfLoop(frame.getOriginalAst()), prefixes = ['__yieldValue_', '__delegate_'];
    const iterator = frame.alreadyComputed['__forOf_' + oldLoop.astIndex];
    expect(!!iterator).equals(true, 'Retain the iterator before the edit');
    // A future nested function shifts traversal indices without changing any executed statement.
    receiver.values = fn(source.replace('yield item;', 'yield item; function future() { return 99; }'));
    for (const prefix of prefixes) frame.alreadyComputed[prefix + oldLoop.astIndex] = {prefix};
    const updated = stopped.applySavedMethod(), newFrame = updated.currentFrame, newLoop = forOfLoop(newFrame.getOriginalAst());
    expect(newLoop.astIndex).not.equals(oldLoop.astIndex, 'The edit shifts the loop astIndex');
    expect(newFrame.alreadyComputed['__forOf_' + newLoop.astIndex]).equals(iterator, 'Iterator state follows the new loop index');
    for (const prefix of prefixes) {
      expect(newFrame.alreadyComputed[prefix + newLoop.astIndex]?.prefix).equals(prefix, `${prefix} state follows the new index`);
      delete newFrame.alreadyComputed[prefix + newLoop.astIndex];
    }
    const third = updated.resume();
    expect(third.currentFrame.lookup('item')).equals(3, 'next() continues with the third element');
    expect(third.resume()).equals(6, 'No iteration restarts or repeats');
  });

  it('restores an async generator after a settled await without saving native promises in any frame cache', async () => {
    const stopped = await run(fn('async function task() { async function* values() { for (const quantity of [2, 3]) {' +
      ' await Promise.resolve(); debugger; yield quantity * 2; } } let total = 0; for await (const value of values()) total += value;' +
      ' return total; }'));
    expect(stopped.frames().length).at.least(2, 'Exercise the settled generator and its caller');
    for (const frame of stopped.frames()) {
      const fields = {};
      frame.__additionally_serialize__({}, null, null, (key, value) => { fields[key] = value; });
      expect(Object.values(fields.alreadyComputed).some(value => typeof value?.then === 'function')).equals(false, frame.func.name());
    }
    const second = await restore(stopped).resume();
    expect(second.exception).equals(undefined, 'Deserialization errors fail this case');
    expect(second.currentFrame.lookup('quantity')).equals(3);
    expect(await second.resume()).equals(10);
  });
});
