import { expect } from 'mocha-es6';
import { HeadlessSession } from '../index.js';

describe('lively.headless', () => {
  it('works', () => {
    expect(1 + 2).equals(3);
  });

  it('keeps only recent browser console errors for timeout reporting', () => {
    const session = new HeadlessSession({ maxConsoleEntries: 3 });
    session.recordConsoleEntry({ kind: 'console', level: 'log', text: 'ignore me' });
    session.recordConsoleEntry({ kind: 'console', level: 'error', text: 'first error' });
    session.recordConsoleEntry({ kind: 'pageerror', level: 'error', text: 'second error' });
    session.recordConsoleEntry({ kind: 'console', level: 'warn', text: 'ignore me too' });

    const recentErrors = session.recentConsoleErrors().map(entry => entry.text);
    expect(recentErrors).deep.equals(['first error', 'second error']);
  });

  it('summarizes recent browser console errors for CI output', () => {
    const session = new HeadlessSession();
    session.recordConsoleEntry({
      kind: 'console',
      level: 'error',
      text: 'require is not defined',
      location: { url: 'http://localhost:9011/dashboard/ui.cp.js', lineNumber: 24, columnNumber: 7 }
    });

    expect(session.summarizeRecentConsoleErrors()).contains('require is not defined');
    expect(session.summarizeRecentConsoleErrors()).contains('http://localhost:9011/dashboard/ui.cp.js:24:7');
  });
});
