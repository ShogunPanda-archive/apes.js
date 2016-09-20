/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */
"use strict";
/* tslint:disable:no-invalid-this no-var-requires no-require-imports */
const chai = require("chai");
const chai_1 = require("chai");
const sinon = require("sinon");
const winston = require("winston");
const path = require("path");
chai.use(require("chai-as-promised"));
const application_1 = require("../lib/application");
const logger_1 = require("../lib/logger");
describe("Logger", function () {
    class LoggerVerifier extends logger_1.default {
    }
    beforeEach(function () {
        application_1.default.root = path.resolve(__dirname, "../");
        this.subject = new LoggerVerifier("TARGET", true);
    });
    describe(".constructor", function () {
        it("should save the parameters and create a Raygun logger if asked to", function () {
            chai_1.expect(this.subject.root).to.be.a("string");
            chai_1.expect(this.subject.target).to.eql("TARGET");
            chai_1.expect(this.subject.useConsole).to.be.true;
            chai_1.expect(this.subject.backend).to.be.undefined;
        });
    });
    describe(".prepare", function () {
        it("should just exit if already prepared", function () {
            this.subject.backend = new winston.Logger({});
            return chai_1.expect(this.subject.prepare()).to.become(this.subject);
        });
        it("should create the log folder and create the file logger", function () {
            this.subject = new LoggerVerifier("TARGET", false);
            application_1.default.environment = "development";
            application_1.default.debug = false;
            return this.subject.prepare().then(() => {
                chai_1.expect(Object.keys(this.subject.backend.transports).length).to.equal(1);
                const transport = Reflect.get(this.subject.backend.transports, "file");
                chai_1.expect(transport.filename).to.equal("TARGET-development.log");
                chai_1.expect(transport.dirname).to.equal(`${application_1.default.root}/log`);
                chai_1.expect(transport.level).to.equal("verbose");
            });
        });
        it("should also create the console logger", function () {
            application_1.default.debug = true;
            this.subject = new LoggerVerifier("TARGET", true);
            return this.subject.prepare().then(() => {
                chai_1.expect(Object.keys(this.subject.backend.transports).length).to.equal(2);
                const transport = Reflect.get(this.subject.backend.transports, "console");
                chai_1.expect(transport.level).to.equal("debug");
            });
        });
        it("should correctly handle promise errors", function () {
            application_1.default.root = "/non/existent";
            this.subject = new LoggerVerifier("TARGET", false);
            return chai_1.expect(this.subject.prepare()).to.be.rejected.then(error => {
                chai_1.expect(error.code).to.eql("EACCES");
            });
        });
    });
    describe(".info", function () {
        it("should forward to the backend method then resolve", function () {
            return this.subject.prepare().then(() => {
                const infoAsyncStub = sinon.stub(this.subject.backend, "infoAsync").returns(Promise.resolve());
                return chai_1.expect(this.subject.info(1, 2, 3)).to.become(undefined).then(() => {
                    infoAsyncStub.restore();
                    chai_1.expect(infoAsyncStub.calledWith(1, 2, 3)).to.be.ok;
                });
            });
        });
    });
    describe(".warn", function () {
        it("should forward to the backend method then resolve", function () {
            return this.subject.prepare().then(() => {
                const warnAsyncStub = sinon.stub(this.subject.backend, "warnAsync").returns(Promise.resolve());
                return chai_1.expect(this.subject.warn(1, 2, 3)).to.become(undefined).then(() => {
                    warnAsyncStub.restore();
                    chai_1.expect(warnAsyncStub.calledWith(1, 2, 3)).to.be.ok;
                });
            });
        });
    });
    describe(".error", function () {
        it("should forward to the backend method then resolve", function () {
            return this.subject.prepare().then(() => {
                const errorAsyncStub = sinon.stub(this.subject.backend, "errorAsync").returns(Promise.resolve());
                return chai_1.expect(this.subject.error(1, 2, 3)).to.become(undefined).then(() => {
                    errorAsyncStub.restore();
                    chai_1.expect(errorAsyncStub.calledWith(1, 2, 3)).to.be.ok;
                });
            });
        });
    });
    describe(".fatal", function () {
        it("should forward to the backend method then call process.exit", function () {
            return this.subject.prepare().then(() => {
                const errorAsyncStub = sinon.stub(this.subject.backend, "errorAsync").returns(Promise.resolve());
                const exitStub = sinon.stub(process, "exit");
                return chai_1.expect(this.subject.fatal(1, 2, 3)).to.become(undefined).then(() => {
                    errorAsyncStub.restore();
                    exitStub.restore();
                    chai_1.expect(errorAsyncStub.calledWith(1, 2, 3)).to.be.ok;
                    chai_1.expect(exitStub.calledWith(1)).to.be.ok;
                });
            });
        });
    });
    describe(".debug", function () {
        it("should forward to the backend method then resolve", function () {
            return this.subject.prepare().then(() => {
                const debugAsyncStub = sinon.stub(this.subject.backend, "debugAsync").returns(Promise.resolve());
                return chai_1.expect(this.subject.debug(1, 2, 3)).to.become(undefined).then(() => {
                    debugAsyncStub.restore();
                    chai_1.expect(debugAsyncStub.calledWith(1, 2, 3)).to.be.ok;
                });
            });
        });
        it("should be a no-op when debug is disabled", function () {
            return this.subject.prepare().then(() => {
                const debugAsyncStub = sinon.stub(this.subject.backend, "debugAsync").returns(Promise.resolve());
                application_1.default.debug = false;
                return chai_1.expect(this.subject.debug(1, 2, 3)).to.become(this.subject.backend).then(() => {
                    debugAsyncStub.restore();
                    chai_1.expect(debugAsyncStub.callCount).to.eql(0);
                });
            });
        });
    });
});
//# sourceMappingURL=logger.js.map