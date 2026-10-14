/* global $world */
import { Morph, Text, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { SystemButton } from 'lively.components/buttons.cp.js';
import { run, runWithCapturedBindings } from 'lively.context/lib/stackReification.js';
import { openForContinuation } from 'lively.ide/js/debugger/ui.cp.js';

export class LiveCounter extends Morph {
  static get properties () {
    return {
      count: { defaultValue: 0 },
      // Deliberate tutorial bug: discover and fix string concatenation live.
      step: { defaultValue: '1' },
      pause: { defaultValue: true }
    };
  }

  increment () {
    var amount = this.step;
    if (this.pause) debugger;
    this.count += amount;
    this.updateCount();
    return this.count;
  }

  debugIncrement () {
    const result = run(this.increment, null, [], { this: this });
    if (result.isContinuation) return openForContinuation(result, this.world());
    return result.returnValue;
  }

  scopeLesson () {
    let amount = 1;
    const receiver = this;
    const self = () => this;
    let read;
    {
      let amount = 2;
      read = function () { return amount; };
      debugger;
      this.count = read();
    }
    this.updateCount();
    return {outer: amount, inner: read(), receiver, self: self()};
  }

  loopLesson () {
    const reads = [];
    for (let i = 0; i < 3; i++) {
      reads.push(function () { return i; });
      if (i === 1) debugger;
    }
    this.count = reads.reduce(function (sum, read) { return sum + read(); }, 0);
    this.updateCount();
    return reads.map(function (read) { return read(); });
  }

  double (value) {
    let doubled = value * 2;
    return doubled;
  }

  nestedLesson () {
    debugger;
    let amount = this.double(2);
    this.count += amount;
    this.updateCount();
    return this.count;
  }

  missingMethodLesson () {
    this.lessonVisits = (this.lessonVisits || 0) + 1;
    let amount = this.convertStep(this.step);
    this.count += amount;
    this.updateCount();
    return this.count;
  }

  async awaitLesson () {
    let amount = await this.fetchStep();
    debugger;
    this.count += amount;
    this.updateCount();
    return this.count;
  }

  fetchStep () {
    return new Promise(resolve => setTimeout(() => resolve(Number(this.step)), 250));
  }

  exceptionLesson () {
    try {
      debugger;
      if (this.rejectLesson) throw new Error('Try repairing rejectLesson');
    } catch (error) {
      debugger;
      this.lastLessonError = error.message;
    } finally {
      this.lessonCleanups = (this.lessonCleanups || 0) + 1;
    }
    return this.lessonCleanups;
  }

  async chooseLesson () {
    const result = await this.world().listPrompt('Debugger lesson', [
      'scopeLesson', 'loopLesson', 'nestedLesson', 'missingMethodLesson', 'awaitLesson', 'exceptionLesson'
    ], {requester: this});
    if (result.status !== 'accepted') return;
    return this.debugLesson(result.selected[0]);
  }

  async debugLesson (name) {
    const result = await runWithCapturedBindings(this[name], null, [], {this: this});
    if (result.isContinuation) return openForContinuation(result, this.world());
    this.world().setStatusMessage('Lesson result: ' + String(result.returnValue));
    return result.returnValue;
  }

  updateCount () {
    this.get('count').textString = String(this.count);
  }

  reset () {
    this.count = 0;
    this.updateCount();
  }

  editSource () {
    return this.world().execCommand('open object editor', {
      target: this, methodName: 'increment'
    });
  }
}

export function openLiveCounter (world = $world) {
  const existing = world.get('debugger live counter');
  if (existing) return existing;
  const counter = new LiveCounter({
    name: 'debugger live counter', extent: pt(520, 170),
    fill: Color.white, borderRadius: 8,
    submorphs: [
      new Text({ name: 'title', textString: 'Build this counter while it is running',
        position: pt(15, 12), extent: pt(490, 30), fontSize: 17, readOnly: true }),
      new Text({ name: 'count', textString: '0', position: pt(15, 48),
        extent: pt(370, 45), fontSize: 30, readOnly: true })
    ]
  });
  for (const [index, [label, method]] of [['Increment', 'debugIncrement'], ['Reset', 'reset'], ['Edit source', 'editSource'], ['Lessons', 'chooseLesson']].entries()) {
    const button = part(SystemButton, {
      name: label, position: pt(15 + index * 125, 115), extent: pt(115, 30),
      submorphs: [{ name: 'label', textString: label }]
    });
    counter.addMorph(button);
    connect(button, 'fire', counter, method);
  }
  counter.openInWindow({ title: 'Debugger tutorial: live counter' });
  return counter;
}
