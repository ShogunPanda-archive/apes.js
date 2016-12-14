/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* globals describe, it, beforeEach, afterEach */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements */

const chai = require("chai");
const timeKeeper = require("timekeeper");
const sinon = require("sinon");
const moment = require("moment");

const expect = chai.expect;
chai.use(require("chai-moment"));

const Utils = require("../../lib/utils");

describe("Utils", function(){
  beforeEach(function(){
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function(){
    this.sandbox.restore();
  });

  describe(".isEmptyString", function(){
    it("should correct detect empty strings", function(){
      expect(Utils.isEmptyString("ABC")).to.be.false;
      expect(Utils.isEmptyString(" ABC")).to.be.false;
      expect(Utils.isEmptyString(" ")).to.be.true;
      expect(Utils.isEmptyString("")).to.be.true;
      expect(Utils.isEmptyString(null)).to.be.true;
      expect(Utils.isEmptyString(1)).to.be.true;
    });
  });

  describe(".encodeBase64", function(){
    it("should correct encode Base64 strings", function(){
      expect(Utils.encodeBase64("ABC")).to.equal("QUJD");
      expect(Utils.encodeBase64("abc")).to.equal("YWJj");
    });
  });

  describe(".decodeBase64", function(){
    it("should correct encode Base64 strings", function(){
      expect(Utils.decodeBase64("QUJD")).to.equal("ABC");
      expect(Utils.decodeBase64("YWJj")).to.equal("abc");
      expect(Utils.decodeBase64("YWJj", false)).to.be.instanceOf(Buffer);
    });
  });

  describe(".md5", function(){
    it("should correctly compute MD5 hashes", function(){
      expect(Utils.md5("ABC")).to.equal("902fbdd2b1df0c4f70b4a5d23525e932");
      expect(Utils.md5("CDE")).to.equal("f8e054e3416de72e874492e25c38b3ec");
    });
  });

  describe(".parseBoolean", function(){
    it("should correctly parse truthy values", function(){
      expect(Utils.parseBoolean(true)).to.be.true;
      expect(Utils.parseBoolean("yes ")).to.be.true;
      expect(Utils.parseBoolean("t")).to.be.true;
      expect(Utils.parseBoolean("y")).to.be.true;
      expect(Utils.parseBoolean("on")).to.be.true;
      expect(Utils.parseBoolean("1")).to.be.true;
    });

    it("should map everything else to false", function(){
      expect(Utils.parseBoolean(false)).to.be.false;
      expect(Utils.parseBoolean("yes a")).to.be.false;
      expect(Utils.parseBoolean("ta")).to.be.false;
      expect(Utils.parseBoolean("yy")).to.be.false;
      expect(Utils.parseBoolean("on ok")).to.be.false;
      expect(Utils.parseBoolean("0")).to.be.false;
      expect(Utils.parseBoolean(2)).to.be.false;
    });
  });

  describe(".parseDate", function(){
    beforeEach(function(){
      timeKeeper.freeze(new Date(2016, 7, 2));
    });

    afterEach(function(){
      timeKeeper.reset();
    });

    it("should correctly parse days ago", function(){
      expect(Utils.parseDate(1)).to.be.sameMoment(moment.utc("2016-08-01"));
      expect(Utils.parseDate("10")).be.sameMoment(moment.utc("2016-07-23"));
      expect(Utils.parseDate(-10)).to.be.sameMoment(moment.utc("2016-07-23"));
    });

    it("should correctly parse absolute values", function(){
      expect(Utils.parseDate("2016-05-14")).to.be.sameMoment(moment.utc("2016-05-14"));
      expect(Utils.parseDate("2015-03-01")).to.be.sameMoment(moment.utc("2015-03-01"));
    });

    it("should return the fallback when parsing fails", function(){
      expect(Utils.parseDate(["2015-03-01"], 0)).to.be.sameMoment(moment.utc("2016-08-02"));
      expect(Utils.parseDate("INVALID", -10)).to.be.sameMoment(moment.utc("2016-07-23"));
      expect(Utils.parseDate("ABC")).to.be.null;
    });
  });

  describe(".parseDateTime", function(){
    beforeEach(function(){
      timeKeeper.freeze(new Date(2016, 7, 2));
    });

    afterEach(function(){
      timeKeeper.reset();
    });

    it("should correctly parse absolute values", function(){
      expect(Utils.parseDateTime("2016-05-14T12:34:56.123+0100")).to.be.sameMoment(moment.utc("2016-05-14 11:34:56"));
      expect(Utils.parseDateTime("2015-03-01-03 +0300", ["YYYY-MM-DD-HH ZZ"], false)).to.be.sameMoment(moment.utc("2015-03-01 00:00:00"));
      expect(Utils.parseDateTime("2015-03-01 +0000", ["YYYY-MM-DD ZZ"])).to.be.sameMoment(moment.utc("2015-03-01"));
    });

    it("should return the fallback when parsing fails", function(){
      expect(Utils.parseDateTime("INVALID", "YYYY", true, 0)).to.be.sameMoment(moment.utc("2016-08-02"));
      expect(Utils.parseDateTime("INVALID", "YYYY", true, -10)).to.be.sameMoment(moment.utc("2016-07-23"));
      expect(Utils.parseDateTime("ABC")).to.be.null;
    });
  });

  describe(".utcDate", function(){
    beforeEach(function(){
      timeKeeper.freeze(new Date(2016, 7, 2));
    });

    afterEach(function(){
      timeKeeper.reset();
    });

    it("should return today's date as UTC midnight", function(){
      expect(Utils.utcDate()).to.be.sameMoment(moment.utc("2016-08-02"));
    });

    it("should return a date as UTC midnight", function(){
      expect(Utils.utcDate("2016-05-04")).to.be.sameMoment(moment.utc("2016-05-04"));
      expect(Utils.utcDate("2012-03-04")).to.be.sameMoment(moment.utc("2012-03-04"));
    });
  });

  describe(".serializeDate", function(){
    it("should correctly serialize dates", function(){
      expect(Utils.serializeDate(moment.utc("2016-12-26 12:34:56"))).to.equal("2016-12-26T12:34:56+00:00");
      expect(Utils.serializeDate(moment.utc("2016-07-21 00:00:00"))).to.equal("2016-07-21T00:00:00+00:00");
    });
  });

  describe(".elapsedTime", function(){
    it("should correctly compute elapsed time", function(){
      this.sandbox.stub(process, "hrtime").returns([4, 123000]);

      expect(Utils.elapsedTime()).to.be.null;
      expect(Utils.elapsedTime([1, 2], false)).to.equal(4000.123);
      expect(Utils.elapsedTime([1, 2], true)).to.equal("4000.12");
      expect(Utils.elapsedTime([1, 2], true, 2)).to.equal("4.0e+3");
    });
  });

  describe(".flatten", function(){
    it("should correctly flatten an array", function(){
      expect(Utils.flatten(1)).to.eql([1]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9])).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9], -1)).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9], 0)).to.eql([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9], 1)).to.eql([1, 2, [3, 4, [5, [6, [7]]]], 8, 9]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9], 2)).to.eql([1, 2, 3, 4, [5, [6, [7]]], 8, 9]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9], 3)).to.eql([1, 2, 3, 4, 5, [6, [7]], 8, 9]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9], 4)).to.eql([1, 2, 3, 4, 5, 6, [7], 8, 9]);
      expect(Utils.flatten([1, [2, [3, 4, [5, [6, [7]]]]], 8, 9], 25)).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  describe(".uniq / .unique", function(){
    it("should correctly remove duplicates from the array", function(){
      expect(Utils.uniq(1)).to.eql([1]);
      expect(Utils.unique([1, 2, [2], 2, 3, 4, 5, null, null, 5, 4, 6])).to.eql([1, 2, [2], 3, 4, 5, null, 6]);
    });
  });

  describe(".tokenize", function(){
    it("should correctly split values", function(){
      expect(Utils.tokenize(1)).to.eql(["1"]);
      expect(Utils.tokenize(["a,b, c", ["c,d"], null])).to.eql(["a", "b", "c", "d"]);
      expect(Utils.tokenize(["a,b,c", ["c,d "], null], /c/)).to.eql(["a,b,", ",d"]);
    });
  });

  describe(".random", function(){
    it("should generate a number between min and max", function(){
      for(let i = 0; i < 100; i++){
        expect(Utils.random(123, 456)).to.be.within(123, 456);
        expect(Utils.random(0.1, 0.23)).to.be.within(0.1, 0.23);
      }
    });
  });

  describe(".range", function(){
    it("should generate a range between two numbers", function(){
      expect(Utils.range(0, 10)).to.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(Utils.range(0, 10, true)).to.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      expect(Utils.range(3, 5)).to.eql([3, 4]);
      expect(Utils.range(5, 3)).to.eql([3, 4]);
      expect(Utils.range(3, 5, true)).to.eql([3, 4, 5]);

      expect(Utils.range(3, "5")).to.eql([3, 4]);
      expect(Utils.range(3.3, 5.52)).to.eql([3, 4]);
    });

    it("should ignore negative or bad arguments returning a empty array", function(){
      expect(Utils.range(-3, 5)).to.eql([]);
      expect(Utils.range(3, -5)).to.eql([]);
      expect(Utils.range("FOO", 5)).to.eql([]);
      expect(Utils.range(null, 5)).to.eql([]);
      expect(Utils.range()).to.eql([]);
    });
  });

  describe(".delay", function(){
    it("should wait the right amount of time", async function(){
      const time = process.hrtime();
      await Utils.delay(25);
      expect(process.hrtime(time)[1]).to.be.greaterThan(25E3);
    });
  });

  describe(".clone", function(){
    it("should clone a object, deeply and excluding functions", function(){
      let original = null;
      expect(Utils.clone(original)).to.eq(original);

      original = 1;
      expect(Utils.clone(original)).to.eq(original);

      original = "123";
      expect(Utils.clone(original)).to.eq(original);

      original = {a: [1, 2, 3], b: 1};
      expect(Utils.clone(original)).to.eql(original);

      const clone = Utils.clone(original);
      clone.b = 2;
      clone.a[2] = 4;
      original.foo = () => false;

      expect(original.b).to.eql(1);
      expect(original.a[2]).to.eql(3);
      expect(clone.foo).not.to.be.a("function");
    });
  });
});

/* eslint-enable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements */
