/* global $world */
import { runWithCapturedBindings } from 'lively.context/lib/stackReification.js';
import { openForContinuation } from '../ui.cp.js';

export function makeRuntimeCharge (rate) {
  const ledger = {total: 0, visits: 0};
  function charge (quantity) {
    ledger.visits++;
    let amount = rate + quantity;
    debugger;
    ledger.total += amount;
    return ledger.total;
  }
  return {charge, ledger, readRate: () => rate};
}

export class RuntimeClosureLesson {
  constructor () { this.account = makeRuntimeCharge('2'); }

  checkout (quantity) {
    debugger;
    const total = this.account.charge(quantity);
    return total + 1;
  }
}

export async function openRuntimeClosure (world = $world) {
  const lesson = new RuntimeClosureLesson();
  const stopped = await runWithCapturedBindings(lesson.checkout, null, [3], {this: lesson});
  return openForContinuation(stopped, world);
}
