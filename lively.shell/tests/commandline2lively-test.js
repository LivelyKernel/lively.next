/* global describe, it */

import { expect } from 'mocha-es6';
import queryLively from '../bin/commandline2lively.js';

class FakeSocket {
  constructor (answer) {
    this.answer = answer;
    this.handlers = new Map();
    this.sent = [];
    this.closed = false;
  }

  once (event, handler) {
    this.handlers.set(event, handler);
    return this;
  }

  connect () {
    this.trigger('connect');
  }

  close () {
    this.closed = true;
  }

  emit (event, message, ackFn) {
    this.sent.push({ event, message });
    ackFn(this.answer);
  }

  trigger (event, value) {
    const handler = this.handlers.get(event);
    this.handlers.delete(event);
    if (handler) handler(value);
  }
}

describe('command-line L2L client', () => {
  it('sends the action as the Socket.IO event and closes after its answer', async () => {
    const answer = { data: { result: 'ok' } };
    const socket = new FakeSocket(answer);
    let connection;

    const received = await new Promise((resolve, reject) => {
      queryLively(
        { action: 'changeWorkingDirectory', data: { args: ['/tmp'] } },
        (err, result) => err ? reject(err) : resolve(result),
        (url, options) => {
          connection = { url, options };
          return socket;
        }
      );
    });

    expect(received).equals(answer);
    expect(socket.sent).length(1);
    expect(socket.sent[0].event).equals('changeWorkingDirectory');
    expect(socket.sent[0].message.action).equals('changeWorkingDirectory');
    expect(socket.closed).equals(true);
    expect(connection.options.autoConnect).equals(false);
    expect(connection.options.reconnection).equals(false);
  });

  it('closes and reports connection failures without reconnecting', async () => {
    const socket = new FakeSocket();
    socket.connect = () => socket.trigger('connect_error', new Error('unavailable'));

    const error = await new Promise(resolve => {
      queryLively({ action: 'test', data: {} }, err => resolve(err), () => socket);
    });

    expect(String(error)).includes('unavailable');
    expect(socket.closed).equals(true);
    expect(socket.sent).length(0);
  });
});
