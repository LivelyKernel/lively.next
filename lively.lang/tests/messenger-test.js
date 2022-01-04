/* global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout */

import { expect } from 'mocha-es6';
import { remove, pluck } from '../array.js';
import { waitForAll, composeAsync } from '../function.js';
import { create } from '../messenger.js';
import { makeEmitter } from '../events.js';
import { chain } from 'lively.lang';

// -=-=-=-=-=-=-
// some helper
// -=-=-=-=-=-=-
function createMessenger (messengers, options) {
  let keys = ['id', 'send', 'listen', 'isOnline', 'close',
    'allowConcurrentSends', 'sendTimeout',
    'sendHeartbeat', 'heartbeatInterval',
    'services', 'ignoreUnknownMessages'];

  let spec = keys.reduce(function (spec, k) {
    if (options[k]) spec[k] = options[k];
    return spec;
  }, {});

  if (!spec.send) {
    spec.send = function (msg, onSendDone) {
      function doSend () {
        if (options.sendData) options.sendData.push(msg);
        onSendDone();
      }
      if (typeof options.sendDelay === 'number') setTimeout(doSend, options.sendDelay);
      else doSend();
    };
  }

  let listening = false;
  if (!spec.listen) {
    spec.listen = function (thenDo) {
      function doListen () {
        messengers.push(messenger);
        listening = true; thenDo(null);
      }
      if (typeof options.listenDelay === 'number') setTimeout(doListen, options.listenDelay);
      else doListen();
    };
  }

  if (!spec.close) {
    spec.close = function (thenDo) {
      function doClose () {
        remove(messengers, messenger);
        listening = false; thenDo(null);
      }
      if (typeof options.closeDelay === 'number') setTimeout(doClose, options.closeDelay);
      else doClose();
    };
  }

  if (!spec.isOnline) spec.isOnline = function () { return !!listening; };

  var messenger = create(spec);
  return messenger;
}

let messageDispatcher = makeEmitter({
  dispatch: function (messengers, msg, thenDo) {
    let messenger = findMessengerForMsg(msg);
    if (!messenger) thenDo(new Error('Target ' + msg.target + ' not found'));
    else { messenger.onMessage(msg); thenDo(null); }

    function findMessengerForMsg (msg) {
      if (!msg || !msg.target) throw new Error('findMessengerForMsg: msg is strange: ' + lively.lang.obj.inspect(msg));
      return messengers.find(ea => ea.id() === msg.target);
    }
  }
});

function genericSend (messengers, msg, thenDo) { messageDispatcher.dispatch(messengers, msg, thenDo); }

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// here come the tests
// -=-=-=-=-=-=-=-=-=-=-

