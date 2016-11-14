/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

const fs = require("fs-extra");
const path = require("path");
const http = require("http");
const spdy = require("spdy");
const express = require("express");
const compression = require("compression");
const bodyParser = require("body-parser");
const onHeaders = require("on-headers");
const sprintf = require("sprintf-js").sprintf;

const Constants = require("./constants");
const Utils = require("./utils");
const Logger = require("./logger");
const Application = require("./application");


/**
 * A HTTP server template class.
 *
 * @class HTTPServer
 * @extends {Application}
 */
class HTTPServer extends Application{
  /**
   * Profiles server and timing informations to the current request.
   *
   * @static
   * @param {express.Request} req The current request.
   * @param {express.Response} res The current response.
   * @param {express.NextFunction} next The next middleware.
   */
  static profiler(req, res, next){
    const startTime = process.hrtime();
    req.startTime = startTime;

    // When sending headers, add the hostname and the response time.
    onHeaders(res, () => {
      const time = process.hrtime(startTime);

      res.append("X-Served-By", Application.hostName);
      res.append("X-Response-Time", sprintf("%0.3fms", time[0] * Constants.Utils.S_TO_MS + time[1] / Constants.Utils.US_TO_MS));
    });

    next();
  }

  /**
   * Creates a new HTTP server.
   *
   * @param {string} [configurationPath="config/application"] The configuration file path.
   */
  constructor(configurationPath = "config/application"){
    super(configurationPath);
    this.requestsLogger = new Logger(`${Application.processName}-requests`, !Application.production);
  }

  /**
   * Prepares the HTTP server for execution.
   *
   * @returns {Promise<winston.Logger|Logger|Error|void>} The current logger in case of success, the error otherwise.
   */
  async prepare(){
    const validJsonBody = Constants.HTTP.VALID_JSON_BODY;
    this.express = express();
    this.port = parseInt(process.env.PORT || this.configuration.httpServer.port, 0);

    // Add base middlewares and configure Express
    this.express.use(this.constructor.profiler);

    // Add GZIP compression and parse JSON body
    if(Application.production)
      this.express.use(compression({threshold: 0}));

    this.express.use(bodyParser.json({limit: this.configuration.httpServer.maxBodySize, type: req => validJsonBody.test(req.header("Content-Type"))}));

    // Only accept JSON bodies
    this.express.use(bodyParser.text({limit: this.configuration.httpServer.maxBodySize, type: req => !(validJsonBody.test(req.header("Content-Type")))})); // eslint-disable-line no-extra-parens
    this.express.use((req, res, next) => {
      if(typeof req.body === "string" && req.body.length)
        throw new SyntaxError(`Content-Type header must be match regular expression /${validJsonBody.source}/ and the data must a valid encoded JSON.`);

      next();
    });

    // Configure express behavior
    this.express.set("json spaces", Application.production ? 0 : 2);
    this.express.enable("trust proxy");

    // Diagnostic ping
    this.express.get("/ping", (req, res) => {
      res.status(Constants.HTTP.Statuses.OK).set({"Content-Type": "text/plain", "X-Up-Time": `${process.uptime() * Constants.Utils.S_TO_MS}ms`}).end("pong");
    });

    // Add middlewares
    await this.addMiddlewares();

    // Add routes
    await this.addRoutes();

    // Add error handling
    await this.addErrorHandling();

    // Setup logging
    return this.requestsLogger.prepare();
  }

