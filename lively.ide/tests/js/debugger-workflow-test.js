/* global describe, it, afterEach, System */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { localInterface } from 'lively-system-interface';
import { run, runWithCapturedBindings } from 'lively.context/lib/stackReification.js';
import { sourceNameForFrame, lineRangeForFrame } from '../../js/debugger/source.js';
import { debuggerFor, closeDebuggers, withModule } from './debugger-helpers.js';

const receiptTotals = receipt => [receipt.subtotal, receipt.discount, receipt.tax, receipt.shipping, receipt.total];

describe('debugger workflows', function () {
  this.timeout(30000);
  afterEach(closeDebuggers);

  it('implements an order desk checkout and its undo while they run', async () => withModule('order-desk.js',
    await resource(System.decanonicalize('lively.ide/tests/js/fixtures/order-desk.js')).read(),
    async ({ OrderDesk }) => {
      const desk = new OrderDesk(), debug = method => debuggerFor(run(desk[method], null, [], { this: desk }));
      const evaluate = (model, source) => model.evaluateWorkspaceSource(source).then(result => result.value);
      let model = await debug('checkout');
      await model.proceed();
      expect(receiptTotals(await evaluate(model, 'receipt')), 'pricing with VIP discount, VAT and the delivery quote')
        .deep.equals([3850, 385, 693, 500, 4658]);
      expect(desk.stock).deep.equals({ tea: 3, cake: 5 });
      const pane = model.ui.sourcePane;
      pane.textString = pane.textString.replace('this.lastTotal = receipt.total;', 'this.lastTotal = receipt.total + 1;');
      expect(await model.saveModule()).equals(true);
      expect((await model.applySavedMethod()).isContinuation).equals(true);
      await model.stepOver();
      await model.stepInto();
      const [commit, checkout] = model.continuation.frames().map(sourceNameForFrame);
      expect([commit, checkout]).to.satisfy(([commit, checkout]) => commit.includes('commitOrder') && checkout.includes('checkout'));
      await model.stepOut();
      expect(model.continuation.frames()).length(1);
      expect(desk.stock, 'the stock is committed at once').deep.equals({ tea: 1, cake: 2 });
      expect((await model.proceed()).total).equals(4658);
      expect([desk.lastTotal, desk.receipts.length, desk.attempts, desk.quoteCalls]).deep.equals([4659, 1, 1, 1]);
      await (await debug('undoOrder')).proceed();
      expect([desk.stock, desk.receipts.length]).deep.equals([{ tea: 3, cake: 5 }, 0]);

      desk.reset();
      desk.badCart();
      model = await debug('checkout');
      await model.proceed();
      expect(model.continuation.exception.message).equals('Invalid quantity for cake');
      expect(model.continuation.frames().find(frame => frame.getScope().hasInChain('subtotal')).lookup('subtotal')).equals(2500);
      await evaluate(model, "line.quantity = '3'");
      await model.restartFrame();
      await model.proceed();
      expect((await model.proceed()).total).equals(4658);
      expect([desk.attempts, desk.quoteCalls], 'the repaired line is priced again without a new attempt').deep.equals([1, 1]);

      desk.reset();
      desk.cart[1] = { sku: 'tea', quantity: '2', unit: 1250 };
      model = await debug('checkout');
      await model.proceed();
      await model.proceed();
      expect(model.continuation.exception.message).equals('Insufficient stock for tea');
      expect([desk.stock, desk.receipts.length]).deep.equals([{ tea: 3, cake: 5 }, 0]);
      expect(() => desk.priceLine({ sku: 'unknown', quantity: 1, unit: 100 })).to.throw('Unknown product');
      expect(() => desk.priceLine({ sku: 'tea', quantity: 1, unit: -1 })).to.throw('Invalid price');
    }));

  it('repairs an async generator under for await and applies saved future edits', () => withModule('lesson.js',
    'export class Lesson {\n constructor() { this.rate = "2"; this.visits = 0; this.cleanups = 0; }\n async *values() {\n  try {\n   for (const quantity of [2, 3]) {\n    this.visits++;\n    let amount = this.rate + quantity;\n    await Promise.resolve();\n    debugger;\n    yield amount;\n   }\n  } finally { this.cleanups++; }\n }\n async checkout() { let total = 0; for await (const value of this.values()) total += value; return total; }\n}',
    async ({ Lesson }, { file }) => {
      const lesson = new Lesson(), source = await file.read();
      const stopped = await runWithCapturedBindings(lesson.checkout, null, [], { this: lesson });
      expect(stopped.exception).equals(undefined);
      expect(sourceNameForFrame(stopped.currentFrame)).contains('values');
      const model = await debuggerFor(stopped), pane = model.ui.sourcePane;
      expect(pane.textString).equals(source);
      expect(lineRangeForFrame(stopped.currentFrame, source).start.row).equals(8);
      expect((await model.evaluateWorkspaceSource('this.rate = 2; amount = this.rate * quantity')).value).equals(4);
      pane.textString = source.replace('yield amount;', 'yield amount * 2;');
      expect(await model.saveModule()).equals(true);
      expect((await model.applySavedMethod()).isContinuation).equals(true);
      await model.selectFrame(model.continuation.currentFrame);
      // A draft typed while the module source is read survives the selection.
      const saved = pane.textString, moduleRead = localInterface.moduleRead;
      let entered, release;
      const started = new Promise(resolve => { entered = resolve; }), pending = new Promise(resolve => { release = resolve; });
      localInterface.moduleRead = () => { entered(); return pending; };
      try {
        const selection = model.selectFrame(model.continuation.currentFrame);
        await started;
        pane.textString = saved + '\n// next repair draft';
        release(saved);
        await selection;
        expect(pane.textString).equals(saved + '\n// next repair draft');
      } finally { localInterface.moduleRead = moduleRead; release(saved); }
      model.sourceBuffers.clear();
      expect((await model.proceed()).isContinuation).equals(true);
      expect([lesson.visits, lesson.cleanups]).deep.equals([2, 0]);
      await model.evaluateWorkspaceSource('amount = this.rate * quantity');
      expect(await model.proceed()).equals(20);
      expect([lesson.visits, lesson.cleanups], 'cleanup runs once on completion').deep.equals([2, 1]);
    }));
});
