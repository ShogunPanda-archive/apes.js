/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* tslint:disable:no-invalid-this no-var-requires no-require-imports */

import * as chai from "chai";
import {expect} from "chai";
import * as sinon from "sinon";
import * as express from "express";
import * as http from "http";
import * as https from "https";
import * as path from "path";
import * as fs from "fs-extra";
import * as winston from "winston";

chai.use(require("chai-as-promised"));
chai.use(require("chai-http"));

import Application from "../../lib/application";
import Logger from "../../lib/logger";
import Server from "../../lib/http/server";

const SERVER_DELAY: number = 10;
let basePort = 3010;

declare global {
  namespace ChaiHttp{
    export interface Request{
      redirects(num: number): Request;
      timeout(num: number): Request;
    }
  }
}

describe("HTTP.Server", function(){
  class ServerVerifier extends Server{
    public express: express.Application;
    public sandbox: sinon.SinonSandbox;

    constructor(configurationPath: string = "config/application"){
      super(configurationPath);
      this.configurationPath = path.resolve(__dirname, "../fixtures/configuration.json");
      this.sandbox = sinon.sandbox.create();
    }

    public prepare(): Promise<winston.LoggerInstance | Logger | Error | void>{
      return super.prepare().then(() => this.loadConfiguration()).then(() => {
        this.configuration.httpServer.port = basePort++;

        for(let method of ["info", "warn", "error", "debug"]){
          this.sandbox.stub(this.logger, method).returns(Promise.resolve());
          this.sandbox.stub(this.requestsLogger, method).returns(Promise.resolve());
        }

        return Promise.resolve();
      });
    }

    public execute(): Promise<winston.LoggerInstance | Logger | Error | void>{
      return super.execute();
    }
  }

  beforeEach(function(){
    Application.root = path.resolve(__dirname, "../../");
    Application.processName = "foo";
    Application.environment = "development";
    Application.production = true;

    this.subject = new ServerVerifier();
  });

  afterEach(function(){
    this.subject.sandbox.restore();
  });

  describe(".prepare", function(){
    it("should set the requestsLogger, then prepare express", function(){
      return this.subject.prepare().then(() => {
        expect(this.subject.express).not.to.be.undefined;
        expect(Reflect.get(this.subject.requestsLogger.backend.transports, "file").filename).to.eq("foo-requests-development.log");
      });
    });
  });

  describe(".execute", function(){
    it("should reply to HTTP pings and support connection dropping when quitting", function(done){
      this.subject.sandbox.stub(process, "hrtime").returns([4, 123000]);
      this.subject.sandbox.stub(process, "uptime").returns(123.456789);

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/ping").then(response => {
          expect(response).to.have.header("X-Up-Time", "123456.789ms");
          expect(response).to.have.header("X-Response-Time", "4000.123ms");
          expect(response).to.have.header("Content-Encoding", "gzip");
          expect(Reflect.get(response, "text")).to.equal("pong");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });
  
    it("should close pending connection without blocking when quitting", function(done){
      this.subject.prepare().then(() => this.subject.execute());
    
      const agent = new http.Agent({keepAlive: true, keepAliveMsecs: 3000});
    
      setTimeout(() => {
        http.get({hostname: "127.0.0.1", port: basePort - 1, path: "/ping", agent}, (response) => {
          process.kill(process.pid, "SIGUSR2");
          done();
        });

      }, SERVER_DELAY);
    });
    
    it("should support text response", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req: express.Request, res: express.Response) => this.sendResponse(req, res, 200, "TEXT", [1, 2]));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(response => {
          expect(response).to.have.status(200);
          expect(response).to.be.text;
          expect(Reflect.get(response, "text")).to.equal("TEXT");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support bodyless response", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req: express.Request, res: express.Response) => this.sendResponse(req, res));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(response => {
          expect(response).to.have.status(200);
          expect(Reflect.get(response, "text").length).to.equal(0);

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });
  
    it("should support redirect response", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req: express.Request, res: express.Response) => this.redirectTo(req, res, 301, "https://google.it", [1, 2]));
      };
    
      this.subject.prepare().then(() => this.subject.execute());
    
      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").redirects(0).then(Promise.reject).catch(error => {
          const response = Reflect.get(error, "response");
          expect(response).to.have.status(301);
          expect(response).to.redirectTo("https://google.it");
          
          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });
  
    it("should support redirect response with a default code", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req: express.Request, res: express.Response) => this.redirectTo(req, res, null, "https://google.it"));
      };
    
      this.subject.prepare().then(() => this.subject.execute());
    
      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").redirects(0).then(Promise.reject).catch(error => {
          const response = Reflect.get(error, "response");
          expect(response).to.have.status(302);
          expect(response).to.redirectTo("https://google.it");
        
          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should serve static files", function(done){
      this.subject.addRoutes = function(){
        this.setupStaticFolder(`${__dirname}/../`);
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/fixtures/configuration.json").then(response => {
          expect(response).to.have.status(200);
          expect(response.body).to.eql(require("../fixtures/configuration.json")); // eslint-disable-line global-require

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support CORS", function(done){
      this.subject.addRoutes = function(){
        this.addCORSHandling("foo.com", "X-Header", "PATCH", 123);
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).options("/foo").then(response => {
          expect(response).to.have.status(204);
          expect(response).to.have.header("Access-Control-Allow-Origin", "foo.com");
          expect(response).to.have.header("Access-Control-Allow-Headers", "X-Header");
          expect(response).to.have.header("Access-Control-Allow-Methods", "PATCH");
          expect(response).to.have.header("Access-Control-Max-Age", "123");
          expect(response.body).to.eql({});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support CORS with defaults", function(done){
      this.subject.addRoutes = function(){
        this.addCORSHandling("foo.com");
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).options("/foo").then(response => {
          expect(response).to.have.status(204);
          expect(response).to.have.header("Access-Control-Allow-Origin", "foo.com");
          expect(response).to.have.header("Access-Control-Allow-Headers", "*");
          expect(response).to.have.header("Access-Control-Allow-Methods", "GET, POST");
          expect(response).to.have.header("Access-Control-Max-Age", "31536000");
          expect(response.body).to.eql({});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should disable CORS if no Origin is available", function(done){
      this.subject.addRoutes = function(){
        this.addCORSHandling();
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).options("/foo").then(response => {
          expect(response).to.have.status(204);
          expect(response).not.to.have.header("Access-Control-Allow-Origin");
          expect(response).not.to.have.header("Access-Control-Allow-Headers");
          expect(response).not.to.have.header("Access-Control-Allow-Methods");
          expect(response).not.to.have.header("Access-Control-Max-Age");
          expect(response.body).to.eql({});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle invalid routes", function(done){
      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/invalid").then(null, error => {
          expect(error.response).to.have.header("Content-Type", "application/json; charset=utf-8");
          expect(error.response).to.have.status(404);
          expect(error.response.body).to.eql({errors: [{code: 404, message: "Not Found."}]});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should accept valid JSON POST bodies", function(done){
      this.subject.addRoutes = function(){
        this.express.post("/foo", (req: express.Request, res: express.Response) => this.sendResponse(req, res, 200, req.body));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).post("/foo").set("Content-Type", "application/json").send('[{"1": 2}]')
          .then(response => {
            expect(response).to.have.status(200);
            expect(response).to.be.json;
            expect(response.body).to.eql([{1: 2}]);

            process.kill(process.pid, "SIGUSR2");
            done();
          });
      }, SERVER_DELAY);
    });

    it("should accept valid JSON POST bodies", function(done){
      this.subject.addRoutes = function(){
        this.express.post("/foo", (req: express.Request, res: express.Response) => this.sendResponse(req, res, 200, {ok: true}));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).post("/foo").set("Content-Type", "application/json")
          .then(response => {
            expect(response).to.have.status(200);
            expect(response).to.be.json;

            process.kill(process.pid, "SIGUSR2");
            done();
          });
      }, SERVER_DELAY);
    });

    it("should reject non JSON POST bodies", function(done){
      this.subject.addRoutes = function(){
        this.express.post("/foo", (req: express.Request, res: express.Response) => this.sendResponse(req, res, 200, "OK"));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).post("/foo").send("FOO").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(400);
          expect(error.response.body).to.eql({errors: [{
            code: 400,
            message: "Invalid JSON POST data received.",
            error: "Content-Type header must be match regular expression /^application\\/(.+\\+)?json/ and the data must a valid encoded JSON."
          }]});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should reject malformed JSON POST bodies", function(done){
      this.subject.addRoutes = function(){
        this.express.post("/foo", (req: express.Request, res: express.Response) => this.sendResponse(req, res, 200, "OK"));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).post("/foo").set("Content-Type", "application/json").send("FOO").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(400);
          expect(error.response.body).to.eql({errors: [{
            code: 400,
            message: "Invalid JSON POST data received.",
            error: "Unexpected token F"
          }]});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should reject malformed JSON POST bodies", function(done){
      this.subject.addRoutes = function(){
        this.express.post("/foo", (req: express.Request, res: express.Response) => this.sendResponse(req, res, 200, "OK"));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).post("/foo").set("Content-Type", "application/json").send("FOO").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(400);
          expect(error.response.body).to.eql({errors: [{
            code: 400,
            message: "Invalid JSON POST data received.",
            error: "Unexpected token F"
          }]});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle unexpected errors in production mode", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", () => {
          throw "ERROR!";
        });
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(500);
          expect(error.response.body).to.eql({errors: [{
            code: 500,
            message: "Internal Application Error."
          }]});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle unexpected errors with details in non-production mode", function(done){
      const raisedError = new TypeError("ERROR!");
      raisedError.stack = "1\n2";

      this.subject.addRoutes = function(){
        this.express.get("/foo", () => {
          throw raisedError;
        });
      };

      Application.production = false;
      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(500);
          expect(error.response.body).to.eql({
            type: "TypeError",
            message: "ERROR!",
            stack: ["2"]
          });

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle string errors", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", () => {
          throw "ERROR";
        });
      };

      Application.production = false;
      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(500);
          expect(error.response.body).to.eql({errors: [{code: 500, message: "ERROR"}]});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle custom errors with details in non-production mode", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", () => {
          throw {name: "FOO", message: "BAR"};
        });
      };

      Application.production = false;

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(500);
          expect(error.response.body).to.eql({
            type: "FOO",
            message: "BAR",
            stack: []
          });

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle single error format", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req: express.Request, res: express.Response) => this.sendGeneralError(req, res, 523, "OK", true));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(523);
          expect(error.response.body).to.eql({error: {code: 523, message: "OK"}});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should not blow up when response is already sent", function(done){
      const raisedError = new TypeError("ERROR!");
      raisedError.stack = "1\n2";

      this.subject.addRoutes = function(){
        this.express.get("/foo", (req: express.Request, res: express.Response) => {
          this.sendResponse(req, res, 200, "OK");
          throw "ERROR!";
        });
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(response => {
          expect(response).to.be.text;
          expect(response).to.have.status(200);
          expect(Reflect.get(response, "text")).to.eql("OK");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle listening errors", function(){
      class ListenServerVerifier extends ServerVerifier{
        public prepare(): Promise<any | Error>{
          return super.prepare().then(() => {
            this.configuration.httpServer.port = 1;
          });
        }
      }

      const subject: ListenServerVerifier = new ListenServerVerifier();

      return expect(subject.prepare().then(() => subject.execute())).to.be.rejected
        .then(error => {
          subject.sandbox.restore();
          expect(error.message).to.equal("listen EACCES 0.0.0.0:1");
        });
    });

    it("should handle closing errors", function(){
      setTimeout(() => {
        this.subject.sandbox.stub(this.subject.server, "close").yields("ERROR");
        process.kill(process.pid, "SIGUSR2");
      }, SERVER_DELAY);

      return expect(this.subject.prepare().then(() => this.subject.execute())).to.be.rejected
        .then(error => {
          expect(error).to.equal("ERROR");
        });
    });

    it("should handle SSL certificates", function(){
      const createServerSpy = this.subject.sandbox.spy(https, "createServer");

      setTimeout(() => {
        process.kill(process.pid, "SIGUSR2");
      }, SERVER_DELAY);

      class SSLServerVerifier extends ServerVerifier{
        public loadConfiguration(): Promise<any | Error>{
          return super.loadConfiguration().then(() => {
            this.configuration.httpServer.ssl = {enabled: true, key: "test/fixtures/private-key.pem", certificate: "test/fixtures/certificate.pem"};
          });
        }
      }

      Application.production = false;

      const subject: SSLServerVerifier = new SSLServerVerifier();

      return expect(subject.prepare().then(() => subject.execute())).to.be.fulfilled.then(() => {
        createServerSpy.restore();
        expect(createServerSpy.called).to.be.ok;
      });
    });
  });

  describe(".loadConfiguration", function(){
    it("should set good defaults", function(){
      Application.environment = "development";

      class ConfigurationServerVerifier extends ServerVerifier{
        public loadConfiguration(): Promise<any | Error>{
          return super.loadConfiguration();
        }
      }

      const subject = new ConfigurationServerVerifier();
      return expect(subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(subject.configuration).to.eql({httpServer: {port: 3000, ssl: {enabled: false}}});
      });
    });

    it("should not override the default configuration", function(){
      Application.environment = "env2";

      class ConfigurationServerVerifier extends ServerVerifier{
        public loadConfiguration(): Promise<any | Error>{
          return super.loadConfiguration();
        }
      }

      const subject = new ConfigurationServerVerifier();
      return expect(subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(subject.configuration).to.eql({httpServer: {port: "A", ssl: "B"}});
      });
    });
  });

  describe(".sslConfig", function(){
    it("should attempt to open certificate from default location", function(){
      const readFileSyncStub = this.subject.sandbox.stub(fs, "readFileSync");

      readFileSyncStub.onFirstCall().returns("A");
      readFileSyncStub.onSecondCall().returns("B");

      this.subject.configuration = {httpServer: {ssl: {}}};
      expect(this.subject.sslConfig()).to.eql({key: "A", cert: "B"});
      expect(readFileSyncStub.firstCall.calledWith(`${Application.root}/config/ssl/private-key.pem`)).to.be.ok;
      expect(readFileSyncStub.secondCall.calledWith(`${Application.root}/config/ssl/certificate.pem`)).to.be.ok;
    });
  });
});
