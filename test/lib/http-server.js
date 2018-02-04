/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at https://choosealicense.com/licenses/mit.
 */

/* globals describe, it, beforeEach, afterEach */
/* eslint-disable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, no-undefined, no-sync */

const chai = require("chai");
const sinon = require("sinon");
const fs = require("fs-extra");
const path = require("path");
const http = require("http");
const Bluebird = require("bluebird");

const expect = chai.expect;
chai.use(require("chai-http"));
require("sinon-as-promised");

const HTTPServer = require("../../lib/http-server");
const Application = require("../../lib/application");
const Logger = require("../../lib/logger");
const Utils = require("../../lib/utils");

const SERVER_DELAY = 5;
let basePort = 3010;

process.on("SIGUSR2", () => false);

describe("HTTPServer", function(){
  beforeEach(function(){
    basePort += 1;

    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(Logger, "info").resolves();
    this.sandbox.stub(Logger, "warn").resolves();
    this.errorStub = this.sandbox.stub(Logger, "error").resolves();
    this.sandbox.stub(Logger, "debug").resolves();
    this.sandbox.stub(Logger, "fatal").resolves();
  });

  afterEach(function(){
    fs.removeSync(`${Application.root}/log`);
    this.sandbox.restore();
  });

  describe(".execute", function(){
    it("should correctly create and run an application", async function(){
      const applicationCreateStub = this.sandbox.stub(Application, "create").returns("APPLICATION");
      const serverCreateStub = this.sandbox.stub(HTTPServer, "create").resolves("SERVER");
      const runStub = this.sandbox.stub(HTTPServer, "run").resolves("OK");

      expect(await HTTPServer.execute("apes-tests-http-server", "MAIN", "PREPARE", process.cwd())).to.eql("OK");
      expect(applicationCreateStub.calledWith("apes-tests-http-server", process.cwd())).to.be.ok;
      expect(serverCreateStub.calledWith("APPLICATION", "MAIN", "PREPARE")).to.be.ok;
      expect(runStub.calledWith("SERVER")).to.be.ok;
    });

    it("should use good defaults", async function(){
      const createStub = this.sandbox.spy(Application, "create");
      const runStub = this.sandbox.stub(Application, "run").resolves("OK");

      this.sandbox.stub(process, "kill").resolves("OK");
      this.sandbox.stub(Application, "loadConfiguration").returns({httpServer: {}});

      expect(await HTTPServer.execute(null, "MAIN")).to.eql("OK");
      expect(createStub.calledWith("apes", null)).to.be.ok;
      expect(runStub.calledWith(sinon.match.object)).to.be.ok;
    });

    it("should correctly parse the package.json", async function(){
      const applicationCreateStub = this.sandbox.stub(Application, "create").returns("APPLICATION");
      const serverCreateStub = this.sandbox.stub(HTTPServer, "create").resolves("SERVER");
      this.sandbox.stub(Application, "run").resolves("OK");
      this.sandbox.stub(process, "kill").resolves("OK");

      this.sandbox.stub(Application, "loadConfiguration").returns({httpServer: {}});

      expect(await HTTPServer.execute("it.apes.other.http", "MAIN")).to.eql("OK");
      expect(applicationCreateStub.calledWith("it.apes.other", null)).to.be.ok;
      expect(serverCreateStub.calledWith("APPLICATION", "MAIN", null, "http")).to.be.ok;
    });
  });

  describe(".create", function(){
    it("should create a server and setup port, SSL and express", async function(){
      const main = this.sandbox.stub().resolves();
      const prepare = this.sandbox.stub().resolves();

      const application = Application.create("apes-tests-http-server");
      const subject = await HTTPServer.create(application, main, prepare);

      expect(main.called).to.be.ok;
      expect(prepare.called).to.be.ok;
      expect(subject.port).to.eql(1);
      expect(subject.ssl).to.eql({
        key: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/ssl/server.key")),
        cert: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/ssl/server.crt"))
      });
      expect(subject.express).not.to.be.undefined;
      expect(subject.requestsLogger.backend.transports.file.filename).to.match(/^_mocha-requests\.log/);
    });

    it("should use ENV port", async function(){
      process.env.PORT = 123;
      const application = Application.create("apes-tests-http-server");

      const subject = await HTTPServer.create(application);
      expect(subject.port).to.eql(123);
      Reflect.deleteProperty(process.env, "PORT");
    });

    it("should use a default port", async function(){
      process.env.PORT = "INVALID";
      const application = Application.create("apes-tests-http-server");

      const subject = await HTTPServer.create(application);
      expect(subject.port).to.eql(HTTPServer.defaultPort);
      Reflect.deleteProperty(process.env, "PORT");
    });

    it("handle creation error", async function(){
      const errorStub = sinon.stub(console, "error");

      const application = Application.create("apes-tests-http-server");

      try{
        await HTTPServer.create(application, null, null, "none");
      }catch(error){
        expect(errorStub.calledWith(
          'Cannot create the HTTP Server: TypeError: The value of the key "apes-tests-http-server.none" in package.json must be a object.. Exiting ...'
        )).to.be.ok;
      }
    });
  });

  describe(".run", function(){
    beforeEach(function(){
      this.application = Application.create("apes-tests-http-server");
      this.application.packageInfo = Object.assign({"apes-tests-http-server": {only: {httpServer: {port: basePort++}}}});
    });

    it("should reply to HTTP pings and support connection dropping when quitting", async function(){
      this.application.production = true;
      this.application.hostName = "HOST";

      this.sandbox.stub(process, "hrtime").returns([4, 123000]);
      this.sandbox.stub(process, "uptime").returns(123.456789);

      const subject = await HTTPServer.create(this.application);
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).get("/ping");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.header("X-Served-By", "HOST");
      expect(response).to.have.header("X-Up-Time", "123456.789ms");
      expect(response).to.have.header("X-Response-Time", "4000.123ms");
      expect(response).to.have.header("Content-Encoding", "gzip");
      expect(response.text).to.equal("pong");
    });

    it("should close pending connection without blocking when quitting", async function(){
      const subject = await HTTPServer.create(this.application);
      HTTPServer.run(subject);

      const agent = new http.Agent({keepAlive: true, keepAliveMsecs: 3000});

      await Utils.delay(SERVER_DELAY);
      await Bluebird.fromCallback(cb => http.get({hostname: "127.0.0.1", port: subject.port, path: "/ping", agent}, () => cb()));
      process.kill(process.pid, "SIGUSR2");
    });

    it("should support text response", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => HTTPServer.sendResponse(server, req, res, null, "TEXT", [1, 2]));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).get("/foo");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(200);
      expect(response).to.be.text;
      expect(response.text).to.equal("TEXT");
    });

    it("should support bodyless response", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => {
          req.startTime = null;
          HTTPServer.sendResponse(server, req, res, 200);
        });
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).get("/foo");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(200);
      expect(response.text.length).to.equal(0);
    });

    it("should support redirect response", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => HTTPServer.redirectTo(server, req, res, 301, "https://cowtech.it", [1, 2]));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo").redirects(0).then(Promise.reject);
      }catch(error){
        process.kill(process.pid, "SIGUSR2");
        expect(error.response).to.have.status(301);
        expect(error.response).to.redirectTo("https://cowtech.it");
      }
    });

    it("should support redirect response with no startTime", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => {
          req.startTime = null;
          HTTPServer.redirectTo(server, req, res, 301, "https://cowtech.it");
        });
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo").redirects(0).then(Promise.reject);
      }catch(error){
        process.kill(process.pid, "SIGUSR2");
        expect(error.response).to.have.status(301);
        expect(error.response).to.redirectTo("https://cowtech.it");
      }
    });

    it("should support redirect response with a default code", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => HTTPServer.redirectTo(server, req, res, null, "https://cowtech.it"));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo").redirects(0).then(Promise.reject);
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.have.status(302);
        expect(error.response).to.redirectTo("https://cowtech.it");
      }
    });

    it("should serve static files", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        HTTPServer.setupStaticFolder(server, `${__dirname}/../..`);
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      const response = await chai.request(subject.express).get("/package.json");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(200);
      expect(response.body).to.eql(require("../../package.json")); // eslint-disable-line global-require
    });

    it("should support CORS", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        HTTPServer.addCORSHandling(server, "foo.com", "X-Header", "PATCH", 123);
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).options("/foo");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(204);
      expect(response).to.have.header("Access-Control-Allow-Origin", "foo.com");
      expect(response).to.have.header("Access-Control-Allow-Headers", "X-Header");
      expect(response).to.have.header("Access-Control-Allow-Methods", "PATCH");
      expect(response).to.have.header("Access-Control-Max-Age", 123);
      expect(response.body).to.eql({});
    });

    it("should support CORS with defaults", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        HTTPServer.addCORSHandling(server, "foo.com");
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).options("/foo");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(204);
      expect(response).to.have.header("Access-Control-Allow-Origin", "foo.com");
      expect(response).to.have.header("Access-Control-Allow-Headers", "Content-Type");
      expect(response).to.have.header("Access-Control-Allow-Methods", "GET, POST");
      expect(response).to.have.header("Access-Control-Max-Age", "31536000");
      expect(response.body).to.eql({});
    });

    it("should disable CORS if no Origin is available", async function(){
      const subject = await HTTPServer.create(this.application, server => {
        HTTPServer.addCORSHandling(server);
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).options("/foo");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(204);
      expect(response).not.to.have.header("Access-Control-Allow-Origin");
      expect(response).not.to.have.header("Access-Control-Allow-Headers");
      expect(response).not.to.have.header("Access-Control-Allow-Methods");
      expect(response).not.to.have.header("Access-Control-Max-Age");
      expect(response.body).to.eql({});
    });

    it("should handle invalid routes", async function(){
      this.application.production = true;
      const subject = await HTTPServer.create(this.application);
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/invalid");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.have.header("Content-Type", "application/json; charset=utf-8");
        expect(error.response).to.have.status(404);
        expect(error.response.body).to.eql({errors: [{code: 404, message: "Not Found."}]});
      }
    });

    it("should accept valid JSON POST bodies", async function(){
      this.application.production = false;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.post("/foo", (req, res) => HTTPServer.sendResponse(server, req, res, 200, req.body));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).post("/foo").set("Content-Type", "application/json").send('[{"1": 2}]');
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(200);
      expect(response).to.be.json;
      expect(response.body).to.eql([{1: 2}]);
    });

    it("should accept empty bodies", async function(){
      this.application.production = true;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.post("/foo", (req, res) => HTTPServer.sendResponse(server, req, res, 200, {ok: true}));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);
      const response = await chai.request(subject.express).post("/foo").set("Content-Type", "application/json");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.have.status(200);
      expect(response).to.be.json;
    });

    it("should reject non JSON POST bodies", async function(){
      this.application.production = true;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.post("/foo", (req, res) => HTTPServer.sendResponse(server, req, res, 200, "OK"));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).post("/foo").send("FOO");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");
        expect(error.response).to.be.json;
        expect(error.response).to.have.status(400);
        expect(error.response.body).to.eql({errors: [{
          code: 400,
          message: "Invalid JSON POST data received.",
          error: "Content-Type header must be match regular expression /^application\\/(.+\\+)?json/ and the data must a valid encoded JSON."
        }]});
      }
    });

    it("should reject malformed JSON POST bodies", async function(){
      this.application.production = true;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.post("/foo", (req, res) => HTTPServer.sendResponse(server, req, res, 200, "OK"));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).post("/foo").set("Content-Type", "application/json").send("FOO");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");
        expect(error.response).to.be.json;
        expect(error.response).to.have.status(400);
        expect(error.response.body).to.eql({errors: [{
          code: 400,
          message: "Invalid JSON POST data received.",
          error: "Unexpected token F"
        }]});
      }
    });

    it("should reject malformed JSON POST bodies", async function(){
      this.application.production = true;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.post("/foo", (req, res) => HTTPServer.sendResponse(server, req, res, 200, "OK"));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).post("/foo").set("Content-Type", "application/json").send("FOO");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");
        expect(error.response).to.be.json;
        expect(error.response).to.have.status(400);
        expect(error.response.body).to.eql({errors: [{
          code: 400,
          message: "Invalid JSON POST data received.",
          error: "Unexpected token F"
        }]});
      }
    });

    it("should handle unexpected errors in production mode", async function(){
      this.application.production = true;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", () => {
          throw "ERROR!";
        });
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.be.json;
        expect(error.response).to.have.status(500);
        expect(error.response.body).to.eql({errors: [{
          code: 500,
          message: "Internal Application Error."
        }]});

        expect(this.errorStub.calledWith(sinon.match.object, "ERROR!")).to.be.ok;
      }
    });

    it("should handle unexpected errors with details in non-production mode", async function(){
      this.application.production = false;

      const raisedError = new TypeError("ERROR!");
      raisedError.stack = "1\n2";

      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", () => {
          throw raisedError;
        });
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.be.json;
        expect(error.response).to.have.status(500);
        expect(error.response.body).to.eql({
          type: "TypeError",
          message: "ERROR!",
          stack: ["2"]
        });
      }
    });

    it("should handle string errors", async function(){
      this.application.production = false;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", () => {
          throw "ERROR";
        });
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.be.json;
        expect(error.response).to.have.status(500);
        expect(error.response.body).to.eql({errors: [{code: 500, message: "ERROR"}]});
      }
    });

    it("should handle custom errors with details in non-production mode", async function(){
      this.application.production = false;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", () => {
          throw {name: "FOO", message: "BAR"};
        });
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.be.json;
        expect(error.response).to.have.status(500);
        expect(error.response.body).to.eql({
          type: "FOO",
          message: "BAR",
          stack: []
        });
      }
    });

    it("should handle single error format with string errors", async function(){
      this.application.production = false;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => HTTPServer.sendGeneralError(server, req, res, 523, "OK", true));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.be.json;
        expect(error.response).to.have.status(523);
        expect(error.response.body).to.eql({error: {code: 523, message: "OK"}});
      }
    });

    it("should handle single error format with objects", async function(){
      this.application.production = false;

      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => HTTPServer.sendGeneralError(server, req, res, 523, {first: 1, second: 2}, true));
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      try{
        await chai.request(subject.express).get("/foo");
      }catch(error){
        process.kill(process.pid, "SIGUSR2");

        expect(error.response).to.be.json;
        expect(error.response).to.have.status(523);
        expect(error.response.body).to.eql({error: {code: 523, first: 1, second: 2}});
      }
    });

    it("should not blow up when response is already sent", async function(){
      this.application.production = false;

      const raisedError = new TypeError("ERROR!");
      raisedError.stack = "1\n2";

      const subject = await HTTPServer.create(this.application, server => {
        server.express.get("/foo", (req, res) => {
          HTTPServer.sendResponse(server, req, res, 200, "OK");
          throw "ERROR!";
        });
      });
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      const response = await chai.request(subject.express).get("/foo");
      process.kill(process.pid, "SIGUSR2");

      expect(response).to.be.text;
      expect(response).to.have.status(200);
      expect(response.text).to.eql("OK");
    });

    it("should handle listening errors", async function(){
      this.application.packageInfo["apes-tests-http-server"].only.httpServer.port = 1;

      const subject = await HTTPServer.create(this.application);

      try{
        await HTTPServer.run(subject);
      }catch(error){
        expect(error.message).to.equal("listen EACCES 0.0.0.0:1");
      }
    });

    it("should handle closing errors", async function(){
      const subject = await HTTPServer.create(this.application);

      setTimeout(() => {
        process.kill(process.pid, "SIGUSR2");
        this.sandbox.stub(subject.server, "close").yields("ERROR");
      }, SERVER_DELAY);

      try{
        await HTTPServer.run(subject);
      }catch(error){
        expect(error).to.equal("ERROR");
      }
    });

    it("should handle SSL certificates", async function(){
      this.application.packageInfo["apes-tests-http-server"].only.httpServer.ssl = {
        enabled: true, key: "test/fixtures/ssl/server.key", certificate: "test/fixtures/ssl/server.crt"
      };

      const subject = await HTTPServer.create(this.application);
      HTTPServer.run(subject);

      await Utils.delay(SERVER_DELAY);

      const response = await chai.request(subject.express).get("/ping");
      process.kill(process.pid, "SIGUSR2");

      expect(response.text).to.equal("pong");
    });
  });

  describe("._loadConfiguration (private)", function(){
    beforeEach(function(){
      this.application = Application.create("apes-tests-http-server");
    });

    it("should set good defaults", function(){
      this.application.environment = "server1";

      expect(HTTPServer._loadConfiguration(this.application)).to.eql({
        port: 1, ssl: {enabled: true, certificate: "test/fixtures/ssl/server.crt", key: "test/fixtures/ssl/server.key"}
      });
    });

    it("should reject when the file doesn't contain a object", function(){
      this.application.environment = "server2";

      expect(() => HTTPServer._loadConfiguration(this.application))
        .to.throw('The value of the key "apes-tests-http-server.httpServer" in package.json must be a object.');
    });

    it("should use the default port and good SSL defaults", function(){
      this.application.environment = "server3";

      expect(HTTPServer._loadConfiguration(this.application)).to.eql({port: HTTPServer.defaultPort, ssl: {enabled: false}});
    });

    it("should support other root key", function(){
      expect(HTTPServer._loadConfiguration(this.application, "other")).to.eql({port: 1234, ssl: {enabled: false}});

      expect(() => HTTPServer._loadConfiguration(this.application, "other2"))
        .to.throw('The value of the key "apes-tests-http-server.other2" in package.json must be a object.');
    });
  });

  describe("._loadSSL (private)", function(){
    it("should respect file configuration", function(){
      const application = Application.create("apes-tests-http-server");
      const configuration = {ssl: {enabled: true, key: "test/fixtures/ssl/server.key", certificate: "test/fixtures/ssl/server.crt"}};

      expect(HTTPServer._loadSSL(application, configuration)).to.eql({
        key: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/ssl/server.key")),
        cert: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/ssl/server.crt"))
      });
    });

    it("should use good defaults", function(){
      const application = Application.create("apes-tests-http-server");
      const configuration = {ssl: {enabled: true}};

      application.root = path.resolve(application.root, "test/fixtures");

      expect(HTTPServer._loadSSL(application, configuration)).to.eql({
        key: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/config/ssl/private-key.pem")),
        cert: fs.readFileSync(path.resolve(process.cwd(), "test/fixtures/config/ssl/certificate.pem"))
      });
    });
  });
});

/* eslint-enable no-unused-expressions, prefer-arrow-callback, no-magic-numbers, max-statements, no-undefined, no-sync */

