// Checkout with validation, an asynchronous delivery quote, an atomic stock
// commit and undo. Amounts are integer cents.
export class OrderDesk {
  constructor () { this.reset(); }

  async checkout () {
    this.attempts++;
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
  }

  restoreOrder (receipt) {
    if (!receipt) throw new Error('No order to undo');
    for (const line of receipt.lines) {
      this.stock[line.sku] += line.quantity;
    }
    this.receipts.pop();
  }

  async quoteDelivery () {
    this.quoteCalls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return this.delivery === 'pickup' ? 0 : 500;
  }

  undoOrder () {
    debugger;
    const receipt = this.receipts[this.receipts.length - 1];
    this.restoreOrder(receipt);
    return receipt;
  }

  reset () {
    this.cart = [{ sku: 'tea', quantity: '2', unit: 1250 }, { sku: 'cake', quantity: '3', unit: 450 }];
    this.stock = { tea: 3, cake: 5 };
    this.coupon = 'vip'; this.delivery = 'courier';
    this.receipts = []; this.attempts = 0; this.quoteCalls = 0;
  }

  badCart () { this.cart[1].quantity = 'oops'; }
}
