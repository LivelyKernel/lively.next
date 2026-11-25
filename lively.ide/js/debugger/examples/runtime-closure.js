/* global $world */
import { debugMethod } from './live-counter.js';

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

export function openRuntimeClosure (world = $world) {
  return debugMethod(new RuntimeClosureLesson(), 'checkout', [3], world);
}
