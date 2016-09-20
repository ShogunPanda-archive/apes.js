/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* tslint:disable:no-invalid-this no-var-requires no-require-imports */

import * as chai from "chai";
import {expect} from "chai";
import * as sinon from "sinon";
import * as path from "path";
import * as winston from "winston";

chai.use(require("chai-as-promised"));

process.env.NODE_DEBUG = "apes";

import {Application} from "../lib/application";
import {Logger} from "../lib/logger";

describe("Application", function(){
  class ApplicationVerifier extends Application{
    public prepare(): Promise<winston.LoggerInstance | Error | void>{
      return super.prepare();
    }

    public execute(): Promise<winston.LoggerInstance | Error | void>{
      return super.execute();
    }

    public cleanup(): Promise<winston.LoggerInstance | Error | void>{
      return super.cleanup();
    }
  }

  beforeEach(function(){
    Application.root = path.resolve(__dirname, "../");
    this.subject = new ApplicationVerifier();
  });

  describe(".constructor", function(){
    it("should set some defaults", function(){
      expect(this.subject.configurationPath).to.equal(path.resolve(Application.root, "config/application"));
      expect(this.subject.logger).to.be.instanceof(Logger);
    });

    it("should allow overriding of configurationPath", function(){
      expect(new Application("FOO").configurationPath).to.equal(path.resolve(Application.root, "FOO"));
    });
  });

  describe(".run", function(){
    it("should call the entire chain", function(){
      const exitStub = sinon.stub(process, "exit");
      const loggerStub = sinon.stub(this.subject.logger, "info").returns(Promise.resolve());
      const loadConfigurationStub = sinon.stub(this.subject, "loadConfiguration").returns(Promise.resolve());
      const prepareStub = sinon.stub(this.subject, "prepare").returns(Promise.resolve());
      const executeStub = sinon.stub(this.subject, "execute").returns(Promise.resolve());
      const cleanupStub = sinon.stub(this.subject, "cleanup").returns(Promise.resolve());

      return this.subject.run().then(() => {
        exitStub.restore();
        loggerStub.restore();
        loadConfigurationStub.restore();
        prepareStub.restore();
        executeStub.restore();
        cleanupStub.restore();

        expect(loadConfigurationStub.called).to.be.ok;
        expect(prepareStub.called).to.be.ok;
        expect(executeStub.called).to.be.ok;
        expect(cleanupStub.called).to.be.ok;
        expect(loadConfigurationStub.called).to.be.ok;
        expect(exitStub.calledWith(0)).to.be.ok;

        expect(loggerStub.firstCall.calledWith(`Process ${Application.processName} started as PID ${process.pid} ...`)).to.be.ok;
        expect(loggerStub.secondCall.calledWith("All operations completed. Exiting ...")).to.be.ok;
        expect(loggerStub.thirdCall.calledWith("Process exited without errors.")).to.be.ok;
      });
    });

    it("should handle rejection with logging", function(){
      const promise = Promise.reject("ERROR");

      const exitStub = sinon.stub(process, "exit");
      const fatalStub = sinon.stub(this.subject.logger, "fatal").returns(Promise.resolve());
      const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve());
      const loadConfigurationStub = sinon.stub(this.subject, "loadConfiguration").returns(promise);
      const cleanupStub = sinon.stub(this.subject, "cleanup").returns(promise);

      return expect(this.subject.run()).to.be.rejected.then(error => {
        exitStub.restore();
        fatalStub.restore();
        warnStub.restore();
        cleanupStub.restore();
        loadConfigurationStub.restore();

        expect(exitStub.calledWith(1)).to.be.ok;
        expect(error).to.be.equal("ERROR");
        expect(fatalStub.calledWith("ERROR")).to.be.ok;
        expect(warnStub.calledWith("Process exited with errors.")).to.be.ok;
      });
    });

    it("should handle rejection when logger creation failed", function(){
      const promise = Promise.reject("ERROR");

      const loggerStub = sinon.stub(this.subject.logger, "prepare").returns(promise);
      const errorStub = sinon.stub(console, "error");
      const exitStub = sinon.stub(process, "exit");

      return expect(this.subject.run()).to.be.rejected.then(error => {
        exitStub.restore();
        loggerStub.restore();
        errorStub.restore();

        expect(error).to.eql("ERROR");
        expect(errorStub.calledWith("Cannot create the logger: ERROR. Exiting ...")).to.be.ok;
        expect(exitStub.calledWith(1)).to.be.ok;
      });
    });
  });

  describe(".loadConfiguration", function(){
    it("should load the configuration file and set some attributes", function(){
      Application.environment = "env1";
      this.subject.configurationPath = path.resolve(__dirname, "../test/fixtures/configuration.json");

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration.key).to.eql("value");
      });
    });

    it("should load the configuration file and not fail if the environment is missing", function(){
      Application.environment = "env3";
      this.subject.configurationPath = path.resolve(__dirname, "../test/fixtures/configuration.json");

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration).to.eql({});
      });
    });

    it("should reject in case of parsing error", function(){
      this.subject.configurationPath = path.resolve(Application.root, "/whatever");

      return expect(this.subject.loadConfiguration()).to.be.rejected.then(error => {
        expect(error.message).to.eql("Cannot find module '/whatever'");
      });
    });
  });

  describe(".prepare", function(){
    it("should show a warning about overriding", function(){
      const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve("WARNED"));

      return expect(this.subject.logger.prepare().then(() => this.subject.prepare())).to.become("WARNED").then(() => {
        warnStub.restore();
        expect(warnStub.calledWith("ApplicationVerifier.prepare should override Application.prepare.")).to.be.ok;
      });
    });
  });

  describe(".execute", function(){
    it("should show a warning about overriding", function(){
      const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve("WARNED"));

      return expect(this.subject.logger.prepare().then(() => this.subject.execute())).to.become("WARNED").then(() => {
        warnStub.restore();
        expect(warnStub.calledWith("ApplicationVerifier.execute should override Application.execute.")).to.be.ok;
      });
    });
  });

  describe(".cleanup", function(){
    it("should show a warning about overriding", function(){
      const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve("WARNED"));

      return expect(this.subject.logger.prepare().then(() => this.subject.cleanup())).to.become("WARNED").then(() => {
        warnStub.restore();
        expect(warnStub.calledWith("ApplicationVerifier.cleanup should override Application.cleanup.")).to.be.ok;
      });
    });
  });
});
