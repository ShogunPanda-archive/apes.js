/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* globals describe, it, beforeEach, afterEach */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, no-undefined, no-magic-numbers, no-sync, global-require */

const chai = require("chai");
const sinon = require("sinon");
const winston = require("winston");
const fs = require("fs-extra");

const expect = chai.expect;
chai.use(require("chai-as-promised"));
require("sinon-as-promised");

const Application = require("../../lib/application");
const Logger = require("../../lib/logger");

describe("Logger", function(){
  beforeEach(function(){
    this.sandbox = sinon.sandbox.create();

    Application.root = "/tmp/apes";
    Application.environment = "dev";
  });

  afterEach(function(){
    this.sandbox.restore();
    fs.removeSync("/tmp/apes");
  });

  describe(".constructor", function(){
    it("should save the parameters", function(){
      const subject = new Logger("TARGET", "A", "/ROOT");

      expect(subject.root).to.eql("/ROOT/log");
      expect(subject.target).to.eql("TARGET");
      expect(subject.useConsole).to.eq("A");
    });
  });

  describe(".prepare", function(){
    it("should just exit if already setup", function(){
      const subject = new Logger();
      subject.backend = "LOGGER";
      return expect(subject.prepare()).to.become(subject);
    });

    it("should create the log folder and create the file logger", function(){
      Application.debug = false;
      const subject = new Logger("TARGET");

      return subject.prepare("TARGET").then(() => {
        expect(subject.backend).to.be.instanceof(winston.Logger);
        expect(Object.keys(subject.backend.transports).length).to.equal(1);
        expect(subject.backend.transports.file).to.be.instanceof(winston.transports.File);
        expect(subject.backend.transports.file.filename).to.equal("TARGET.log");
        expect(subject.backend.transports.file.dirname).to.equal("/tmp/apes/log");
        expect(subject.backend.transports.file.level).to.equal("verbose");
        expect(subject.backend.transports.console).to.be.undefined;
      });
    });

    it("should also create a console logger", function(){
      Application.debug = true;
      const subject = new Logger("NAME", true);

      return subject.prepare().then(() => {
        expect(subject.backend).to.be.instanceof(winston.Logger);
        expect(Object.keys(subject.backend.transports).length).to.equal(2);
        expect(subject.backend.transports.file.filename).to.equal("NAME.log");
        expect(subject.backend.transports.file.level).to.equal("debug");

        expect(subject.backend.transports.console).to.be.instanceof(winston.transports.Console);
        expect(subject.backend.transports.console.level).to.equal("debug");
      });
    });
  });

  describe(".info", function(){
    it("should forward to the backend method then resolve", function(){
      const subject = new Logger();

      return subject.prepare().then(() => {
        subject.backend.infoAsync = this.sandbox.stub().resolves();

        return expect(subject.info(1, 2, 3)).to.become(undefined).then(() => {
          expect(subject.backend.infoAsync.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });
  });

  describe(".warn", function(){
    it("should forward to the backend method then resolve", function(){
      const subject = new Logger();

      return subject.prepare().then(() => {
        subject.backend.warnAsync = this.sandbox.stub().resolves();

        return expect(subject.warn(1, 2, 3)).to.become(undefined).then(() => {
          expect(subject.backend.warnAsync.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });
  });

  describe(".error", function(){
    it("should forward to the backend method then resolve", function(){
      const subject = new Logger();

      return subject.prepare().then(() => {
        subject.backend.errorAsync = this.sandbox.stub().resolves();

        return expect(subject.error(1, 2, 3)).to.become(undefined).then(() => {
          expect(subject.backend.errorAsync.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });
  });

  describe(".fatal", function(){
    it("should forward to the backend method then exit", function(){
      const subject = new Logger(null, false, false);
      const exitStub = this.sandbox.stub(process, "exit");

      return subject.prepare().then(() => {
        subject.backend.errorAsync = this.sandbox.stub().resolves();

        return expect(subject.fatal(1, 2, 3)).to.become(undefined).then(() => {
          expect(subject.backend.errorAsync.calledWith(1, 2, 3)).to.be.ok;
          expect(exitStub.calledWith(1)).to.be.ok;
        });
      });
    });
  });

  describe(".debug", function(){
    it("should forward to the backend method then resolve", function(){
      Application.debug = true;
      const subject = new Logger();

      return subject.prepare().then(() => {
        subject.backend.debugAsync = this.sandbox.stub().resolves();

        return expect(subject.debug(1, 2, 3)).to.be.fulfilled.then(() => {
          expect(subject.backend.debugAsync.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });

    it("should be a no-op when debug is disabled", function(){
      Application.debug = false;
      const subject = new Logger();

      return subject.prepare(null, true, true).then(() => {
        subject.backend.debugAsync = this.sandbox.stub().resolves();
        subject.useDebug = false;

        return expect(subject.debug(1, 2, 3)).to.be.fulfilled.then(() => {
          expect(subject.backend.debugAsync.called).not.to.be.ok;
        });
      });
    });
  });
});

/* eslint-enable no-unused-expressions, prefer-arrow-callback, no-undefined, no-magic-numbers, no-sync, global-require */

