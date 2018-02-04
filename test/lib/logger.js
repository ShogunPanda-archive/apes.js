/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at https://choosealicense.com/licenses/mit.
 */

/* globals describe, it, beforeEach, afterEach */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, no-undefined, no-magic-numbers, no-sync, global-require */

const expect = require("chai").expect;
const sinon = require("sinon");
const winston = require("winston");
const fs = require("fs-extra");

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

  describe(".create", function(){
    it("should create the log folder and create the file logger", async function(){
      Application.debug = false;

      const subject = await Logger.create(Application, "TARGET", false, "/tmp/apes-tests");

      expect(subject.backend).to.be.instanceof(winston.Logger);
      expect(subject.root).to.eql("/tmp/apes-tests/log");
      expect(subject.target).to.eql("/tmp/apes-tests/log/TARGET.log");
      expect(Object.keys(subject.backend.transports).length).to.equal(1);
      expect(subject.backend.transports.file).to.be.instanceof(winston.transports.File);
      expect(subject.backend.transports.file.filename).to.equal("TARGET.log");
      expect(subject.backend.transports.file.dirname).to.equal("/tmp/apes-tests/log");
      expect(subject.backend.transports.file.level).to.equal("verbose");
      expect(subject.backend.transports.console).to.be.undefined;
    });

    it("should also create a console logger", async function(){
      Application.debug = true;

      const subject = await Logger.create(Application, "NAME", true);

      expect(subject.backend).to.be.instanceof(winston.Logger);
      expect(Object.keys(subject.backend.transports).length).to.equal(2);
      expect(subject.backend.transports.file.filename).to.equal("NAME.log");
      expect(subject.backend.transports.file.level).to.equal("debug");

      expect(subject.backend.transports.console).to.be.instanceof(winston.transports.Console);
      expect(subject.backend.transports.console.level).to.equal("debug");
    });
  });

  describe(".info", function(){
    it("should forward to the backend method then resolve", async function(){
      const subject = await Logger.create(Application);

      subject.backend.infoAsync = this.sandbox.stub().resolves();

      await Logger.info(subject, 1, 2, 3);
      expect(subject.backend.infoAsync.calledWith(1, 2, 3)).to.be.ok;
    });
  });

  describe(".warn", function(){
    it("should forward to the backend method then resolve", async function(){
      const subject = await Logger.create(Application);

      subject.backend.warnAsync = this.sandbox.stub().resolves();

      await Logger.warn(subject, 1, 2, 3);
      expect(subject.backend.warnAsync.calledWith(1, 2, 3)).to.be.ok;
    });
  });

  describe(".error", function(){
    it("should forward to the backend method then resolve", async function(){
      const subject = await Logger.create(Application);

      subject.backend.errorAsync = this.sandbox.stub().resolves();

      await Logger.error(subject, 1, 2, 3);
      expect(subject.backend.errorAsync.calledWith(1, 2, 3)).to.be.ok;
    });
  });

  describe(".fatal", function(){
    it("should forward to the backend method then exit", async function(){
      const subject = await Logger.create(Application, null, false, false);
      const exitStub = this.sandbox.stub(process, "exit");

      subject.backend.errorAsync = this.sandbox.stub().resolves();

      await Logger.fatal(subject, 1, 2, 3);
      expect(subject.backend.errorAsync.calledWith(1, 2, 3)).to.be.ok;
      expect(exitStub.calledWith(1)).to.be.ok;
    });
  });

  describe(".debug", function(){
    it("should forward to the backend method then resolve", async function(){
      Application.debug = true;
      const subject = await Logger.create(Application);

      subject.backend.debugAsync = this.sandbox.stub().resolves();

      await Logger.debug(subject, 1, 2, 3);
      expect(subject.backend.debugAsync.calledWith(1, 2, 3)).to.be.ok;
    });

    it("should be a no-op when debug is disabled", async function(){
      Application.debug = false;
      const subject = await Logger.create(Application);

      subject.backend.debugAsync = this.sandbox.stub().resolves();

      await Logger.debug(subject, 1, 2, 3);
      expect(subject.backend.debugAsync.called).not.to.be.ok;
    });
  });
});

/* eslint-enable no-unused-expressions, prefer-arrow-callback, no-undefined, no-magic-numbers, no-sync, global-require */

