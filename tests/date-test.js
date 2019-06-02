/*global beforeEach, afterEach, describe, it, setInterval, clearInterval, setTimeout*/

import { expect } from "mocha-es6";
import { relativeTo, equals, format } from "../date.js";

describe('date', function() {

  it('converts to relative time', function() {
    var d1 = new Date('Tue May 14 2013 14:00:00 GMT-0700 (PDT)'), d2;
    expect(relativeTo(d1, d1)).to.equal('now');
    d2 = new Date(d1 - (2 * 1000));
    expect(relativeTo(d2, d1)).to.equal('2 secs');
    d2 = new Date(d1 - (60 * 1000 + 2*1000));
    expect(relativeTo(d2, d1)).to.equal('1 min 2 secs');
    d2 = new Date(d1 - (3 * 60 * 1000 + 2 * 1000));
    expect(relativeTo(d2, d1)).to.equal('3 mins');
    d2 = new Date(d1 - (60 * 60 * 1000 + 2 * 60 * 1000 + 2 * 1000));
    expect(relativeTo(d2, d1)).to.equal('1 hour 2 mins');
    d2 = new Date(d1 - (4 *60 * 60 * 1000 + 2 * 60 * 1000 + 2 * 1000));
    expect(relativeTo(d2, d1)).to.equal('4 hours');
  });

  it('computes time equality', function() {
    var d1 = new Date('Tue May 14 2013 14:00:00 GMT-0700 (PDT)'), d2;
    expect(equals(d1, d1)).to.equal(true);
    d2 = new Date(d1 - (2 * 1000));
    expect(equals(d1, d2)).to.equal(false);
    d2 = new Date(+d1);
    expect(equals(d1, d2)).to.equal(true);
  });

  it('formats dates', function() {
    var d1 = new Date('Tue May 14 2013 14:00:05'), d2;
    expect(format(d1, "mm/yy HH:MM:ss")).to.equal("05/13 14:00:05");
  });

});