describe('messengers', function () {
  let sendData = []; let messenger;
  let messengers;

  beforeEach(function () {
    messengers = [];

    sendData = [], messenger = createMessenger(messengers, {
      id: 'messengerA',
      sendDelay: 100,
      listenDelay: 10,
      sendData: sendData
    });
  });

  afterEach(function (done) {
    waitForAll(pluck(messengers, 'close'), done);
  });

  describe('messenger attributes', function () {
    it('have ids', function () {
      expect(messenger.id()).to.equal('messengerA');
      expect(createMessenger(messengers, {}).id()).to.match(/^[a-z0-9-]+$/i);
    });
  });

  describe('sending basics', function () {
    it('sends messages one by one', function (done) {
      let msg1 = { target: 'foo', action: 'test', data: 'some data' };
      let msg2 = { target: 'foo', action: 'test2', data: 'some more data' };

      composeAsync(
        function (next) { messenger.send(msg1); messenger.send(msg2); next(); },
        function (next) {
          waitForAll({ timeout: 200 }, [messenger.whenOnline], next);
          messenger.listen();
        },
        function (_, next) {
          expect(sendData).to.have.length(0);
          expect(messenger.outgoingMessages()).to.eql([msg1, msg2]);
          next();
        },
        chain(setTimeout).flip().curry(150).value(),
        function (next) {
          expect(sendData[0]).to.eql(msg1);
          if (messenger.outgoingMessages().length) { expect(messenger.outgoingMessages()).to.eql([msg2]); }
          next();
        },
        chain(setTimeout).flip().curry(100).value(),
        function (next) {
          expect(sendData).to.eql([msg1, msg2]);
          expect(messenger.outgoingMessages()).to.have.length(0);
          next();
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });

    it('sends messages concurrently', function (done) {
      let msg1 = { target: 'foo', action: 'test', data: 'some data' };
      let msg2 = { target: 'bar', action: 'test2', data: 'some more data' };

      let sendData = [];
      let messengerB = createMessenger(messengers, {
        id: 'messengerB',
        allowConcurrentSends: true,
        sendDelay: 100,
        listenDelay: 10,
        sendData: sendData
      });

      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline], next);
          messengerB.listen();
        },
        function (_, next) { messengerB.send(msg1); messengerB.send(msg2); next(); },
        function (next) {
          expect(sendData).to.have.length(0);
          expect(messengerB.outgoingMessages()).to.eql([msg1, msg2]);
          next();
        },
        function (next) { setTimeout(next, 125); },
        function (next) {
          expect(sendData).to.eql([msg1, msg2]);
          expect(messengerB.outgoingMessages()).to.have.length(0);
          next();
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });

    it('sends can time out', function (done) {
      let msg = { target: 'foo', action: 'test', data: 'some data' };

      let sendData = [];
      let sendErr;
      let messengerB = createMessenger(messengers, {
        id: 'messengerB',
        sendTimeout: 100,
        sendDelay: 200,
        sendData: sendData
      });

      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline], next);
          messengerB.listen();
        },
        function (_, next) {
          messengerB.send(msg, function (err) { sendErr = err; });
          next();
        },
        chain(setTimeout).flip().curry(300).value(),
        function (next) {
          expect(sendData).to.eql([msg]);
          expect(messengerB.outgoingMessages()).to.have.length(0);
          next();
        }
      )(function (err) {
        expect(err).to.equal(null);
        expect(String(sendErr)).to.match(/Timeout sending message/);
        done();
      });
    });

    it('sends can time out when not listening', function (done) {
      let msg = { target: 'foo', action: 'test', data: 'some data' };
      let sendData = [];
      let sendErr;
      let messengerB = createMessenger(messengers, {
        id: 'messengerB',
        sendTimeout: 20,
        sendDelay: 0,
        listenDelay: 50,
        sendData: sendData
      });

      composeAsync(
        function (next) { messengerB.listen(); next(); },
        function (next) {
          messengerB.send(msg, function (err) { sendErr = err; });
          next();
        },
        function (next) { setTimeout(next, 25); },
        function (next) {
          expect(sendData).to.have.length(0);
          expect(messengerB.outgoingMessages()).to.have.length(0);
          next();
        }
      )(function (err) {
        expect(err).to.equal(null);
        expect(String(sendErr)).to.match(/Timeout sending message/);
        done();
      });
    });

    it('can send heartbeat messages', function (done) {
      let sendData = []; let heartbeats = [];
      var messengerB = createMessenger(messengers, {
        id: 'messengerB',
        sendDelay: 10,
        listenDelay: 10,
        sendData: sendData,
        heartbeatInterval: 30,
        sendHeartbeat: function (thenDo) {
          let msg = { target: 'someone', action: 'heartbeat', data: { time: Date.now } };
          heartbeats.push(msg);
          messengerB.send(msg, thenDo);
        }
      });

      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline], next);
          messengerB.listen();
        },
        function (_, next) { setTimeout(next, 70); },
        function (next) {
          expect(sendData).to.eql(heartbeats);
          next();
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });
  });

  describe('status', function () {
    it('can auto reconnect', function (done) {
      let isOnline = true;
      let messengerB = createMessenger(messengers, {
        id: 'messengerB',
        sendData: sendData,
        isOnline: function () { return isOnline; },
        listen: function (thenDo) { messengers.push(this); isOnline = true; thenDo(null); },
        close: function (thenDo) { remove(messengers, this); isOnline = false; thenDo(null); },
        autoReconnect: true
      });

      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline], next);
          messengerB.listen();
        },
        function (_, next) { expect(isOnline).to.equal(true); next(); },
        function (next) { isOnline = false; next(); },
        function (next) { setTimeout(next, 70); },
        function (next) { expect(isOnline).to.equal(true); messengerB.close(next); },
        function (next) { setTimeout(next, 70); },
        function (next) { expect(isOnline).to.equal(false); next(); }
      )(function (err) { expect(err).to.equal(null); done(); });
    });
  });

  describe('send and receive', function () {
    let messengerB, messengerC;
    let receivedB, receivedC;

    beforeEach(function () {
      messengerB = createMessenger(messengers, {
        id: 'messengerB',
        sendDelay: 20,
        listenDelay: 10,
        send: genericSend.bind(null, messengers),
        ignoreUnknownMessages: true
      });
      receivedB = [];
      messengerB.on('message', function (msg) { receivedB.push(msg); });

      messengerC = createMessenger(messengers, {
        id: 'messengerC',
        sendDelay: 20,
        listenDelay: 10,
        send: genericSend.bind(null, messengers),
        ignoreUnknownMessages: true
      });
      receivedC = [];
      messengerC.on('message', function (msg) { receivedC.push(msg); });
    });

    it('sends messages between messengers', function (done) {
      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline, messengerC.whenOnline], next);
          messengerB.listen(); messengerC.listen();
        },
        function (_, next) {
          messengerB.send({ target: 'messengerC', action: 'test', data: 'foo' });
          next();
        },
        function (next) {
          expect(receivedB).to.have.length(0);
          expect(receivedC).to.have.length(1);
          expect(receivedC[0].data).to.equal('foo');
          messengerC.answer(receivedC[0], 'baz');
          expect(receivedB).to.have.length(1);
          expect(receivedB[0].data).to.equal('baz');
          next();
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });

    it('send callback gets triggered on answer', function (done) {
      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline, messengerC.whenOnline], next);
          messengerB.listen(); messengerC.listen();
        },
        function (_, next) {
          let msg = messengerB.send({ target: 'messengerC', action: 'test', data: 'foo' }, function (err, answer) {
            expect(err).to.equal(null);
            expect(answer.data).to.equal('baz');
            next();
          });
          messengerC.answer(msg, 'baz');
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });

    it('ignores multiple answers send without expect more flag', function (done) {
      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline, messengerC.whenOnline], next);
          messengerB.listen(); messengerC.listen();
        },
        function (_, next) {
          let answerCallbackCalled = 0;
          let msg = messengerB.send({ target: 'messengerC', action: 'test', data: 'foo' }, function (err, answer) {
            answerCallbackCalled++;
          });
          messengerC.answer(msg, 'baz1');
          messengerC.answer(msg, 'baz2');
          expect(answerCallbackCalled).to.equal(1);
          next();
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });

    it('invokes answer callback multiple times when send with expect more flag', function (done) {
      composeAsync(
        function (next) {
          waitForAll({ timeout: 200 }, [messengerB.whenOnline, messengerC.whenOnline], next);
          messengerB.listen(); messengerC.listen();
        },
        function (_, next) {
          let answerCallbackCalled = 0;
          let msg = messengerB.send({ target: 'messengerC', action: 'test', data: 'foo' }, function (err, answer) {
            answerCallbackCalled++;
          });
          messengerC.answer(msg, 'baz1', true);
          messengerC.answer(msg, 'baz2', false);
          expect(answerCallbackCalled).to.equal(2);
          next();
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });
  });

  describe('services', function () {
    let messengerB, messengerC;
    let receivedB, receivedC;

    beforeEach(function () {
      messengerB = createMessenger(messengers, {
        id: 'messengerB', sendDelay: 20, send: genericSend.bind(null, messengers)
      });
      receivedB = [];
      messengerB.on('message', function (msg) { receivedB.push(msg); });

      messengerC = createMessenger(messengers, {
        id: 'messengerC', sendDelay: 20, send: genericSend.bind(null, messengers)
      });
      receivedC = [];
      messengerC.on('message', function (msg) { receivedC.push(msg); });
    });

    it('can add services', function (done) {
      composeAsync(
        function (next) {
          messengerC.addServices({
            test: function (msg, messenger) {
              messenger.answer(msg, msg.data + 'bar');
            }
          });
          next();
        },
        function (next) { messengerB.listen(); messengerC.listen(); next(); },
        function (next) {
          messengerB.send({ target: 'messengerC', action: 'test', data: 'foo' }, function (err, answer) {
            expect(answer.data).to.equal('foobar');
            next();
          });
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });

    it('services can error', function (done) {
      composeAsync(
        function (next) {
          messengerC.addServices({
            test: function (msg, messenger) { throw new Error('foo bar'); }
          });
          next();
        },
        function (next) { messengerB.listen(); messengerC.listen(); next(); },
        function (next) {
          messengerB.send(
            { target: 'messengerC', action: 'test', data: 'foo' },
            function (err, answer) {
              expect(answer.data.error).to.match(/(Error:.*foo bar)|(at test.*messenger-test.js)|(test@.*messenger-test.js)/);
              next();
            });
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });

    it('non existing service results in messageNotUnderstood error', function (done) {
      composeAsync(
        function (next) { messengerB.listen(); messengerC.listen(); next(); },
        function (next) {
          messengerB.send({ target: 'messengerC', action: 'test', data: 'foo' }, function (err, answer) {
            expect(answer.data.error).to.equal('Error: messageNotUnderstood: test'); next();
          });
        }
      )(function (err) { expect(err).to.equal(null); done(); });
    });
  });
});
