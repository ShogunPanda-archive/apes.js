/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

import {expect} from "chai";
import * as sinon from "sinon";

import {Utils} from "../lib/utils";

describe("Utils", function(){
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

  describe(".elapsedTime", function(){
    it("should correctly compute elapsed time", function(){
      const hrtimeStub = sinon.stub(process, "hrtime");

      hrtimeStub.returns([4, 123000]);

      expect(Utils.elapsedTime()).to.be.null;
      expect(Utils.elapsedTime([1, 2], false)).to.equal(4000.123);
      expect(Utils.elapsedTime([1, 2], true)).to.equal("4000.123");
      expect(Utils.elapsedTime([1, 2], true, 6)).to.equal("4000.123");
      expect(Utils.elapsedTime([1, 2], true, 2)).to.equal("4000.12");

      hrtimeStub.returns([4, 0]);
      expect(Utils.elapsedTime([1, 2], true, 6)).to.equal("4000.0");

      hrtimeStub.restore();
    });
  });
});
