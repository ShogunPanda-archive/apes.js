/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* globals describe, it, beforeEach, afterEach */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, global-require, no-sync */

const chai = require("chai");
const sinon = require("sinon");
const fs = require("fs-extra");
const path = require("path");

const expect = chai.expect;
chai.use(require("chai-as-promised"));
require("sinon-as-promised");

const Application = require("../../lib/application");
const Logger = require("../../lib/logger");

describe("Application", function(){
  beforeEach(function(){
    this.sandbox = sinon.sandbox.create();
    this.subject = new Application(path.resolve(process.cwd(), "test/fixtures/configurations/main.json"));
  });

  afterEach(function(){
    fs.removeSync(`${Application.root}/log`);
    this.sandbox.restore();
  });

  describe("global variables", function(){
    it("should have good defaults", function(){
      const origEnv = process.env.NODE_ENV;
      const origDebug = process.env.NODE_DEBUG;

      Reflect.deleteProperty(process.env, "NODE_ENV");
      Reflect.deleteProperty(process.env, "NODE_DEBUG");

      Application.setupGlobalEnvironment();
      expect(Application.mainFile).to.equal(require.main.filename);
      expect(Application.root).to.equal(process.cwd());
      expect(Application.processName).to.equal("_mocha");
      expect(Application.packageInfo).to.equal(require("../../package.json"));
      expect(Application.label).to.equal("Apes");
      expect(Application.version).to.match(/\d+\.\d+\.\d+/);
      expect(Application.pid).to.equal(process.pid);
      expect(Application.environment).to.equal("development");
      expect(Application.production).to.be.false;
      expect(Application.debug).to.be.false;

      process.env.NODE_ENV = origEnv;
      process.env.NODE_DEBUG = origDebug;
    });

    it("should correctly get the name", function(){
      process.env.PROCESS_NAME = "PROCESS";
      Application.setupGlobalEnvironment();
      expect(Application.processName).to.equal("PROCESS");
      Reflect.deleteProperty(process.env, "PROCESS_NAME");
    });

    it("should correctly get the environment", function(){
      const origEnv = process.env.NODE_ENV;
      const origDebug = process.env.NODE_DEBUG;

      process.env.NODE_ENV = "production";
      process.env.NODE_DEBUG = "apes,request";

      Application.setupGlobalEnvironment();
      expect(Application.environment).to.equal("production");
      expect(Application.production).to.be.true;
      expect(Application.debug).to.be.true;

      process.env.NODE_ENV = origEnv;
      process.env.NODE_DEBUG = origDebug;
    });

    it("should correctly backfill label and version", function(){
      Application.setupGlobalEnvironment(path.resolve(__dirname, "../fixtures"));
      expect(Application.label).to.equal(process.argv[1]);
      expect(Application.version).to.eql("1.0.0");
    });
  });

  describe(".constructor", function(){
    it("should set some defaults", function(){
      expect(new Application().configurationPath).to.equal(path.resolve(Application.root, "config/application"));
      expect(this.subject.logger).to.be.instanceof(Logger);
    });

    it("should allow overriding of configurationPath and accept absolute paths", function(){
      expect(new Application("/tmp/foo").configurationPath).to.equal("/tmp/foo");
    });
  });

  describe(".run", function(){
    it("should call the entire chain", function(){
      const exitStub = this.sandbox.stub(process, "exit");
      this.subject.logger.info = this.sandbox.stub().resolves();
      this.subject.loadConfiguration = this.sandbox.stub().resolves();
      this.subject.prepare = this.sandbox.stub().resolves();
      this.subject.execute = this.sandbox.stub().resolves();
      this.subject.cleanup = this.sandbox.stub().resolves();

      return expect(this.subject.run()).to.be.fulfilled.then(() => {
        expect(this.subject.loadConfiguration.called).to.be.ok;
        expect(this.subject.prepare.called).to.be.ok;
        expect(this.subject.execute.called).to.be.ok;
        expect(this.subject.cleanup.callCount).to.equal(1);
        expect(exitStub.calledWith(0)).to.be.ok;

        expect(this.subject.logger.info.firstCall.calledWith(`Process ${Application.processName} started as PID ${Application.pid} ...`)).to.be.ok;
        expect(this.subject.logger.info.secondCall.calledWith("All operations completed. Exiting ...")).to.be.ok;
        expect(this.subject.logger.info.thirdCall.calledWith("Process exited without errors.")).to.be.ok;
      });
    });

    it("should handle logging creation failures", function(){
      const errorStub = this.sandbox.stub(console, "error");
      const exitStub = this.sandbox.stub(process, "exit");
      this.subject.logger.prepare = this.sandbox.stub().rejects("ERROR");

      return expect(this.subject.run()).to.be.rejected.then(error => {
        expect(error).to.eql(new Error("ERROR"));
        expect(errorStub.calledWith("Cannot create the logger: Error: ERROR. Exiting ...")).to.be.ok;
        expect(exitStub.calledWith(1)).to.be.ok;
      });
    });

    it("should handle rejection with logging", function(){
      this.sandbox.stub(console, "error");
      const exitStub = this.sandbox.stub(process, "exit");
      this.subject.logger.fatal = this.sandbox.stub().resolves();
      this.subject.logger.warn = this.sandbox.stub().resolves();
      this.subject.loadConfiguration = this.sandbox.stub().rejects("ERROR");
      this.subject.cleanup = this.sandbox.stub().resolves();


      return expect(this.subject.run()).to.be.rejected.then(error => {
        expect(exitStub.calledWith(1)).to.be.ok;
        expect(error.message).to.be.equal("ERROR");
        expect(this.subject.logger.fatal.calledWith(new Error("ERROR"))).to.be.ok;
        expect(this.subject.logger.warn.calledWith("Process exited with errors.")).to.be.ok;
      });
    });
  });

  describe(".loadConfiguration", function(){
    it("should load the configuration file and set some attributes", function(){
      Application.environment = "env1";
      this.subject.configurationPath = path.resolve(process.cwd(), "test/fixtures/configurations/main.json");

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration).to.eql({useragent: "AGENT1", port: 123});
      });
    });

    it("should load the configuration file and load the first available environment if the requested one doesn't exist", function(){
      Application.environment = "env3";
      this.subject.configurationPath = path.resolve(process.cwd(), "test/fixtures/configurations/main.json");

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration).to.eql({useragent: "AGENT1", port: 123});
      });
    });

    it("should load the configuration file and not fail if no environment is present", function(){
      Application.environment = "env3";
      this.subject.configurationPath = path.resolve(process.cwd(), "test/fixtures/configurations/empty.json");

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration).to.eql({});
      });
    });

    it("should reject when the file doesn't contain a object", function(){
      this.subject.configurationPath = path.resolve(process.cwd(), "test/fixtures/configurations/string.json");

      return expect(this.subject.loadConfiguration()).to.be.rejected.then(error => {
        expect(error.message).to.eql(`File ${this.subject.configurationPath} must contain a JSON object.`);
      });
    });

    it("should reject in case of parsing error", function(){
      this.subject.configurationPath = path.resolve(process.cwd(), "/whatever");

      return expect(this.subject.loadConfiguration()).to.be.rejected.then(error => {
        expect(error.message).to.eql("Cannot find module '/whatever'");
      });
    });
  });

  describe(".prepare", function(){
    it("should show a warning about overriding", function(){
      class MockApplication extends Application{

      }

      const subject = new MockApplication();
      subject.logger.warn = this.sandbox.stub().resolves("WARNED");

      return expect(subject.logger.prepare().then(() => subject.prepare())).to.become("WARNED").then(() => {
        expect(subject.logger.warn.calledWith("MockApplication.prepare should override Application.prepare.")).to.be.ok;
      });
    });
  });

  describe(".execute", function(){
    it("should show a warning about overriding", function(){
      class MockApplication extends Application{

      }

      const subject = new MockApplication();
      subject.logger.warn = this.sandbox.stub().resolves("WARNED");

      return expect(subject.logger.prepare().then(() => subject.execute())).to.become("WARNED").then(() => {
        expect(subject.logger.warn.calledWith("MockApplication.execute should override Application.execute.")).to.be.ok;
      });
    });
  });

  describe(".cleanup", function(){
    it("should show a warning about overriding", function(){
      class MockApplication extends Application{

      }

      const subject = new MockApplication();
      subject.logger.warn = this.sandbox.stub().resolves("WARNED");

      return expect(subject.logger.prepare().then(() => subject.cleanup())).to.become("WARNED").then(() => {
        expect(subject.logger.warn.calledWith("MockApplication.cleanup should override Application.cleanup.")).to.be.ok;
      });
    });
  });
});

/* eslint-enable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, global-require, no-sync */

