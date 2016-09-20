/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */
"use strict";
/* tslint:disable:no-invalid-this no-var-requires no-require-imports */
const chai = require("chai");
const chai_1 = require("chai");
const sinon = require("sinon");
const path = require("path");
chai.use(require("chai-as-promised"));
process.env.NODE_DEBUG = "apes";
const application_1 = require("../lib/application");
const logger_1 = require("../lib/logger");
describe("Application", function () {
    class ApplicationVerifier extends application_1.default {
        prepare() {
            return super.prepare();
        }
        execute() {
            return super.execute();
        }
        cleanup() {
            return super.cleanup();
        }
    }
    beforeEach(function () {
        application_1.default.root = path.resolve(__dirname, "../");
        this.subject = new ApplicationVerifier();
    });
    describe(".constructor", function () {
        it("should set some defaults", function () {
            chai_1.expect(this.subject.configurationPath).to.equal(path.resolve(application_1.default.root, "config/application"));
            chai_1.expect(this.subject.logger).to.be.instanceof(logger_1.default);
        });
        it("should allow overriding of configurationPath", function () {
            chai_1.expect(new application_1.default("FOO").configurationPath).to.equal(path.resolve(application_1.default.root, "FOO"));
        });
    });
    describe(".run", function () {
        it("should call the entire chain", function () {
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
                chai_1.expect(loadConfigurationStub.called).to.be.ok;
                chai_1.expect(prepareStub.called).to.be.ok;
                chai_1.expect(executeStub.called).to.be.ok;
                chai_1.expect(cleanupStub.callCount).to.equal(2);
                chai_1.expect(loadConfigurationStub.called).to.be.ok;
                chai_1.expect(exitStub.calledWith(0)).to.be.ok;
                chai_1.expect(loggerStub.firstCall.calledWith(`Process ${application_1.default.processName} started as PID ${process.pid} ...`)).to.be.ok;
                chai_1.expect(loggerStub.secondCall.calledWith("All operations completed. Exiting ...")).to.be.ok;
                chai_1.expect(loggerStub.thirdCall.calledWith("Process exited without errors.")).to.be.ok;
            });
        });
        it("should handle rejection with logging", function () {
            const promise = Promise.reject("ERROR");
            const exitStub = sinon.stub(process, "exit");
            const fatalStub = sinon.stub(this.subject.logger, "fatal").returns(Promise.resolve());
            const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve());
            const loadConfigurationStub = sinon.stub(this.subject, "loadConfiguration").returns(promise);
            const cleanupStub = sinon.stub(this.subject, "cleanup").returns(promise);
            return chai_1.expect(this.subject.run()).to.be.rejected.then(error => {
                exitStub.restore();
                fatalStub.restore();
                warnStub.restore();
                cleanupStub.restore();
                loadConfigurationStub.restore();
                chai_1.expect(exitStub.calledWith(1)).to.be.ok;
                chai_1.expect(error).to.be.equal("ERROR");
                chai_1.expect(fatalStub.calledWith("ERROR")).to.be.ok;
                chai_1.expect(warnStub.calledWith("Process exited with errors.")).to.be.ok;
            });
        });
        it("should handle rejection when logger creation failed", function () {
            const promise = Promise.reject("ERROR");
            const loggerStub = sinon.stub(this.subject.logger, "prepare").returns(promise);
            const errorStub = sinon.stub(console, "error");
            const exitStub = sinon.stub(process, "exit");
            return chai_1.expect(this.subject.run()).to.be.rejected.then(error => {
                exitStub.restore();
                loggerStub.restore();
                errorStub.restore();
                chai_1.expect(error).to.eql("ERROR");
                chai_1.expect(errorStub.calledWith("Cannot create the logger: ERROR. Exiting ...")).to.be.ok;
                chai_1.expect(exitStub.calledWith(1)).to.be.ok;
            });
        });
    });
    describe(".loadConfiguration", function () {
        it("should load the configuration file and set some attributes", function () {
            application_1.default.environment = "env1";
            this.subject.configurationPath = path.resolve(__dirname, "../test/fixtures/configuration.json");
            return chai_1.expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
                chai_1.expect(this.subject.configuration.key).to.eql("value");
            });
        });
        it("should load the configuration file and not fail if the environment is missing", function () {
            application_1.default.environment = "env3";
            this.subject.configurationPath = path.resolve(__dirname, "../test/fixtures/configuration.json");
            return chai_1.expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
                chai_1.expect(this.subject.configuration).to.eql({});
            });
        });
        it("should reject in case of parsing error", function () {
            this.subject.configurationPath = path.resolve(application_1.default.root, "/whatever");
            return chai_1.expect(this.subject.loadConfiguration()).to.be.rejected.then(error => {
                chai_1.expect(error.message).to.eql("Cannot find module '/whatever'");
            });
        });
    });
    describe(".prepare", function () {
        it("should show a warning about overriding", function () {
            const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve("WARNED"));
            return chai_1.expect(this.subject.logger.prepare().then(() => this.subject.prepare())).to.become("WARNED").then(() => {
                warnStub.restore();
                chai_1.expect(warnStub.calledWith("ApplicationVerifier.prepare should override Application.prepare.")).to.be.ok;
            });
        });
    });
    describe(".execute", function () {
        it("should show a warning about overriding", function () {
            const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve("WARNED"));
            return chai_1.expect(this.subject.logger.prepare().then(() => this.subject.execute())).to.become("WARNED").then(() => {
                warnStub.restore();
                chai_1.expect(warnStub.calledWith("ApplicationVerifier.execute should override Application.execute.")).to.be.ok;
            });
        });
    });
    describe(".cleanup", function () {
        it("should show a warning about overriding", function () {
            const warnStub = sinon.stub(this.subject.logger, "warn").returns(Promise.resolve("WARNED"));
            return chai_1.expect(this.subject.logger.prepare().then(() => this.subject.cleanup())).to.become("WARNED").then(() => {
                warnStub.restore();
                chai_1.expect(warnStub.calledWith("ApplicationVerifier.cleanup should override Application.cleanup.")).to.be.ok;
            });
        });
    });
});
//# sourceMappingURL=application.js.map