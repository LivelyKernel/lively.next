/* global $world */
import { runWithCapturedBindings } from 'lively.context/lib/stackReification.js';
import { openForContinuation } from '../ui.cp.js';

export class GeneratorLesson {
  constructor () {
    this.rate = '2';
    this.quantities = [2, 3];
    this.visits = 0;
    this.cleanups = 0;
  }

  async *lineTotals () {
    try {
      for (const quantity of this.quantities) {
        this.visits++;
        let amount = this.rate + quantity;
        await Promise.resolve();
        debugger;
        yield amount;
      }
    } finally { this.cleanups++; }
  }

  async checkout () {
    let total = 0;
    for await (const amount of this.lineTotals()) total += amount;
    return total;
  }
}

export async function openGeneratorWorkflow (world = $world) {
  const lesson = new GeneratorLesson();
  const stopped = await runWithCapturedBindings(lesson.checkout, null, [], {this: lesson});
  return openForContinuation(stopped, world);
}
