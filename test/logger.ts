/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* tslint:disable:no-invalid-this no-var-requires no-require-imports */

import * as chai from "chai";
import {expect} from "chai";
import * as sinon from "sinon";
import * as winston from "winston";
import * as path from "path";

chai.use(require("chai-as-promised"));

import {Application} from "../lib/application";
import {Logger} from "../lib/logger";

declare module "winston"{
  export interface TransportInstance{
    level: string;
  }

  export interface FileTransportInstance {
    filename: string;
    dirname: string;
  }
}

describe("Logger", function(){
  class LoggerVerifier extends Logger{
  }

  beforeEach(function(){
    Application.root = path.resolve(__dirname, "../");
    this.subject = new LoggerVerifier("TARGET", true);
  });

  describe(".constructor", function(){
    it("should save the parameters and create a Raygun logger if asked to", function(){
      expect(this.subject.root).to.be.a("string");
      expect(this.subject.target).to.eql("TARGET");
      expect(this.subject.useConsole).to.be.true;
      expect(this.subject.backend).to.be.undefined;
    });
  });

  describe(".prepare", function(){
    it("should just exit if already prepared", function(){
      this.subject.backend = new winston.Logger({});
      return expect(this.subject.prepare()).to.become(this.subject);
    });

    it("should create the log folder and create the file logger", function(){
      this.subject = new LoggerVerifier("TARGET", false);
      Application.environment = "development";
      Application.debug = false;

      return this.subject.prepare().then(() => {
        expect(Object.keys(this.subject.backend.transports).length).to.equal(1);

        const transport: winston.FileTransportInstance = Reflect.get(this.subject.backend.transports, "file") as winston.FileTransportInstance;
        expect(transport.filename).to.equal("TARGET-development.log");
        expect(transport.dirname).to.equal(`${Application.root}/log`);
        expect(transport.level).to.equal("verbose");
      });
    });

    it("should also create the console logger", function(){
      Application.debug = true;
      this.subject = new LoggerVerifier("TARGET", true);

      return this.subject.prepare().then(() => {
        expect(Object.keys(this.subject.backend.transports).length).to.equal(2);

        const transport: winston.ConsoleTransportInstance = Reflect.get(this.subject.backend.transports, "console") as winston.ConsoleTransportInstance;
        expect(transport.level).to.equal("debug");
      });
    });

    it("should correctly handle promise errors", function(){
      Application.root = "/non/existent";
      this.subject = new LoggerVerifier("TARGET", false);

      return expect(this.subject.prepare()).to.be.rejected.then(error => {
        expect(error.code).to.eql("EACCES");
      });
    });
  });

  describe(".info", function(){
    it("should forward to the backend method then resolve", function(){
      return this.subject.prepare().then(() => {
        const infoAsyncStub = sinon.stub(this.subject.backend, "infoAsync").returns(Promise.resolve());

        return expect(this.subject.info(1, 2, 3)).to.become(undefined).then(() => {
          infoAsyncStub.restore();

          expect(infoAsyncStub.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });
  });

  describe(".warn", function(){
    it("should forward to the backend method then resolve", function(){
      return this.subject.prepare().then(() => {
        const warnAsyncStub = sinon.stub(this.subject.backend, "warnAsync").returns(Promise.resolve());

        return expect(this.subject.warn(1, 2, 3)).to.become(undefined).then(() => {
          warnAsyncStub.restore();

          expect(warnAsyncStub.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });
  });

  describe(".error", function(){
    it("should forward to the backend method then resolve", function(){
      return this.subject.prepare().then(() => {
        const errorAsyncStub = sinon.stub(this.subject.backend, "errorAsync").returns(Promise.resolve());

        return expect(this.subject.error(1, 2, 3)).to.become(undefined).then(() => {
          errorAsyncStub.restore();

          expect(errorAsyncStub.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });
  });

  describe(".fatal", function(){
    it("should forward to the backend method then call process.exit", function(){
      return this.subject.prepare().then(() => {
        const errorAsyncStub = sinon.stub(this.subject.backend, "errorAsync").returns(Promise.resolve());
        const exitStub = sinon.stub(process, "exit");

        return expect(this.subject.fatal(1, 2, 3)).to.become(undefined).then(() => {
          errorAsyncStub.restore();
          exitStub.restore();

          expect(errorAsyncStub.calledWith(1, 2, 3)).to.be.ok;
          expect(exitStub.calledWith(1)).to.be.ok;
        });
      });
    });
  });

  describe(".debug", function(){
    it("should forward to the backend method then resolve", function(){
      return this.subject.prepare().then(() => {
        const debugAsyncStub = sinon.stub(this.subject.backend, "debugAsync").returns(Promise.resolve());

        return expect(this.subject.debug(1, 2, 3)).to.become(undefined).then(() => {
          debugAsyncStub.restore();

          expect(debugAsyncStub.calledWith(1, 2, 3)).to.be.ok;
        });
      });
    });

    it("should be a no-op when debug is disabled", function(){
      return this.subject.prepare().then(() => {
        const debugAsyncStub = sinon.stub(this.subject.backend, "debugAsync").returns(Promise.resolve());
        Application.debug = false;

        return expect(this.subject.debug(1, 2, 3)).to.become(this.subject.backend).then(() => {
          debugAsyncStub.restore();
          expect(debugAsyncStub.callCount).to.eql(0);
        });
      });
    });
  });
});
