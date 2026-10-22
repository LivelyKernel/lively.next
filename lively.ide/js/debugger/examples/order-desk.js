/* global $world */
import { Morph, Text, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { connect } from 'lively.bindings';
import { SystemButton } from 'lively.components/buttons.cp.js';
import { runWithCapturedBindings } from 'lively.context/lib/stackReification.js';
import { openForContinuation } from 'lively.ide/js/debugger/ui.cp.js';

// Implemented live in the debugger: validated checkout, async quote, atomic stock commit and undo.
export class OrderDesk extends Morph {
  async checkout () {
    this.attempts++;
    this.status = 'Checking cart...';
    this.updateView();
    debugger;
    let subtotal = 0;
    for (const line of this.cart) {
      subtotal += this.priceLine(line);
    }
    const discount = this.discountFor(subtotal);
    const shipping = await this.quoteDelivery();
    const receipt = this.makeReceipt(subtotal, discount, shipping);
    debugger;
    this.commitOrder(receipt);
    this.lastTotal = receipt.total;
    this.updateView();
    return receipt;
  }

  priceLine (line) {
    if (!Object.prototype.hasOwnProperty.call(this.stock, line.sku)) {
      throw new Error('Unknown product ' + line.sku);
    }
    if (!Number.isSafeInteger(line.unit) || line.unit < 0) {
      throw new Error('Invalid price for ' + line.sku);
    }
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Invalid quantity for ' + line.sku);
    if (quantity > this.stock[line.sku]) throw new Error('Insufficient stock for ' + line.sku);
    return quantity * line.unit;
  }

  tick () {
    this.ticks = (this.ticks || 0) + 1;
    this.get('heartbeat').textString = 'World timer: ' + this.ticks;
  }

  discountFor (subtotal) {
    return this.coupon === 'vip' ? Math.round(subtotal * 0.1) : 0;
  }

  makeReceipt (subtotal, discount, shipping) {
    const tax = Math.round((subtotal - discount) * 0.2);
    const total = subtotal - discount + tax + shipping;
    const lines = this.cart.map(line => ({ sku: line.sku, quantity: Number(line.quantity) }));
    return { subtotal, discount, tax, shipping, total, lines };
  }

  commitOrder (receipt) {
    const next = {...this.stock};
    for (const line of receipt.lines) {
      next[line.sku] -= line.quantity;
      if (next[line.sku] < 0) throw new Error('Insufficient stock for ' + line.sku);
    }
    this.stock = next;
    this.receipts.push(receipt);
    this.status = 'Order committed';
  }

  restoreOrder (receipt) {
    if (!receipt) throw new Error('No order to undo');
    for (const line of receipt.lines) {
      this.stock[line.sku] += line.quantity;
    }
    this.receipts.pop();
    this.status = 'Order undone';
  }

  async quoteDelivery () {
    this.quoteCalls++;
    this.status = 'Waiting for delivery quote...';
    this.updateView();
    await new Promise(resolve => setTimeout(resolve, 1800));
    return this.delivery === 'pickup' ? 0 : 500;
  }

  undoOrder () {
    debugger;
    const receipt = this.receipts[this.receipts.length - 1];
    this.restoreOrder(receipt);
    this.updateView();
    return receipt;
  }

  reset () {
    this.cart = [{ sku: 'tea', quantity: '2', unit: 1250 }, { sku: 'cake', quantity: '3', unit: 450 }];
    this.stock = { tea: 3, cake: 5 };
    this.coupon = 'vip'; this.delivery = 'courier';
    this.receipts = []; this.attempts = 0; this.quoteCalls = 0;
    this.status = 'Ready: VIP discount / courier delivery';
    this.updateView();
  }

  badCart () {
    this.cart[1].quantity = 'oops';
    this.status = 'Bad input: cake quantity = "oops"'; this.updateView();
  }

  async debugCheckout () { return this.debugAction('checkout'); }
  async debugUndo () { return this.debugAction('undoOrder'); }
  async debugAction (name) {
    try {
      const result = await runWithCapturedBindings(this[name], null, [], { this: this });
      if (result.isContinuation) return openForContinuation(result, this.world());
      return result.returnValue;
    } catch (error) {
      this.status = 'Could not start: ' + error.message; this.updateView();
      this.world().showError(error);
    }
  }

  updateView () {
    this.get('cart').textString = this.cart.map(line => line.sku + '  × ' + line.quantity + '  @ €' + (line.unit / 100).toFixed(2)).join('\n');
    this.get('stock').textString = 'Stock: tea ' + this.stock.tea + ' · cake ' + this.stock.cake;
    this.get('status').textString = this.status;
    this.get('metrics').textString = 'Attempts ' + this.attempts + ' · quotes ' + this.quoteCalls + ' · orders ' + this.receipts.length;
    const receipt = this.receipts[this.receipts.length - 1];
    this.get('receipt').textString = receipt ? 'Subtotal €' + (receipt.subtotal / 100).toFixed(2) + '\nDiscount €' + (receipt.discount / 100).toFixed(2) + '\nVAT €' + (receipt.tax / 100).toFixed(2) + '\nDelivery €' + (receipt.shipping / 100).toFixed(2) + '\nTOTAL €' + (receipt.total / 100).toFixed(2) : 'No receipt yet';
  }
}

export function openOrderDesk (world = $world) {
  const desk = new OrderDesk({ name: 'debugger order desk', extent: pt(440, 550), fill: Color.white,
    submorphs: [
      new Text({ name: 'heading', textString: 'LIVE ORDER DESK', position: pt(16, 14), extent: pt(400, 30), fontSize: 22, readOnly: true }),
      new Text({ name: 'cart', position: pt(16, 58), extent: pt(400, 58), fontSize: 18, readOnly: true }),
      new Text({ name: 'stock', position: pt(16, 122), extent: pt(400, 28), fontSize: 16, readOnly: true }),
      new Text({ name: 'status', position: pt(16, 162), extent: pt(400, 55), fontSize: 16, readOnly: true }),
      new Text({ name: 'receipt', position: pt(16, 228), extent: pt(400, 155), fontSize: 19, readOnly: true }),
      new Text({ name: 'metrics', position: pt(16, 394), extent: pt(400, 28), fontSize: 15, readOnly: true }),
      new Text({ name: 'heartbeat', textString: 'World timer: 0', position: pt(16, 430), extent: pt(400, 28), fontSize: 15, readOnly: true })
    ] });
  for (const [index, [label, method]] of [['Checkout', 'debugCheckout'], ['Bad cart', 'badCart'], ['Undo', 'debugUndo'], ['Reset', 'reset']].entries()) {
    const button = part(SystemButton, { name: label, position: pt(16 + index * 105, 484), extent: pt(97, 30), submorphs: [{ name: 'label', textString: label }] });
    desk.addMorph(button); connect(button, 'fire', desk, method);
  }
  desk.reset(); desk.openInWindow({ title: 'Order desk · implementation exercise' });
  desk.startStepping(1000, 'tick');
  return desk;
}
