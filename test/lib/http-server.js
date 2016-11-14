/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* globals describe, it, beforeEach, afterEach */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, no-undefined, no-sync */

const chai = require("chai");
const sinon = require("sinon");
const fs = require("fs-extra");
const path = require("path");
const http = require("http");

const expect = chai.expect;
chai.use(require("chai-as-promised"));
chai.use(require("chai-http"));
require("sinon-as-promised");

const HTTPServer = require("../../lib/http-server");
const Application = require("../../lib/application");
const Logger = require("../../lib/logger");

const SERVER_DELAY = 20;
let basePort = 3010;

describe("HTTPServer", function(){
  beforeEach(function(){
    Application.processName = "server";
    this.subject = new HTTPServer();
    this.subject.configuration = {httpServer: {port: basePort + 2}};
    this.subject.sanitizeConfiguration();
    basePort += 3;

    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(this.subject.logger, "info");
    this.sandbox.stub(this.subject.logger, "warn");
    this.sandbox.stub(this.subject.logger, "error");
    this.sandbox.stub(this.subject.requestsLogger, "debug");
    this.sandbox.stub(this.subject.requestsLogger, "info");
    this.sandbox.stub(this.subject.requestsLogger, "error");
  });

  afterEach(function(){
    fs.removeSync(`${Application.root}/log`);
    this.sandbox.restore();
  });

  describe(".constructor", function(){
    it("should create a requestsLogger", function(){
      expect(this.subject.requestsLogger).to.be.instanceof(Logger);
    });
  });

  describe(".prepare", function(){
    it("should set the port and the requestsLogger, then prepare express", function(){
      this.subject.configuration = {httpServer: {port: 123}};

      return expect(this.subject.prepare()).to.be.fulfilled.then(() => {
        expect(this.subject.express).to.be.a("function");
        expect(this.subject.port).to.eq(123);
        expect(this.subject.requestsLogger.backend.transports.file.filename).to.match(/^server-requests\.log/);
      });
    });
  });

  describe(".execute", function(){
    it("should reply to HTTP pings and support connection dropping when quitting", function(done){
      Application.production = true;
      Application.hostName = "HOST";

      this.sandbox.stub(process, "hrtime").returns([4, 123000]);
      this.sandbox.stub(process, "uptime").returns(123.456789);

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/ping").then(response => {
          expect(response).to.have.header("X-Served-By", "HOST");
          expect(response).to.have.header("X-Up-Time", "123456.789ms");
          expect(response).to.have.header("X-Response-Time", "4000.123ms");
          expect(response).to.have.header("Content-Encoding", "gzip");
          expect(response.text).to.equal("pong");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should close pending connection without blocking when quitting", function(done){
      this.subject.prepare().then(() => this.subject.execute());

      const agent = new http.Agent({keepAlive: true, keepAliveMsecs: 3000});

      setTimeout(() => {
        http.get({hostname: "127.0.0.1", port: basePort - 1, path: "/ping", agent}, () => {
          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support text response", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req, res) => this.sendResponse(req, res, null, "TEXT", [1, 2]));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(response => {
          expect(response).to.have.status(200);
          expect(response).to.be.text;
          expect(response.text).to.equal("TEXT");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support bodyless response", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req, res) => {
          req.startTime = null;
          this.sendResponse(req, res, 200);
        });
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(response => {
          expect(response).to.have.status(200);
          expect(response.text.length).to.equal(0);

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support redirect response", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req, res) => this.redirectTo(req, res, 301, "https://cision.com", [1, 2]));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").redirects(0).then(Promise.reject).catch(error => {
          expect(error.response).to.have.status(301);
          expect(error.response).to.redirectTo("https://cision.com");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support redirect response with no startTime", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req, res) => {
          req.startTime = null;
          this.redirectTo(req, res, 301, "https://cision.com");
        });
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").redirects(0).then(Promise.reject).catch(error => {
          expect(error.response).to.have.status(301);
          expect(error.response).to.redirectTo("https://cision.com");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should support redirect response with a default code", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req, res) => this.redirectTo(req, res, null, "https://cision.com"));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").redirects(0).then(Promise.reject).catch(error => {
          expect(error.response).to.have.status(302);
          expect(error.response).to.redirectTo("https://cision.com");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should serve static files", function(done){
      this.subject.addRoutes = function(){
        this.setupStaticFolder(`${__dirname}/..`);
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/fixtures/configurations/main.json").then(response => {
          expect(response).to.have.status(200);
          expect(response.body).to.eql(require("../fixtures/configurations/main.json")); // eslint-disable-line global-require

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
          expect(response).to.have.header("Access-Control-Max-Age", 123);
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
      Application.production = true;

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
        this.express.post("/foo", (req, res) => this.sendResponse(req, res, 200, req.body));
      };

      Application.production = false;

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

    it("should accept empty bodies", function(done){
      this.subject.addRoutes = function(){
        this.express.post("/foo", (req, res) => this.sendResponse(req, res, 200, {ok: true}));
      };

      Application.production = true;

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
        this.express.post("/foo", (req, res) => this.sendResponse(req, res, 200, "OK"));
      };

      Application.production = true;

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
        this.express.post("/foo", (req, res) => this.sendResponse(req, res, 200, "OK"));
      };

      Application.production = true;

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
        this.express.post("/foo", (req, res) => this.sendResponse(req, res, 200, "OK"));
      };

      Application.production = true;

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

      Application.production = true;

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(500);
          expect(error.response.body).to.eql({errors: [{
            code: 500,
            message: "Internal Application Error."
          }]});

          expect(this.subject.logger.error.calledWith("ERROR!")).to.be.ok;

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
        this.express.get("/foo", (req, res) => this.sendGeneralError(req, res, 523, "OK", true));
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

    it("should handle single error format", function(done){
      this.subject.addRoutes = function(){
        this.express.get("/foo", (req, res) => this.sendGeneralError(req, res, 523, {first: 1, second: 2}, true));
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(null, error => {
          expect(error.response).to.be.json;
          expect(error.response).to.have.status(523);
          expect(error.response.body).to.eql({error: {code: 523, first: 1, second: 2}});

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should not blow up when response is already sent", function(done){
      const raisedError = new TypeError("ERROR!");
      raisedError.stack = "1\n2";

      this.subject.addRoutes = function(){
        this.express.get("/foo", (req, res) => {
          this.sendResponse(req, res, 200, "OK");
          throw "ERROR!";
        });
      };

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/foo").then(response => {
          expect(response).to.be.text;
          expect(response).to.have.status(200);
          expect(response.text).to.eql("OK");

          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });

    it("should handle listening errors", function(){
      this.subject.configuration = {httpServer: {port: 1}};
      this.subject.sanitizeConfiguration();

      return expect(this.subject.prepare().then(() => this.subject.execute())).to.be.rejected
        .then(error => {
          expect(error.message).to.equal("listen EACCES 0.0.0.0:1");
        });
    });

    it("should handle closing errors", function(){
      this.sandbox.stub(fs, "readFileSync").returns("");

      setTimeout(() => {
        process.kill(process.pid, "SIGUSR2");
        this.sandbox.stub(this.subject.server, "close").yields("ERROR");
      }, SERVER_DELAY);

      return expect(this.subject.prepare().then(() => this.subject.execute())).to.be.rejected
        .then(error => {
          expect(error).to.equal("ERROR");
        });
    });

    it("should handle SSL certificates", function(done){
      Application.root = process.cwd();

      this.subject.configuration = {httpServer:
        {port: basePort++, ssl: {enabled: true, key: "test/fixtures/ssl/server.key", certificate: "test/fixtures/ssl/server.crt"}}
      };

      this.sandbox.stub(process, "hrtime").returns([4, 123000]);
      this.sandbox.stub(process, "uptime").returns(123.456789);

      this.subject.prepare().then(() => this.subject.execute());

      setTimeout(() => {
        chai.request(this.subject.express).get("/ping").then(response => {
          expect(response.text).to.equal("pong");
          process.kill(process.pid, "SIGUSR2");
          done();
        });
      }, SERVER_DELAY);
    });
  });

  describe(".loadConfiguration", function(){
    beforeEach(function(){
      this.subject.configurationPath = path.resolve(process.cwd(), "test/fixtures/configurations/main.json");
    });

    it("should set good defaults", function(){
      Application.environment = "server1";

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration).to.eql({httpServer: {port: 1, ssl: {enabled: "A", key: "B", certificate: "C"}}});
      });
    });

    it("should use legacy configuration", function(){
      Application.environment = "server2";

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration).to.eql({httpServer: {port: 1, ssl: {enabled: "A", key: "B", certificate: "C"}}});
      });
    });

    it("should use the default port", function(){
      Application.environment = "server3";

      return expect(this.subject.loadConfiguration()).to.be.fulfilled.then(() => {
        expect(this.subject.configuration).to.eql({httpServer: {
          port: 21080, ssl: {enabled: false}
        }});
      });
    });
  });

  describe(".sslConfig", function(){
    it("should respect file configuration", function(){
      Application.root = process.cwd();

      this.subject.configuration = {httpServer:
        {port: basePort++, ssl: {enabled: true, key: "test/fixtures/ssl/server.key", certificate: "test/fixtures/ssl/server.crt"}}
      };

      expect(this.subject.sslConfig()).to.eql({
        key: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/ssl/server.key")),
        cert: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/ssl/server.crt"))
      });
    });

    it("should use good defaults", function(){
      const oldRoot = Application.root;
      Application.root = path.resolve(process.cwd(), "test/fixtures/configurations");
      this.subject.configuration = {httpServer: {port: basePort++, ssl: {enabled: true}}};

      expect(this.subject.sslConfig()).to.eql({
        key: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/configurations/config/ssl/private-key.pem")),
        cert: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/configurations/config/ssl/certificate.pem"))
      });

      Application.root = oldRoot;
    });
  });

  describe(".addRoutes", function(){
    it("should show a warning about overriding", function(){
      class MockServer extends HTTPServer{

      }

      const subject = new MockServer();
      const warnStub = sinon.stub(subject.logger, "warn").resolves("WARNED");

      return expect(subject.logger.prepare().then(() => subject.addRoutes())).to.become("WARNED").then(() => {
        warnStub.restore();
        expect(warnStub.calledWith("MockServer.addRoutes should override HTTPServer.addRoutes."));
      });
    });
  });
});

/* eslint-enable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, no-undefined, no-sync */

