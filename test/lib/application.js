/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at https://choosealicense.com/licenses/mit.
 */

/* globals describe, it, beforeEach, afterEach */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, global-require, no-sync */

const expect = require("chai").expect;
const sinon = require("sinon");
const fs = require("fs-extra");

require("sinon-as-promised");

const Application = require("../../lib/application");
const Logger = require("../../lib/logger");

describe("Application", function(){
  beforeEach(function(){
    this.sandbox = sinon.sandbox.create();
    this.subject = Application.create("apes-tests-main");
  });

  afterEach(function(){
    fs.removeSync(`${this.subject.root}/log`);
    this.sandbox.restore();
  });

  describe(".execute", function(){
    it("should correctly create and run an application", async function(){
      const createStub = this.sandbox.spy(Application, "create");
      const runStub = this.sandbox.stub(Application, "run").resolves("OK");

      expect(await Application.execute("apes-tests-main", "MAIN", "/tmp", "PREPARE", "CLEANUP")).to.eql("OK");
      expect(createStub.calledWith("apes-tests-main", "/tmp")).to.be.ok;
      expect(runStub.calledWith(sinon.match.object, "MAIN", "PREPARE", "CLEANUP")).to.be.ok;
    });

    it("should use good defaults", async function(){
      const createStub = this.sandbox.spy(Application, "create");
      const runStub = this.sandbox.stub(Application, "run").resolves("OK");

      expect(await Application.execute(null, "MAIN")).to.eql("OK");
      expect(createStub.calledWith("apes", null)).to.be.ok;
      expect(runStub.calledWith(sinon.match.object, "MAIN", null, null)).to.be.ok;
    });
  });

  describe(".create", function(){
    it("should have good defaults", function(){
      const origEnv = process.env.NODE_ENV;
      const origDebug = process.env.NODE_DEBUG;

      Reflect.deleteProperty(process.env, "NODE_ENV");
      Reflect.deleteProperty(process.env, "NODE_DEBUG");

      const subject = Application.create();
      expect(subject.mainFile).to.equal(require.main.filename);
      expect(subject.root).to.equal(process.cwd());
      expect(subject.processName).to.equal("_mocha");
      expect(subject.packageInfo).to.equal(require("../../package.json"));
      expect(subject.label).to.equal("Apes");
      expect(subject.version).to.match(/\d+\.\d+\.\d+/);
      expect(subject.pid).to.equal(process.pid);
      expect(subject.environment).to.equal("development");
      expect(subject.production).to.be.false;
      expect(subject.debug).to.be.false;

      process.env.NODE_ENV = origEnv;
      process.env.NODE_DEBUG = origDebug;
    });

    it("should correctly get the name", function(){
      process.env.PROCESS_NAME = "PROCESS";

      const subject = Application.create();
      expect(subject.processName).to.equal("PROCESS");
      Reflect.deleteProperty(process.env, "PROCESS_NAME");
    });

    it("should correctly get the environment", function(){
      const origEnv = process.env.NODE_ENV;
      const origDebug = process.env.NODE_DEBUG;

      process.env.NODE_ENV = "production";
      process.env.NODE_DEBUG = "apes,request";

      const subject = Application.create();
      expect(subject.environment).to.equal("production");
      expect(subject.production).to.be.true;
      expect(subject.debug).to.be.true;

      process.env.NODE_ENV = origEnv;
      process.env.NODE_DEBUG = origDebug;
    });

    it("should correctly backfill label and version", function(){
      const subject = Application.create("apes", "/tmp");
      expect(subject.label).to.equal(process.argv[1]);
      expect(subject.version).to.eql("1.0.0");
    });

    it("should set some defaults for the configuration", function(){
      expect(Application.create().configurationRoot).to.equal("apes");
    });

    it("should allow overriding of configurationRoot", function(){
      expect(Application.create("foo").configurationRoot).to.equal("foo");
    });
  });

  describe(".run", function(){
    it("should call the entire chain", async function(){
      const loadConfigurationStub = this.sandbox.stub(Application, "loadConfiguration");
      const infoStub = this.sandbox.stub(Logger, "info").resolves();
      const prepare = this.sandbox.stub().resolves();
      const main = this.sandbox.stub().resolves();
      const cleanup = this.sandbox.stub().resolves();

      this.subject.logger = "OK";
      await Application.run(this.subject, main, prepare, cleanup);

      expect(loadConfigurationStub.called).to.be.ok;
      expect(prepare.called).to.be.ok;
      expect(main.called).to.be.ok;
      expect(cleanup.callCount).to.equal(1);

      expect(infoStub.firstCall.calledWith(sinon.match.any, `Process ${this.subject.processName} started as PID ${this.subject.pid} ...`)).to.be.ok;
      expect(infoStub.secondCall.calledWith(sinon.match.any, "All operations completed. Exiting ...")).to.be.ok;
      expect(infoStub.thirdCall.calledWith(sinon.match.any, "Process exited without errors.")).to.be.ok;
    });

    it("should require at least the main loop and make sure a logger is present", async function(){
      const loadConfigurationStub = this.sandbox.stub(Application, "loadConfiguration");
      const infoStub = this.sandbox.stub(Logger, "info").resolves();
      const errorStub = this.sandbox.stub(Logger, "error").resolves();

      await Application.run(this.subject);

      expect(loadConfigurationStub.called).to.be.ok;
      expect(this.subject.logger).not.to.be.undefined;

      expect(infoStub.firstCall.calledWith(sinon.match.object, `Process ${this.subject.processName} started as PID ${this.subject.pid} ...`)).to.be.ok;
      expect(infoStub.secondCall.calledWith(sinon.match.object, "All operations completed. Exiting ...")).to.be.ok;
      expect(infoStub.thirdCall.calledWith(sinon.match.object, "Process exited without errors.")).to.be.ok;
      expect(errorStub.calledWith(sinon.match.object, "A main loop must be provided.")).to.be.ok;
    });

    it("should handle logging creation failures", async function(){
      const errorStub = this.sandbox.stub(console, "error");
      this.sandbox.stub(Logger, "create").rejects("ERROR");

      try{
        await Application.run(this.subject);
      }catch(error){
        expect(error).to.eql(new Error("ERROR"));
        expect(errorStub.calledWith("Cannot create the logger: Error: ERROR. Exiting ...")).to.be.ok;
      }
    });

    it("should handle rejections with logging and correctly clean up", async function(){
      this.sandbox.stub(console, "error");
      const fatalStub = this.sandbox.stub(Logger, "fatal").resolves();
      const warnStub = this.sandbox.stub(Logger, "warn").resolves();
      const cleanup = this.sandbox.stub().resolves();
      this.sandbox.stub(Application, "loadConfiguration").throws(new Error("ERROR"));

      try{
        await Application.run(this.subject, null, null, cleanup);
      }catch(error){
        expect(error.message).to.be.equal("ERROR");
        expect(fatalStub.calledWith(sinon.match.object, new Error("ERROR"))).to.be.ok;
        expect(warnStub.calledWith(sinon.match.object, "Process exited with errors.")).to.be.ok;
        expect(cleanup.callCount).to.equal(1);
      }
    });
  });

  describe(".loadConfiguration", function(){
    it("should load the configuration file and set some attributes", function(){
      const subject = Application.create("apes-tests-main");
      subject.environment = "env1";

      expect(Application.loadConfiguration(subject)).to.eql({useragent: "AGENT1", port: 123});
    });

    it("should load the configuration file and load the first available environment if the requested one doesn't exist", function(){
      const subject = Application.create("apes-tests-main");
      subject.environment = "env3";

      expect(Application.loadConfiguration(subject)).to.eql({useragent: "AGENT1", port: 123});
    });

    it("should load the configuration file and not fail if no environment is present", function(){
      const subject = Application.create("apes-tests-empty");
      subject.environment = "env3";

      expect(Application.loadConfiguration(subject)).to.eql({});
    });

    it("should reject when the file doesn't contain a object", function(){
      const subject = Application.create("apes-tests-string");

      expect(() => Application.loadConfiguration(subject)).to.throw('The value of the key "apes-tests-string" in package.json must be a object.');
    });
  });
});

/* eslint-enable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, global-require, no-sync */

