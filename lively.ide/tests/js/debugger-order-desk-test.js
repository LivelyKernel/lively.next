/* global describe, it */
import { expect } from 'mocha-es6';
import { OrderDesk } from '../../js/debugger/examples/order-desk.js';
import { run } from 'lively.context/lib/stackReification.js';
import { resumeInspectorContinuation, restartInspectorFrame } from 'lively.context/lib/inspector-interpreter.js';

describe('debugger order desk', function () {
  it('checks pricing, live repair, atomic stock updates and undo through continuations', async function () {
    const desk = new OrderDesk();
    desk.updateView = () => {};
    desk.quoteDelivery = async function () { this.quoteCalls++; return 500; };
    const start = name => run(desk[name], null, [], {this: desk});
    const resume = continuation => resumeInspectorContinuation(continuation);
    desk.reset();
    let preview = await resume(await start('checkout'));
    expect(preview.isContinuation).equals(true);
    expect(desk.stock).deep.equals({tea: 3, cake: 5});
    const receipt = await resume(preview);
    expect([receipt.subtotal, receipt.discount, receipt.tax, receipt.shipping, receipt.total])
      .deep.equals([3850, 385, 693, 500, 4658]);
    expect(desk.stock).deep.equals({tea: 1, cake: 2});
    expect(desk.receipts).length(1);
    await resume(await start('undoOrder'));
    expect(desk.stock).deep.equals({tea: 3, cake: 5});
    expect(desk.receipts).length(0);

    desk.reset(); desk.badCart();
    let failed = await resume(await start('checkout'));
    expect(failed.exception.message).equals('Invalid quantity for cake');
    const checkout = failed.frames().find(frame => frame.getScope().hasInChain('subtotal'));
    expect(checkout.lookup('subtotal')).equals(2500);
    failed.currentFrame.lookup('line').quantity = '3';
    preview = await resume(restartInspectorFrame(failed));
    expect((await resume(preview)).total).equals(4658);
    expect([desk.attempts, desk.quoteCalls]).deep.equals([1, 1]);

    desk.reset();
    desk.cart[1] = {sku: 'tea', quantity: '2', unit: 1250};
    preview = await resume(await start('checkout'));
    failed = await resume(preview);
    expect(failed.exception.message).equals('Insufficient stock for tea');
    expect(desk.stock).deep.equals({tea: 3, cake: 5});
    expect(desk.receipts).length(0);
    expect(() => desk.priceLine({sku: 'unknown', quantity: 1, unit: 100})).to.throw('Unknown product');
    expect(() => desk.priceLine({sku: 'tea', quantity: 1, unit: -1})).to.throw('Invalid price');
    desk.remove();
  });
});
