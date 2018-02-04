/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at https://choosealicense.com/licenses/mit.
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
 * A module to easily create a Express HTTP server with a defined environment and a default logger based on [Winston](http://npmjs.com/package/winston).
 *
 * @namespace HTTPServer
 */
const HTTPServer = {
  /**
   * The default HTTP port.
   */
  defaultPort: 21080,

  /**
   * Creates and executes a new HTTP server. It's basically a short hand for {@link HTTPServer.create} followed by {@link HTTPServer.run}.
   *
   * @param {string} configurationRoot A root key in `package.json` holding application configuration. The notation is `ROOT.HTTP`, where `ROOT`
   *   is the top level key and `HTTP` is the part holding HTTP settings. The default is `apes.httpServer`.
   * @param {Function} [main=null] A function that will define application routes. It will receive the server as the only argument.
   * @param {Function} [prepare=null] A optional function that can setup additional middlewares or express behavior before routes definition.
   *   It will receive the server as the only argument.
   * @param {string} [root=null] The root directory of the application.
   * @returns {Promise<void|Error>} Nothing in case of success, the error otherwise.
   */
  async execute(configurationRoot, main, prepare = null, root = null){
    if(Utils.isEmptyString(configurationRoot))
      configurationRoot = "apes";

    configurationRoot = configurationRoot.split(".");

    const httpConfigurationRoot = configurationRoot.length > 1 ? configurationRoot.pop() : "httpServer";
    const application = Application.create(configurationRoot.join("."), root);
    const server = await HTTPServer.create(application, main, prepare, httpConfigurationRoot);
    return HTTPServer.run(server);
  },

  /**
   * Creates a HTTP server.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @param {Function} [main=null] A function that will define application routes. It will receive the server as the only argument.
   * @param {Function} [prepare=null] A optional function that can setup additional middlewares or express behavior before routes definition.
   *   It will receive the server as the only argument.
   * @param {string} [httpConfigurationRoot="httpServer"] The key in the application configuration holding HTTP server settings.
   *   is the top level key and `HTTP` is the part holding HTTP settings. The default is `apes.httpServer`.
   * @returns {Promise<object>} A server object.
   */
  async create(application, main, prepare, httpConfigurationRoot = "httpServer"){
    try{
      const configuration = HTTPServer._loadConfiguration(application, httpConfigurationRoot);

      const rv = {
        application,
        httpConfigurationRoot,
        configuration,
        ssl: HTTPServer._loadSSL(application, configuration),
        express: express(),
        requestsLogger: await Logger.create(application, `${application.processName}-requests`, !application.production)
      };

      // Configure Express behavior for JSON handling
      HTTPServer._configureExpress(rv);

      // Diagnostic ping
      rv.express.get("/ping", (req, res) => {
        res.status(Constants.HTTP.Statuses.OK).set({"Content-Type": "text/plain", "X-Up-Time": `${process.uptime() * Constants.Utils.S_TO_MS}ms`}).end("pong");
      });

      // Add the server flow
      if(typeof prepare === "function")
        await prepare(rv);

      if(typeof main === "function")
        await main(rv);

      await HTTPServer.addErrorHandling(rv);

      return rv;
    }catch(e){
      console.error(`Cannot create the HTTP Server: ${e}. Exiting ...`);
      return Promise.reject(e);
    }
  },

  /**
   * Runs the HTTP server.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @returns {Promise<void|Error>} Nothing in case of success, the error otherwise.
   */
  run(server){
    let exitSignal = 0;

    return Application.run(server.application, () => new Promise(
      (resolve, reject) => {
        const sockets = new Set();

        // Create a HTTP(s) server - In non development we always start in HTTP since HTTPS is handled by Nginx
        const listener = server.ssl ? spdy.createServer(server.ssl, server.express) : http.createServer(server.express);
        server.server = listener;

        // Listen to the port
        listener.listen(server.port, () => {
          Logger.info(server.application.logger, `Listening using HTTP${server.ssl ? "2" : ""} on port ${server.configuration.port}.`);
        });

        // Error handling
        listener.on("error", reject);

        // Socket tracking to allow to force a shutdown - Otherwise server.close will wait for connection to end.
        listener.on("connection", socket => {
          sockets.add(socket);
          socket.on("close", () => sockets.delete(socket));
        });

        // Handle termination signals
        for(let signal of ["SIGTERM", "SIGINT", "SIGUSR2"]){ // eslint-disable-line prefer-const
          process.prependOnceListener(signal, () => { // eslint-disable-line no-loop-func
            exitSignal = signal;

            for(let socket of sockets) // eslint-disable-line prefer-const
              socket.destroy();

            // Terminate the server and exit
            listener.close(error => { // eslint-disable-line arrow-body-style
              return error ? reject(error) : resolve();
            });
          });
        }
      }
    )).then(() => process.kill(process.pid, exitSignal));
  },

  /**
   * Profiles server and timing informations to the current request.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {express.Request} req The current request.
   * @param {express.Response} res The current response.
   * @param {express.NextFunction} next The next middleware.
   */
  profiler(server, req, res, next){
    const startTime = process.hrtime();
    req.startTime = startTime;

    // When sending headers, add the hostname and the response time.
    onHeaders(res, () => {
      const time = process.hrtime(startTime);

      res.append("X-Served-By", server.application.hostName);
      res.append("X-Response-Time", sprintf("%0.3fms", time[0] * Constants.Utils.S_TO_MS + time[1] / Constants.Utils.US_TO_MS));
    });

    next();
  },

  /**
   * Adds error handling to the Express server.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   */
  addErrorHandling(server){
    // Default catch all and error handler
    server.express.use((req, res) => HTTPServer.sendGeneralError(server, req, res, Constants.HTTP.Statuses.NOT_FOUND, "Not Found."));
    // Error handler for unhandled exceptions
    server.express.use((error, req, res, next) => HTTPServer.errorHandler(server, error, req, res)); // eslint-disable-line no-unused-vars
  },

  /**
   * Adds CORS handling to the Express server.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {string} origin A value for the `Access-Control-Allow-Origin` header. If not provided, will be inferred by requests' `Origin` header.
   * @param {string} headers A value for `Access-Control-Allow-Headers` header. If not provided, `Content-Type` will be used.
   * @param {string} methods A value for `Access-Control-Allow-Methods` header. If not provided, only **GET** and **POST** methods will be allowed.
   * @param {string} maxAge A value for `Access-Control-Max-Age` header. If not provided, one **year** will be used.
   */
  addCORSHandling(server, origin, headers, methods, maxAge){
    server.express.use((req, res, next) => {
      const allowedOrigin = origin || req.header("Origin") || req.header("origin");

      if(allowedOrigin){
        res.set({
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Headers": headers || "Content-Type",
          "Access-Control-Allow-Methods": methods || "GET, POST",
          "Access-Control-Max-Age": (maxAge || Constants.HTTP.DEFAULT_CORS_MAX_AGE).toString()
        });
      }

      next();
    });

    server.express.options("/:unused*?", (req, res) => res.status(Constants.HTTP.Statuses.NO_CONTENT).end());
  },

  /**
   * Configures Express static file serving.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {string} dir The folder to use as root for static files.
   * @param {string} root The base folder to get a absolute path for `dir`.
   * @returns {string} The absolute static files folder.
   */
  setupStaticFolder(server, dir, root = null){
    const final = path.resolve(root || server.application.root, dir);
    server.express.use(express.static(final));
    return final;
  },

  /**
   * Replies with a HTTP redirect response to the client.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP redirect code to use. Defaults to `302`.
   * @param {string} destination The URL where redirect to.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   */
  redirectTo(server, req, res, code, destination, startTime){
    if(!startTime)
      startTime = req.startTime || process.hrtime();

    if(!code)
      code = Constants.HTTP.Statuses.FOUND;

    HTTPServer.logRequest(server, code, req, startTime);
    res.redirect(code, destination);
  },

  /**
   * Sends a response back to the client.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP response code to use. Defaults to `200`.
   * @param {any} content The data to send back. Strings will set type to be `text/plain`, otherwise `application/json` will be used.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   * @returns {void}
   */
  sendResponse(server, req, res, code, content, startTime = null){
    if(!startTime)
      startTime = req.startTime || process.hrtime();

    if(!code)
      code = Constants.HTTP.Statuses.OK;

    HTTPServer.logRequest(server, code, req, startTime);
    res.status(code);

    if(typeof content === "string")
      res.type("text");

    return content !== null && typeof content !== "undefined" ? res.send(content) : res.end();
  },

  /**
   * Sends a error response back to the client.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP response code to use. Defaults to `200`.
   * @param {string} message The error message to send back.
   * @param {boolean} single If `true`, error will be wrapped in a `error` key, otherwise it will be wrapped in `errors` key.
   * @returns {void}
   */
  sendGeneralError(server, req, res, code, message, single = false){
    const body = typeof message === "object" ? Object.assign(message, {code}) : {code, message};
    return HTTPServer.sendResponse(server, req, res, code, single ? {error: body} : {errors: [body]});
  },

  /**
   * The Express catch all error handler.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {Error | string} error The occurred error.
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @returns {void}
   */
  errorHandler(server, error, req, res){
    const errorStatusCode = Constants.HTTP.Statuses.ERROR;

    if(res.headersSent)
      return false;

    if(error instanceof SyntaxError && req.method === "POST"){ // This is a malformed JSON POST body
      return res.status(Constants.HTTP.Statuses.BAD_REQUEST).json({
        errors: [{code: Constants.HTTP.Statuses.BAD_REQUEST, message: "Invalid JSON POST data received.", error: error.message}]
      });
    }

    // Log the error
    Logger.error(server.application.logger, error);

    // On production show a generic message
    if(server.application.production)
      return HTTPServer.sendGeneralError(server, req, res, errorStatusCode, "Internal Application Error.");

    // If it's a string, don't try to get type and stack
    if(typeof error === "string")
      return HTTPServer.sendGeneralError(server, req, res, errorStatusCode, error);

    // Format stack
    const stack = error.stack ? error.stack.split("\n") : [];
    stack.shift();

    return HTTPServer.sendResponse(
      server, req, res, errorStatusCode,
      {type: error.name, message: error.message, stack: stack.map(s => s.trim().replace(/^at\s/, ""))}
    );
  },

  /**
   * Logs a request using the requestsLogger.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @param {number} code The HTTP code sent to the client.
   * @param {express.Request} req The current Express request.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   * @returns {Promise<winston.Logger|Error>} The winston backend success result or a error.
   */
  logRequest(server, code, req, startTime){
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

    return Logger[method](server.requestsLogger, Object.assign(
      {
        status: code,
        elapsed: Utils.elapsedTime(startTime),
        ip: req.ip.replace(/^::ffff:/, ""),
        method: req.method,
        url: req.url
      },
      req.method === "POST" && !server.application.production ? {body: req.body} : {},
      req.extraLogAttributes || {}
    ));
  },

  /**
   * Loads the HTTP Server configuration. The configuration should be stored in the `httpServer` key in the application configuration.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @param {string} [httpConfigurationRoot="httpServer"] The key in the application configuration holding HTTP server settings.
   *   is the top level key and `HTTP` is the part holding HTTP settings. The default is `apes.httpServer`.
   * @returns {object} A HTTP server object configuration.
   * @private
   */
  _loadConfiguration(application, httpConfigurationRoot = "httpServer"){
    application.configuration = Application.loadConfiguration(application);
    const configuration = Utils.clone(application.configuration[httpConfigurationRoot] || {});

    if(typeof configuration !== "object")
      throw new TypeError(`The value of the key "${application.configurationRoot}.${httpConfigurationRoot}" in package.json must be a object.`);

    if(!configuration.port)
      configuration.port = HTTPServer.defaultPort;

    if(!configuration.ssl || typeof configuration.ssl !== "object")
      configuration.ssl = {enabled: false};

    configuration.ssl.enabled = Utils.parseBoolean(configuration.ssl.enabled);

    return configuration;
  },

  /**
   * Load SSL certificate and key for a given application and HTTP configuration.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @param {object} configuration A HTTP configuration.
   * @returns {boolean|{key: Buffer, cert: Buffer}} `false` if SSL is disabled, the loaded certificates otherwisse.
   * @private
   */
  _loadSSL(application, configuration){
    if(application.production || (!Utils.parseBoolean(process.env.SSL) && !configuration.ssl.enabled)) // eslint-disable-line no-extra-parens
      return false;

    return {
      key: fs.readFileSync(path.resolve(application.root, configuration.ssl.key || "config/ssl/private-key.pem")), // eslint-disable-line no-sync
      cert: fs.readFileSync(path.resolve(application.root, configuration.ssl.certificate || "config/ssl/certificate.pem")) // eslint-disable-line no-sync
    };
  },

  /**
   * Set server port, install a profiler middleware and finally set it up to only accept JSON bodies and to parse them.
   *
   * @param {object} server A server object (created via {@link HTTPServer.create}).
   * @private
   */
  _configureExpress(server){
    const validJsonBody = Constants.HTTP.VALID_JSON_BODY;

    // Setup the port and SSL
    server.port = parseInt(process.env.PORT || server.configuration.port, 0);
    if(server.port < 0 || isNaN(server.port))
      server.port = HTTPServer.defaultPort;

    // Add the profiler
    server.express.use((req, res, next) => HTTPServer.profiler(server, req, res, next));
    server.express.enable("trust proxy");

    // Add GZIP compression
    if(server.application.production)
      server.express.use(compression({threshold: 0}));

    server.express.set("json spaces", server.application.production ? 0 : 2);

    server.express.use(bodyParser.json(
      {limit: server.configuration.maxBodySize, type: req => validJsonBody.test(req.header("Content-Type"))}
    ));

    // Only accept JSON bodies
    server.express.use(bodyParser.text(
      {limit: server.configuration.maxBodySize, type: req => !validJsonBody.test(req.header("Content-Type"))}
    ));

    server.express.use((req, res, next) => {
      if(typeof req.body === "string" && req.body.length)
        throw new SyntaxError(`Content-Type header must be match regular expression /${validJsonBody.source}/ and the data must a valid encoded JSON.`);

      next();
    });
  }
};

module.exports = HTTPServer;