  /**
   * Executes the HTTP server.
   *
   * @returns {void|Error} Nothing in case of success, the error otherwise.
   */
  execute(){
    return new Promise((resolve, reject) => {
      const sockets = new Set();

      // Create a HTTP(s) server - In non development we always start in HTTP since HTTPS is handled by Nginx
      const useSSL = (process.env.SSL || this.configuration.httpServer.ssl.enabled) && !Application.production;
      this.server = useSSL ? spdy.createServer(this.sslConfig(), this.express) : http.createServer(this.express);

      // Listen to the port
      this.server.listen(this.configuration.httpServer.port, () => {
        this.logger.info(`Listening using HTTP${useSSL ? "2" : ""} on port ${this.configuration.httpServer.port}.`);
      });

      // Error handling
      this.server.on("error", reject);

      // Socket tracking to allow to force a shutdown - Otherwise server.close will wait for connection to end.
      this.server.on("connection", socket => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });

      // Handle termination signals
      for(let signal of ["SIGTERM", "SIGINT", "SIGUSR2"]){ // eslint-disable-line prefer-const
        process.removeAllListeners(signal);
        process.on(signal, () => {
          // Terminate all pending sockets
          for(let socket of sockets) // eslint-disable-line prefer-const
            socket.destroy();

          // Terminate the server and exit
          this.server.close(error => { // eslint-disable-line arrow-body-style
            return error ? reject(error) : resolve();
          });
        });
      }
    });
  }

  /**
   * Adds middleware to the Express server. This is reserved for subclasses to override. Default implementation does nothing.
   */
  addMiddlewares(){ // eslint-disable-line class-methods-use-this
    // Default implementation is a no-op since it's optional
  }

  /**
   * Adds routes to the Express server. This is reserved for subclasses to override. Default implementation does nothing.
   *
   * @returns {Promise<winston.Logger>|Error} The backend in case of success, the error otherwise.
   */
  addRoutes(){
    return this.logger.warn(`${this.constructor.name}.addRoutes should override HTTP.Server.addRoutes.`);
  }

  /**
   * Adds error handling to the Express server.
   */
  addErrorHandling(){
    // Default catch all and error handler
    this.express.use((req, res) => {
      this.sendGeneralError(req, res, Constants.HTTP.Statuses.NOT_FOUND, "Not Found.");
    });

    // Error handler for unhandled exceptions
    this.express.use(this.errorHandler.bind(this));
  }

  /**
   * Adds CORS handling to the Express server.
   *
   * @param {string} origin A value for the `Access-Control-Allow-Origin` header. If not provided, will be inferred by requests' `Origin` header.
   * @param {string} headers A value for `Access-Control-Allow-Headers` header. If not provided, `*` will be used.
   * @param {string} methods A value for `Access-Control-Allow-Methods` header. If not provided, only **GET** and **POST** methods will be allowed.
   * @param {string} maxAge A value for `Access-Control-Max-Age` header. If not provided, one **year** will be used.
   */
  addCORSHandling(origin, headers, methods, maxAge){
    this.express.use((req, res, next) => {
      const allowedOrigin = origin || req.header("Origin");

      if(allowedOrigin){
        res.set({
          "Access-Control-Allow-Origin": req.header("Origin") || origin,
          "Access-Control-Allow-Headers": headers || "*",
          "Access-Control-Allow-Methods": methods || "GET, POST",
          "Access-Control-Max-Age": (maxAge || Constants.HTTP.DEFAULT_CORS_MAX_AGE).toString()
        });
      }

      next();
    });

    this.express.options("/:unused*?", (req, res) => {
      res.status(Constants.HTTP.Statuses.NO_CONTENT).end();
    });
  }

  /**
   * Configures Express static file serving.
   *
   * @param {string} dir The folder to use as root for static files.
   * @param {string} root The base folder to get a absolute path for `dir`.
   * @returns {string} The absolute static files folder.
   */
  setupStaticFolder(dir, root = null){
    const final = path.resolve(root || Application.root, dir);
    this.express.use(express.static(final));
    return final;
  }

  /**
   * Loads and parses the configuration file.
   */
  async loadConfiguration(){
    await super.loadConfiguration();
    this.sanitizeConfiguration();
  }

  /**
   * Sanitizes the configuration.
   *
   * @returns {object} The server configuration.
   */
  sanitizeConfiguration(){
    if(!this.configuration.httpServer)
      this.configuration.httpServer = {};

    if(!this.configuration.httpServer.port)
      this.configuration.httpServer.port = this.constructor.defaultPort;

    if(!this.configuration.httpServer.ssl)
      this.configuration.httpServer.ssl = {enabled: false};

    return this.configuration;
  }

  /**
   * Load SSL certificate and key for HTTPS servers.
   *
   * @returns {{key: Buffer, cert: Buffer}} The loaded certificates.
   */
  sslConfig(){
    return {
      key: fs.readFileSync(path.resolve(Application.root, this.configuration.httpServer.ssl.key || "config/ssl/private-key.pem")), // eslint-disable-line no-sync
      cert: fs.readFileSync(path.resolve(Application.root, this.configuration.httpServer.ssl.certificate || "config/ssl/certificate.pem")) // eslint-disable-line no-sync
    };
  }

  /**
   * Replies with a HTTP redirect response to the client.
   *
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP redirect code to use. Defaults to `302`.
   * @param {string} destination The URL where redirect to.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   */
  redirectTo(req, res, code, destination, startTime){
    if(!startTime)
      startTime = req.startTime || process.hrtime();

    if(!code)
      code = Constants.HTTP.Statuses.FOUND;

    this.logRequest(code, req, startTime);
    res.redirect(code, destination);
  }

  /**
   * Sends a response back to the client.
   *
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP response code to use. Defaults to `200`.
   * @param {any} content The data to send back. Strings will set type to be `text/plain`, otherwise `application/json` will be used.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   * @returns {void}
   */
  sendResponse(req, res, code, content, startTime = null){
    if(!startTime)
      startTime = req.startTime || process.hrtime();

    if(!code)
      code = Constants.HTTP.Statuses.OK;

    this.logRequest(code, req, startTime);
    res.status(code);

    if(typeof content === "string")
      res.type("text");

    return content !== null && typeof content !== "undefined" ? res.send(content) : res.end();
  }

  /**
   * Sends a error response back to the client.
   *
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP response code to use. Defaults to `200`.
   * @param {string} message The error message to send back.
   * @param {boolean} single If `true`, error will be wrapped in a `error` key, otherwise it will be wrapped in `errors` key.
   * @returns {void}
   */
  sendGeneralError(req, res, code, message, single = false){
    const body = typeof message === "object" ? Object.assign(message, {code}) : {code, message};
    return this.sendResponse(req, res, code, single ? {error: body} : {errors: [body]});
  }

  /**
   * The Express catch all error handler.
   *
   * @param {Error | string} error The occurred error.
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {express.NextFunction} next The next middleware. This is to comply with Express API, but the middleware is never called.
   * @returns {void}
   */
  errorHandler(error, req, res, next){ // eslint-disable-line no-unused-vars
    const errorStatusCode = Constants.HTTP.Statuses.ERROR;

    if(res.headersSent)
      return false;

    if(error instanceof SyntaxError && req.method === "POST"){ // This is a malformed JSON POST body
      return res.status(Constants.HTTP.Statuses.BAD_REQUEST).json({
        errors: [{
          code: Constants.HTTP.Statuses.BAD_REQUEST,
          message: "Invalid JSON POST data received.",
          error: error.message
        }]
      });
    }

    // Log the error
    this.logger.error(error);

    // On production show a generic message
    if(Application.production)
      return this.sendGeneralError(req, res, errorStatusCode, "Internal Application Error.");

    // If it's a string, don't try to get type and stack
    if(typeof error === "string")
      return this.sendGeneralError(req, res, errorStatusCode, error);

    // Format stack
    const stack = error.stack ? error.stack.split("\n") : [];
    stack.shift();

    return this.sendResponse(req, res, errorStatusCode, {type: error.name, message: error.message, stack: stack.map(s => s.trim().replace(/^at\s/, ""))});
  }

  /**
   * Logs a request using the requestsLogger.
   *
   * @param {number} code The HTTP code sent to the client.
   * @param {express.Request} req The current Express request.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   * @returns {winston.Logger} The requestsLogger backend.
   */
  logRequest(code, req, startTime){
    let method = null;

    switch(Math.floor(code / Constants.HTTP.StatusClasses.SEPARATOR)){
      case Constants.HTTP.StatusClasses.CLIENT_ERROR:
        method = "warn";
        break;
      case Constants.HTTP.StatusClasses.SERVER_ERROR:
        method = "error";
        break;
      case Constants.HTTP.StatusClasses.REDIRECT:
        method = "debug";
        break;
      default:
        method = "info";
        break;
    }

    return this.requestsLogger[method](Object.assign(
      {
        status: code,
        elapsed: Utils.elapsedTime(startTime),
        ip: req.ip.replace(/^::ffff:/, ""),
        method: req.method,
        url: req.url
      },
      req.method === "POST" && !Application.production ? {body: req.body} : {},
      req.extraLogAttributes || {}
    ));
  }
}

HTTPServer.defaultPort = 21080;

/**
  @module {HTTP}
 */
module.exports = HTTPServer;
