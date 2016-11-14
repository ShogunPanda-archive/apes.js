/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* globals describe, it */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, max-statements */

const chai = require("chai");

const expect = chai.expect;

const RuntimeError = require("../../lib/runtime-error");

describe("RuntimeError", function(){
  it("should create a new error", function(){
    let subject = null;

    subject = new RuntimeError("code", "message");
    expect(subject.code).to.eql("CODE");
    expect(subject.message).to.eql("message");

    subject = new RuntimeError("code");
    expect(subject.code).to.eql("CODE");
    expect(subject.message).to.eql("CODE");

    const error = new Error("ERROR");
    subject = new RuntimeError("code", "message", error);
    expect(subject.code).to.eql("CODE");
    expect(subject.message).to.eql("ERROR");
    expect(subject.wrappedError).to.eql(error);

    subject = new RuntimeError("code", "message", "ERROR");
    expect(subject.code).to.eql("CODE");
    expect(subject.message).to.eql("ERROR");
    expect(subject.wrappedError).to.be.undefined;

    subject = new RuntimeError("code", {data: "DATA", message: "message"});
    expect(subject.code).to.eql("CODE");
    expect(subject.message).to.eql("message");
    expect(subject.data).to.eql({data: "DATA"});
    expect(subject.wrappedError).to.be.undefined;
  });

  it("should copy an existing error", function(){
    const error = new Error("ERROR");
    const copy = new RuntimeError("code", "message", error);
    const subject = new RuntimeError("ANOTHER", "WHATEVER", copy);

    expect(subject.code).to.eql("ANOTHER");
    expect(subject.message).to.eq("ERROR");
    expect(subject.wrappedError).to.eql(error);
  });
});

/* eslint-enaable no-unused-expressions, prefer-arrow-callback, max-statements */
