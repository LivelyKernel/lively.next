/* global $world */
import { Morph, Text, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { SystemButton } from 'lively.components/buttons.cp.js';
import { run } from 'lively.context/lib/stackReification.js';
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
    name: 'debugger live counter', extent: pt(400, 170),
    fill: Color.white, borderRadius: 8,
    submorphs: [
      new Text({ name: 'title', textString: 'Build this counter while it is running',
        position: pt(15, 12), extent: pt(370, 30), fontSize: 17, readOnly: true }),
      new Text({ name: 'count', textString: '0', position: pt(15, 48),
        extent: pt(370, 45), fontSize: 30, readOnly: true })
    ]
  });
  for (const [index, [label, method]] of [['Increment', 'debugIncrement'], ['Reset', 'reset'], ['Edit source', 'editSource']].entries()) {
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
