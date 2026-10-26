/* global describe, it */
import { expect } from 'mocha-es6';
import Document from 'lively.morphic/text/document.js';
import { getMode, tokenizeDocument } from '../editor-modes.js';
import '../md/mode.js';

describe('markdown list highlighting', () => {
  function styles (source) {
    const document = Document.fromString(source);
    const { tokens } = tokenizeDocument(getMode({}, { name: 'markdown', fencedCodeBlocks: true }), document, 0, document.rowCount - 1);
    return tokens.map(line => line.filter((token, i) => i % 5 === 2));
  }

  for (const marker of ['1.', '-']) {
    it(`keeps lazy paragraph continuations in a ${marker} list`, () => {
      const tokens = styles(`${marker} aaa\ndddd\nanother line`);
      expect(tokens[1]).deep.equals(['variable-2']);
      expect(tokens[2]).deep.equals(['variable-2', 'variable-2', 'variable-2']);
    });
  }

  it('keeps the innermost list depth for lazy continuation and resets sibling depth', () => {
    const tokens = styles('- outer\n  - inner\nlazy\n- sibling\ncontinued');
    expect(tokens[2]).deep.equals(['variable-3']);
    expect(tokens[3].filter(Boolean).every(style => style === 'variable-2')).equals(true);
    expect(tokens[4]).deep.equals(['variable-2']);
  });

  it('ends lazy continuation at a blank line but keeps indented list paragraphs', () => {
    expect(styles('1. aaa\n\ndddd')[2]).deep.equals([null]);
    expect(styles('1. aaa\n   \ndddd')[2]).deep.equals([null]);
    expect(styles('1. aaa\n\n   dddd')[2]).deep.equals([null, 'variable-2']);
  });

  for (const block of ['# heading', '---', '> quote', '```js\ncode\n```']) {
    it(`ends an unindented list before ${block.split('\n')[0]}`, () => {
      const tokens = styles(`- aaa\n${block}`);
      expect(tokens[1].filter(Boolean).some(style => /variable-[23]/.test(style))).equals(false);
    });
  }

  it('does not turn a line following a list heading into a lazy paragraph', () => {
    expect(styles('- aaa\n  # heading\nafter')[2]).deep.equals([null]);
    expect(styles('- # heading\nafter')[1]).deep.equals([null]);
    expect(styles('- \nafter')[1]).deep.equals([null]);
  });

  it('ends the paragraph context after an HTML block', () => {
    expect(styles('- aaa\n<div>html</div>\nafter')[2]).deep.equals([null]);
  });
});
